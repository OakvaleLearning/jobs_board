import { and, desc, eq, inArray, isNull, lt, lte, sql } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import {
  employers,
  placementEvents,
  placements,
  replacementRequests,
  shortlists,
  welfareChecks,
  workers,
  workerPersonalInfo,
  workerPreferences,
  workerSkills,
  workerExperience,
} from '@/shared/db/schema.js';
import { AppError } from '@/shared/errors/app-error.js';
import { events } from '@/shared/events/bus.js';
import { queues } from '@/shared/queue/queues.js';
import { addBusinessDays } from '@/shared/utils/business-days.js';
import { logger } from '@/shared/logger/logger.js';
import { recordAudit } from '@/shared/audit/record.js';
import { deriveTypeFlags, getEmployerType } from '@/modules/admin/employer-types.service.js';
import {
  CORPORATE_SLA_BUSINESS_DAYS,
  INDIVIDUAL_EMPLOYER_SLA_BUSINESS_DAYS,
  GUARANTEE_WINDOW_DAYS,
  type EndReason,
  type PipelineType,
  type PlacementEventType,
  type PlacementStatus,
} from '@oakvale/shared/enums/placement.js';
import type { WelfareCheckLogInput } from '@oakvale/shared/schema/placement.js';
import { visibleWorkerIds } from '@/modules/compliance/visibility.js';
import { matchWorkers, type CandidateInput, type AssessmentContext, type MatchedCandidate } from './matching.js';
import { getWorkerRatingSummaries } from './ratings.js';
import { assertTransition } from './state-machine.js';

const WELFARE_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000; // monthly

async function logEvent(
  placementId: string,
  eventType: PlacementEventType,
  actorId: string | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await db.insert(placementEvents).values({ placementId, eventType, actorId: actorId ?? null, metadata: metadata ?? null });
}

async function loadCandidatePool(): Promise<CandidateInput[]> {
  // Visibility-gated worker IDs first
  const rows = await db
    .select({
      workerId: workerPersonalInfo.workerId,
      fullName: workerPersonalInfo.fullName,
      stateOfOrigin: workerPersonalInfo.stateOfOrigin,
      workforceCategoryId: workers.workforceCategoryId,
    })
    .from(workerPersonalInfo)
    .leftJoin(workers, eq(workers.id, workerPersonalInfo.workerId));

  const visible = await visibleWorkerIds(rows.map((r) => r.workerId));
  const visibleRows = rows.filter((r) => visible.has(r.workerId));
  if (visibleRows.length === 0) return [];

  const ids = visibleRows.map((r) => r.workerId);
  const [prefRows, skillRows, experienceRows] = await Promise.all([
    db.select().from(workerPreferences).where(inArray(workerPreferences.workerId, ids)),
    db
      .select({ workerId: workerSkills.workerId, name: workerSkills.name, category: workerSkills.category, selfRating: workerSkills.selfRating })
      .from(workerSkills)
      .where(inArray(workerSkills.workerId, ids)),
    db
      .select({ workerId: workerExperience.workerId, sector: workerExperience.sector, startDate: workerExperience.startDate, endDate: workerExperience.endDate, isCurrent: workerExperience.isCurrent })
      .from(workerExperience)
      .where(inArray(workerExperience.workerId, ids)),
  ]);

  const prefsByWorker = new Map(prefRows.map((p) => [p.workerId, p]));
  const skillsByWorker = groupBy(skillRows, (s) => s.workerId);
  const experienceByWorker = groupBy(experienceRows, (e) => e.workerId);
  // Live placement ratings now feed the matcher's rating weight (§14.2).
  const ratingByWorker = await getWorkerRatingSummaries(ids);

  return visibleRows.map((r) => {
    const prefs = prefsByWorker.get(r.workerId);
    return {
      workerId: r.workerId,
      fullName: r.fullName,
      stateOfOrigin: r.stateOfOrigin,
      employmentType: (prefs?.employmentType as string | null) ?? null,
      preferredCities: ((prefs?.preferredCities as string[] | null) ?? []) as string[],
      relocationWillingness: prefs?.relocationWillingness ?? null,
      availabilityStart: prefs?.availabilityStart ?? null,
      skills: (skillsByWorker.get(r.workerId) ?? []).map((s) => ({ name: s.name, category: s.category, selfRating: s.selfRating })),
      experience: (experienceByWorker.get(r.workerId) ?? []).map((e) => ({
        sector: e.sector,
        durationDays: durationDays(e.startDate, e.isCurrent ? null : e.endDate),
      })),
      workforceCategoryId: r.workforceCategoryId,
      // Passing the visibility gate requires an active Oakvale cert.
      oakvaleCertified: true,
      averageRating: ratingByWorker.get(r.workerId)?.average ?? 0,
    };
  });
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = out.get(k);
    if (bucket) bucket.push(item);
    else out.set(k, [item]);
  }
  return out;
}

function durationDays(start: string | null, end: string | null): number {
  if (!start) return 0;
  const startMs = Date.parse(start);
  const endMs = end ? Date.parse(end) : Date.now();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 0;
  return Math.max(0, Math.round((endMs - startMs) / 86_400_000));
}

async function loadAssessmentContext(
  employerId: string,
  jobPostingId: string | null,
): Promise<AssessmentContext> {
  const employer = await db.query.employers.findFirst({ where: eq(employers.id, employerId) });
  if (!employer) {
    throw new AppError({ code: 'EMPLOYER_NOT_FOUND', message: 'Employer not found.', statusCode: 404 });
  }
  if (deriveTypeFlags(await getEmployerType(employer.employerTypeId)).usesIndividualEmployerNeeds) {
    const needs = await db.query.individualEmployerNeedsAssessments.findFirst({
      where: (t, { eq: eqOp }) => eqOp(t.employerId, employerId),
    });
    return {
      pipelineType: 'INDIVIDUAL_EMPLOYER',
      desiredCity: null,
      desiredEmploymentType: needs?.accommodationType === 'LIVE_IN' ? 'LIVE_IN' : needs?.accommodationType === 'LIVE_OUT' ? 'LIVE_OUT' : null,
      preferredSector: 'Caregiving',
    };
  }
  // CORPORATE
  const needs = await db.query.corporateNeedsAssessments.findFirst({
    where: (t, { eq: eqOp }) => eqOp(t.employerId, employerId),
  });
  return {
    pipelineType: 'CORPORATE',
    desiredCity: null,
    desiredEmploymentType: null,
    requiredSkills: (needs?.specificSkillsNeeded as string[] | null) ?? [],
    preferredSector: 'Childcare',
  };
}

export async function generateShortlist(input: {
  employerId: string;
  jobPostingId?: string | null;
  createdBy: string;
}): Promise<{ shortlistId: string; matches: MatchedCandidate[] }> {
  const ctx = await loadAssessmentContext(input.employerId, input.jobPostingId ?? null);
  const pool = await loadCandidatePool();
  const matches = matchWorkers(pool, ctx, 5);
  if (matches.length === 0) {
    throw new AppError({
      code: 'NO_ELIGIBLE_WORKERS',
      message: 'No eligible workers passed the visibility gate + hard filters.',
      statusCode: 409,
    });
  }
  const [row] = await db
    .insert(shortlists)
    .values({
      employerId: input.employerId,
      jobPostingId: input.jobPostingId ?? null,
      requestType: ctx.pipelineType,
      workerIds: matches,
      createdBy: input.createdBy,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    })
    .returning({ id: shortlists.id });
  if (!row) throw new AppError({ code: 'INTERNAL_ERROR', message: 'Failed to persist shortlist', statusCode: 500 });
  events.emit('shortlist.generated', { shortlistId: row.id, employerId: input.employerId, candidateCount: matches.length });
  return { shortlistId: row.id, matches };
}

export async function overrideShortlist(shortlistId: string, workerIds: string[]) {
  // Re-score using the same context so the breakdown stays consistent
  const s = await db.query.shortlists.findFirst({ where: eq(shortlists.id, shortlistId) });
  if (!s) throw new AppError({ code: 'SHORTLIST_NOT_FOUND', message: 'Shortlist not found.', statusCode: 404 });
  const ctx = await loadAssessmentContext(s.employerId, s.jobPostingId);
  const pool = await loadCandidatePool();
  const filtered = pool.filter((c) => workerIds.includes(c.workerId));
  const matches = matchWorkers(filtered, ctx, workerIds.length);
  await db
    .update(shortlists)
    .set({ workerIds: matches })
    .where(eq(shortlists.id, shortlistId));
  return matches;
}

export async function listShortlistsForEmployer(employerId: string) {
  return db
    .select()
    .from(shortlists)
    .where(eq(shortlists.employerId, employerId))
    .orderBy(desc(shortlists.createdAt));
}

export async function getShortlist(shortlistId: string) {
  const row = await db.query.shortlists.findFirst({ where: eq(shortlists.id, shortlistId) });
  if (!row) throw new AppError({ code: 'SHORTLIST_NOT_FOUND', message: 'Shortlist not found.', statusCode: 404 });
  return row;
}

export async function markShortlistViewed(shortlistId: string) {
  await db
    .update(shortlists)
    .set({ viewedAt: new Date() })
    .where(and(eq(shortlists.id, shortlistId), isNull(shortlists.viewedAt)));
}

export async function selectWorker(shortlistId: string, workerId: string, selectedBy: string) {
  const s = await db.query.shortlists.findFirst({ where: eq(shortlists.id, shortlistId) });
  if (!s) throw new AppError({ code: 'SHORTLIST_NOT_FOUND', message: 'Shortlist not found.', statusCode: 404 });
  const matches = (s.workerIds as MatchedCandidate[] | null) ?? [];
  if (!matches.find((m) => m.workerId === workerId)) {
    throw new AppError({
      code: 'VALIDATION_ERROR',
      message: 'Selected worker is not on this shortlist.',
      statusCode: 400,
    });
  }
  const [placement] = await db
    .insert(placements)
    .values({
      employerId: s.employerId,
      workerId,
      jobPostingId: s.jobPostingId,
      pipelineType: s.requestType,
      status: 'CONTRACT_PENDING',
    })
    .returning();
  if (!placement) throw new AppError({ code: 'INTERNAL_ERROR', message: 'Failed to create placement', statusCode: 500 });
  await db
    .update(shortlists)
    .set({ selectedWorkerId: workerId, decidedAt: new Date() })
    .where(eq(shortlists.id, shortlistId));
  await logEvent(placement.id, 'SELECTED', selectedBy, { shortlistId });
  events.emit('placement.selected', {
    placementId: placement.id,
    employerId: placement.employerId,
    workerId,
  });
  return placement;
}

export async function createFromOffer(opts: {
  shortlistId: string;
  employerId: string;
  workerId: string;
  jobPostingId: string | null;
  pipelineType: 'INDIVIDUAL_EMPLOYER' | 'CORPORATE';
  actorUserId: string;
}) {
  const [placement] = await db
    .insert(placements)
    .values({
      employerId: opts.employerId,
      workerId: opts.workerId,
      jobPostingId: opts.jobPostingId,
      pipelineType: opts.pipelineType,
      status: 'CONTRACT_PENDING',
    })
    .returning();
  if (!placement) {
    throw new AppError({
      code: 'INTERNAL_ERROR',
      message: 'Failed to create placement from offer',
      statusCode: 500,
    });
  }
  await db
    .update(shortlists)
    .set({ selectedWorkerId: opts.workerId, decidedAt: new Date() })
    .where(eq(shortlists.id, opts.shortlistId));
  await logEvent(placement.id, 'SELECTED', opts.actorUserId, { shortlistId: opts.shortlistId });
  events.emit('placement.selected', {
    placementId: placement.id,
    employerId: placement.employerId,
    workerId: opts.workerId,
  });
  return placement;
}

export async function advanceToPendingPayment(placementId: string, actorId: string | null) {
  const p = await getPlacementOrThrow(placementId);
  if (p.status !== 'CONTRACT_PENDING') return p;
  assertTransition(p.status, 'PENDING_PAYMENT');
  const [updated] = await db
    .update(placements)
    .set({ status: 'PENDING_PAYMENT' })
    .where(eq(placements.id, placementId))
    .returning();
  await logEvent(placementId, 'CONTRACT_EXECUTED', actorId, {});
  return updated;
}

export async function activatePlacement(placementId: string, activatedBy: string | null) {
  const p = await getPlacementOrThrow(placementId);
  assertTransition(p.status, 'ACTIVE');
  if (p.status === 'ACTIVE') {
    throw new AppError({
      code: 'PLACEMENT_ALREADY_ACTIVE',
      message: 'Placement is already active.',
      statusCode: 409,
    });
  }
  const now = new Date();
  const guarantee = new Date(now.getTime() + GUARANTEE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  await db
    .update(placements)
    .set({
      status: 'ACTIVE',
      activatedAt: now,
      placedAt: now,
      guaranteeExpiresAt: guarantee,
    })
    .where(eq(placements.id, placementId));
  await logEvent(placementId, 'ACTIVATED', activatedBy, { guaranteeExpiresAt: guarantee.toISOString() });

  // Schedule monthly welfare checks
  await queues.welfareChecks.upsertJobScheduler(
    `welfare-${placementId}`,
    { every: WELFARE_INTERVAL_MS },
    { name: 'welfare-tick', data: { placementId } },
  );

  events.emit('placement.activated', {
    placementId,
    employerId: p.employerId,
    workerId: p.workerId,
  });
  void recordAudit({
    actorId: activatedBy,
    action: 'placement.activated',
    targetType: 'placement',
    targetId: placementId,
    metadata: { guaranteeExpiresAt: guarantee.toISOString() },
  });
}

export async function logWelfareCheck(
  placementId: string,
  input: WelfareCheckLogInput,
  completedBy: string,
) {
  const p = await getPlacementOrThrow(placementId);
  const [check] = await db
    .insert(welfareChecks)
    .values({
      placementId,
      completedAt: new Date(),
      completedBy,
      recipientWellbeing: input.recipientWellbeing,
      workerAttendance: input.workerAttendance,
      issuesFlagged: input.issuesFlagged,
      notes: input.notes,
    })
    .returning();
  if (!check) {
    throw new AppError({
      code: 'INTERNAL_ERROR',
      message: 'Failed to log welfare check.',
      statusCode: 500,
    });
  }
  await logEvent(placementId, 'WELFARE_LOGGED', completedBy, {
    issuesFlagged: input.issuesFlagged,
  });
  events.emit('welfare.checkCompleted', {
    placementId,
    welfareCheckId: check.id,
    recipientWellbeing: check.recipientWellbeing ?? null,
    workerAttendance: check.workerAttendance ?? null,
    issuesFlagged: check.issuesFlagged,
  });
  return p;
}

export async function listWelfareChecks(placementId: string) {
  return db
    .select()
    .from(welfareChecks)
    .where(eq(welfareChecks.placementId, placementId))
    .orderBy(desc(welfareChecks.scheduledAt));
}

export async function listPlacementEvents(placementId: string) {
  return db
    .select()
    .from(placementEvents)
    .where(eq(placementEvents.placementId, placementId))
    .orderBy(desc(placementEvents.occurredAt));
}

export async function requestReplacement(
  placementId: string,
  requestedBy: string,
  reason: string,
) {
  const p = await getPlacementOrThrow(placementId);
  if (p.status !== 'ACTIVE' && p.status !== 'SUSPENDED') {
    throw new AppError({
      code: 'INVALID_PLACEMENT_TRANSITION',
      message: 'Replacement can only be requested on an active or suspended placement.',
      statusCode: 409,
    });
  }
  const businessDays =
    p.pipelineType === 'INDIVIDUAL_EMPLOYER' ? INDIVIDUAL_EMPLOYER_SLA_BUSINESS_DAYS : CORPORATE_SLA_BUSINESS_DAYS;
  const slaDeadline = addBusinessDays(new Date(), businessDays);
  const insideGuarantee = p.guaranteeExpiresAt ? new Date() < new Date(p.guaranteeExpiresAt) : false;

  const [row] = await db
    .insert(replacementRequests)
    .values({
      originalPlacementId: placementId,
      requestedBy,
      reason,
      slaDeadline,
      status: 'OPEN',
      replacementFeeWaived: insideGuarantee,
    })
    .returning();
  if (!row) throw new AppError({ code: 'INTERNAL_ERROR', message: 'Failed to create request', statusCode: 500 });

  await logEvent(placementId, 'REPLACEMENT_REQUESTED', requestedBy, {
    requestId: row.id,
    slaDeadline: slaDeadline.toISOString(),
    insideGuarantee,
  });
  events.emit('placement.replacementRequested', {
    placementId,
    requestId: row.id,
    pipelineType: p.pipelineType as PipelineType,
    slaDeadline: slaDeadline.toISOString(),
  });
  return row;
}

export async function fulfilReplacement(
  requestId: string,
  newWorkerId: string,
  fulfilledBy: string,
) {
  const req = await db.query.replacementRequests.findFirst({
    where: eq(replacementRequests.id, requestId),
  });
  if (!req) {
    throw new AppError({
      code: 'REPLACEMENT_REQUEST_NOT_FOUND',
      message: 'Replacement request not found.',
      statusCode: 404,
    });
  }
  const original = await getPlacementOrThrow(req.originalPlacementId);
  const [newPlacement] = await db
    .insert(placements)
    .values({
      employerId: original.employerId,
      workerId: newWorkerId,
      jobPostingId: original.jobPostingId,
      pipelineType: original.pipelineType,
      status: 'PENDING_PAYMENT',
      replacementOf: original.id,
    })
    .returning();
  if (!newPlacement) throw new AppError({ code: 'INTERNAL_ERROR', message: 'Failed to create replacement', statusCode: 500 });

  // Original placement → TERMINATED (REPLACED)
  await db
    .update(placements)
    .set({ status: 'TERMINATED', endedAt: new Date(), endReason: 'REPLACED' })
    .where(eq(placements.id, original.id));
  await logEvent(original.id, 'REPLACED', fulfilledBy, { newPlacementId: newPlacement.id });

  await db
    .update(replacementRequests)
    .set({ status: 'FULFILLED', newPlacementId: newPlacement.id })
    .where(eq(replacementRequests.id, requestId));
  return newPlacement;
}

export async function endPlacement(
  placementId: string,
  endReason: EndReason,
  actorId: string,
  notes?: string,
): Promise<void> {
  const p = await getPlacementOrThrow(placementId);
  const target: PlacementStatus = endReason === 'COMPLETED' ? 'COMPLETED' : 'TERMINATED';
  assertTransition(p.status, target);
  await db
    .update(placements)
    .set({ status: target, endedAt: new Date(), endReason, notes: notes ?? p.notes })
    .where(eq(placements.id, placementId));
  await logEvent(placementId, target, actorId, { endReason });
  void recordAudit({
    actorId,
    action: target === 'COMPLETED' ? 'placement.completed' : 'placement.terminated',
    targetType: 'placement',
    targetId: placementId,
    metadata: { endReason, notes: notes ?? null },
  });
  if (target === 'COMPLETED') {
    events.emit('placement.completed', {
      placementId,
      employerId: p.employerId,
      workerId: p.workerId,
    });
  }
}

export async function suspendActivePlacements(workerId: string, reason: string) {
  const active = await db
    .select()
    .from(placements)
    .where(and(eq(placements.workerId, workerId), eq(placements.status, 'ACTIVE')));
  for (const p of active) {
    await db
      .update(placements)
      .set({ status: 'SUSPENDED' })
      .where(eq(placements.id, p.id));
    await logEvent(p.id, 'SUSPENDED', null, { reason });
    events.emit('placement.suspended', { placementId: p.id, workerId, reason });
    logger.warn({ placementId: p.id, workerId, reason }, 'placement suspended');
  }
  return active.length;
}

export async function listForEmployer(employerId: string) {
  return db
    .select()
    .from(placements)
    .where(eq(placements.employerId, employerId))
    .orderBy(desc(placements.createdAt));
}

export async function listForWorker(workerId: string) {
  return db
    .select()
    .from(placements)
    .where(eq(placements.workerId, workerId))
    .orderBy(desc(placements.createdAt));
}

export interface AdminListFilters {
  status?: PlacementStatus;
  pipeline?: PipelineType;
  page: number;
  limit: number;
}

export async function adminList(filters: AdminListFilters) {
  const offset = (filters.page - 1) * filters.limit;
  const conds = [];
  if (filters.status) conds.push(eq(placements.status, filters.status));
  if (filters.pipeline) conds.push(eq(placements.pipelineType, filters.pipeline));
  const where = conds.length ? and(...conds) : undefined;
  const rows = await db
    .select()
    .from(placements)
    .where(where)
    .orderBy(desc(placements.createdAt))
    .limit(filters.limit)
    .offset(offset);
  const totals = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(placements)
    .where(where);
  return { rows, total: totals[0]?.count ?? 0 };
}

export async function adminListShortlists(opts: { page: number; limit: number }) {
  const offset = (opts.page - 1) * opts.limit;
  const rows = await db
    .select()
    .from(shortlists)
    .orderBy(desc(shortlists.createdAt))
    .limit(opts.limit)
    .offset(offset);
  const totals = await db.select({ count: sql<number>`count(*)::int` }).from(shortlists);
  return { rows, total: totals[0]?.count ?? 0 };
}

export async function listOpenReplacementRequests() {
  return db
    .select()
    .from(replacementRequests)
    .where(eq(replacementRequests.status, 'OPEN'))
    .orderBy(replacementRequests.slaDeadline);
}

export async function scanSlaBreaches(now: Date = new Date()) {
  const warningCutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  // Mark expired
  await db
    .update(replacementRequests)
    .set({ status: 'EXPIRED' })
    .where(and(eq(replacementRequests.status, 'OPEN'), lt(replacementRequests.slaDeadline, now)));
  // Surface warnings
  const warning = await db
    .select()
    .from(replacementRequests)
    .where(
      and(
        eq(replacementRequests.status, 'OPEN'),
        lte(replacementRequests.slaDeadline, warningCutoff),
      ),
    );
  for (const w of warning) {
    events.emit('replacement.slaWarning', {
      requestId: w.id,
      placementId: w.originalPlacementId,
      slaDeadline: w.slaDeadline.toISOString(),
    });
  }
  return { warningCount: warning.length };
}

export async function getPlacementOrThrow(placementId: string) {
  const p = await db.query.placements.findFirst({ where: eq(placements.id, placementId) });
  if (!p) {
    throw new AppError({ code: 'PLACEMENT_NOT_FOUND', message: 'Placement not found.', statusCode: 404 });
  }
  return p;
}

export async function bulkGetByIds(ids: string[]) {
  if (ids.length === 0) return [];
  return db.select().from(placements).where(inArray(placements.id, ids));
}
