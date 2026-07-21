import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import {
  backgroundChecks,
  verificationRequests,
  workerPersonalInfo,
  workers,
} from '@/shared/db/schema.js';
import { AppError } from '@/shared/errors/app-error.js';
import { events } from '@/shared/events/bus.js';
import { recordAudit } from '@/shared/audit/record.js';
import type {
  BackgroundCheckStatus,
  VerificationRequestType,
  VerificationStatus,
} from '@oakvale/shared/enums/verification.js';
import { assertTransition } from './state-machine.js';

export async function submitIdentityForReview(workerId: string): Promise<void> {
  const existing = await latestRequest(workerId, 'IDENTITY');
  if (existing && existing.status === 'VERIFIED') return;

  if (existing) {
    assertTransition(existing.status, 'IN_REVIEW');
    await db
      .update(verificationRequests)
      .set({ status: 'IN_REVIEW', submittedAt: new Date(), decisionReason: null })
      .where(eq(verificationRequests.id, existing.id));
    return;
  }
  await db.insert(verificationRequests).values({
    workerId,
    requestType: 'IDENTITY',
    status: 'IN_REVIEW',
    submittedAt: new Date(),
  });
}

export async function withdrawIdentityReview(workerId: string): Promise<void> {
  const existing = await latestRequest(workerId, 'IDENTITY');
  if (!existing) return;
  if (existing.status !== 'SUBMITTED' && existing.status !== 'IN_REVIEW') return;
  assertTransition(existing.status, 'PENDING');
  await db
    .update(verificationRequests)
    .set({ status: 'PENDING', submittedAt: null })
    .where(eq(verificationRequests.id, existing.id));
}

export async function reviewIdentity(
  workerId: string,
  reviewerUserId: string,
  input: { decision: 'VERIFIED' | 'REJECTED'; notes?: string },
): Promise<void> {
  const req = await latestRequest(workerId, 'IDENTITY');
  if (!req) {
    throw new AppError({
      code: 'VERIFICATION_REQUEST_NOT_FOUND',
      message: 'No IDENTITY request to review.',
      statusCode: 404,
    });
  }
  assertTransition(req.status, input.decision);
  await db
    .update(verificationRequests)
    .set({
      status: input.decision,
      reviewedAt: new Date(),
      reviewedBy: reviewerUserId,
      notes: input.notes,
      decisionReason: input.decision === 'REJECTED' ? input.notes ?? null : null,
    })
    .where(eq(verificationRequests.id, req.id));

  if (input.decision === 'VERIFIED') {
    events.emit('worker.identityApproved', { workerId, reviewedBy: reviewerUserId });
  } else {
    events.emit('worker.identityRejected', { workerId, reviewedBy: reviewerUserId, reason: input.notes });
    await db
      .update(workers)
      .set({ visibilityStatus: 'REJECTED' })
      .where(eq(workers.id, workerId));
  }
  void recordAudit({
    actorId: reviewerUserId,
    action: input.decision === 'VERIFIED' ? 'verification.identityApproved' : 'verification.identityRejected',
    targetType: 'worker',
    targetId: workerId,
    metadata: { notes: input.notes ?? null },
  });
}

async function latestBackground(workerId: string) {
  return db.query.backgroundChecks.findFirst({
    where: eq(backgroundChecks.workerId, workerId),
    orderBy: desc(backgroundChecks.createdAt),
  });
}

/**
 * Submit the worker's uploaded background documents for admin review. Idempotent:
 * keeps an already-CLEAR check, otherwise (re)opens the latest row as PENDING.
 */
export async function submitBackgroundForReview(workerId: string): Promise<void> {
  const row = await latestBackground(workerId);
  if (row && row.status === 'CLEAR') return;
  if (row) {
    await db
      .update(backgroundChecks)
      .set({ status: 'PENDING', submittedAt: new Date(), completedAt: null, notes: null })
      .where(eq(backgroundChecks.id, row.id));
    return;
  }
  await db
    .insert(backgroundChecks)
    .values({ workerId, status: 'PENDING', submittedAt: new Date() });
}

/**
 * Admin decision on the uploaded background documents. Advisory — it updates the
 * background badge but does NOT change the worker's visibility.
 */
export async function reviewBackground(
  workerId: string,
  reviewerUserId: string,
  input: { decision: 'CLEAR' | 'FLAGGED'; notes?: string },
): Promise<void> {
  const row = await latestBackground(workerId);
  if (!row) {
    throw new AppError({
      code: 'VERIFICATION_REQUEST_NOT_FOUND',
      message: 'No background check to review for this worker.',
      statusCode: 404,
    });
  }
  await db
    .update(backgroundChecks)
    .set({
      status: input.decision,
      completedAt: new Date(),
      reviewedBy: reviewerUserId,
      notes: input.notes ?? null,
    })
    .where(eq(backgroundChecks.id, row.id));
  events.emit('worker.backgroundReviewed', { workerId, status: input.decision });
  void recordAudit({
    actorId: reviewerUserId,
    action: input.decision === 'CLEAR' ? 'verification.backgroundCleared' : 'verification.backgroundFlagged',
    targetType: 'worker',
    targetId: workerId,
    metadata: { notes: input.notes ?? null },
  });
}

export interface AggregateStatus {
  identity: {
    status: VerificationStatus | 'UNSTARTED';
    submittedAt: Date | null;
    reviewedAt: Date | null;
    notes: string | null;
  };
  background: {
    status: BackgroundCheckStatus | 'UNSTARTED';
    submittedAt: Date | null;
    completedAt: Date | null;
    notes: string | null;
  };
  overallVerified: boolean;
}

export async function getStatus(workerId: string): Promise<AggregateStatus> {
  const identity = await latestRequest(workerId, 'IDENTITY');
  const bg = await db.query.backgroundChecks.findFirst({
    where: eq(backgroundChecks.workerId, workerId),
    orderBy: desc(backgroundChecks.createdAt),
  });
  return {
    identity: {
      status: identity?.status ?? 'UNSTARTED',
      submittedAt: identity?.submittedAt ?? null,
      reviewedAt: identity?.reviewedAt ?? null,
      notes: identity?.notes ?? null,
    },
    background: {
      status: bg?.status ?? 'UNSTARTED',
      submittedAt: bg?.submittedAt ?? null,
      completedAt: bg?.completedAt ?? null,
      notes: bg?.notes ?? null,
    },
    overallVerified: identity?.status === 'VERIFIED' && bg?.status === 'CLEAR',
  };
}

async function latestRequest(workerId: string, type: VerificationRequestType) {
  return db.query.verificationRequests.findFirst({
    where: and(
      eq(verificationRequests.workerId, workerId),
      eq(verificationRequests.requestType, type),
    ),
    orderBy: desc(verificationRequests.createdAt),
  });
}

export interface QueueRow {
  workerId: string;
  fullName: string | null;
  visibilityStatus: string;
  profileCompletionPct: number;
  identityStatus: VerificationStatus | 'UNSTARTED';
  submittedAt: Date | null;
}

export async function getQueue(opts: { page: number; limit: number }): Promise<{ rows: QueueRow[]; total: number }> {
  const offset = (opts.page - 1) * opts.limit;
  const rows = await db
    .select({
      workerId: workers.id,
      fullName: workerPersonalInfo.fullName,
      visibilityStatus: workers.visibilityStatus,
      profileCompletionPct: workers.profileCompletionPct,
      identityStatus: verificationRequests.status,
      submittedAt: verificationRequests.submittedAt,
    })
    .from(workers)
    .leftJoin(workerPersonalInfo, eq(workerPersonalInfo.workerId, workers.id))
    .leftJoin(
      verificationRequests,
      and(
        eq(verificationRequests.workerId, workers.id),
        eq(verificationRequests.requestType, 'IDENTITY'),
      ),
    )
    .where(eq(workers.visibilityStatus, 'PENDING_REVIEW'))
    .orderBy(desc(workers.submittedAt))
    .limit(opts.limit)
    .offset(offset);

  const totals = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(workers)
    .where(eq(workers.visibilityStatus, 'PENDING_REVIEW'));

  return {
    rows: rows.map((r) => ({
      workerId: r.workerId,
      fullName: r.fullName,
      visibilityStatus: r.visibilityStatus,
      profileCompletionPct: r.profileCompletionPct,
      identityStatus: r.identityStatus ?? 'UNSTARTED',
      submittedAt: r.submittedAt,
    })),
    total: totals[0]?.count ?? 0,
  };
}

export async function listBackgroundChecks(opts: { page: number; limit: number }) {
  const offset = (opts.page - 1) * opts.limit;
  const rows = await db
    .select({
      id: backgroundChecks.id,
      workerId: backgroundChecks.workerId,
      fullName: workerPersonalInfo.fullName,
      status: backgroundChecks.status,
      submittedAt: backgroundChecks.submittedAt,
      completedAt: backgroundChecks.completedAt,
      notes: backgroundChecks.notes,
    })
    .from(backgroundChecks)
    .leftJoin(workerPersonalInfo, eq(workerPersonalInfo.workerId, backgroundChecks.workerId))
    .orderBy(desc(backgroundChecks.createdAt))
    .limit(opts.limit)
    .offset(offset);
  return rows;
}
