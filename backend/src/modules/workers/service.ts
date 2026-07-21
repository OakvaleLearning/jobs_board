import { createHash } from 'node:crypto';
import { and, desc, eq, ilike, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import {
  submitBackgroundForReview,
  submitIdentityForReview,
  withdrawIdentityReview,
} from '@/modules/verification/service.js';
import {
  workers,
  workerPersonalInfo,
  workerIdentityDocs,
  workerDocuments,
  workerBackgroundConsent,
  workerEducation,
  workerExperience,
  workerReferences,
  workerSkills,
  workerPreferences,
  workerSalaryExpectations,
  workerProfileExtras,
  cpdRecords,
  contracts,
  users,
} from '@/shared/db/schema.js';
import { redis } from '@/shared/cache/redis.js';
import { events } from '@/shared/events/bus.js';
import { logger } from '@/shared/logger/logger.js';
import { AppError } from '@/shared/errors/app-error.js';
import { recordAudit } from '@/shared/audit/record.js';
import { revokeAllSessions } from '@/modules/auth/service.js';
import { visibilityGateConds } from '@/modules/compliance/visibility.js';
import { sectionSchemas } from '@oakvale/shared/schema/worker.js';
import { REVALIDATION_SECTIONS } from '@oakvale/shared/enums/worker.js';
import type { WorkerSection } from '@oakvale/shared/enums/worker.js';
import { calculateCompletionPct, evaluateSections } from './completion.js';

const completionKey = (workerId: string) => `profile:completion:${workerId}`;

export async function getOrCreateForUser(userId: string): Promise<string> {
  const existing = await db.query.workers.findFirst({ where: eq(workers.userId, userId) });
  if (existing) return existing.id;
  const [created] = await db.insert(workers).values({ userId }).returning({ id: workers.id });
  if (!created) {
    throw new AppError({ code: 'INTERNAL_ERROR', message: 'Failed to create worker', statusCode: 500 });
  }
  return created.id;
}

export async function getProfileByUserId(userId: string) {
  const workerId = await getOrCreateForUser(userId);
  return getProfile(workerId);
}

export async function getProfile(workerId: string) {
  const w = await db.query.workers.findFirst({ where: eq(workers.id, workerId) });
  if (!w) throw new AppError({ code: 'WORKER_NOT_FOUND', message: 'Worker not found.', statusCode: 404 });

  const [
    [personalInfo],
    [identity],
    [consent],
    education,
    experience,
    references,
    skills,
    [preferences],
    [salary],
    [extras],
    owner,
  ] = await Promise.all([
    db.select().from(workerPersonalInfo).where(eq(workerPersonalInfo.workerId, workerId)),
    db.select().from(workerIdentityDocs).where(eq(workerIdentityDocs.workerId, workerId)),
    db.select().from(workerBackgroundConsent).where(eq(workerBackgroundConsent.workerId, workerId)),
    db
      .select()
      .from(workerEducation)
      .where(eq(workerEducation.workerId, workerId))
      .orderBy(desc(workerEducation.endDate)),
    db
      .select()
      .from(workerExperience)
      .where(eq(workerExperience.workerId, workerId))
      .orderBy(desc(workerExperience.startDate)),
    db
      .select()
      .from(workerReferences)
      .where(eq(workerReferences.workerId, workerId))
      .orderBy(desc(workerReferences.createdAt)),
    db.select().from(workerSkills).where(eq(workerSkills.workerId, workerId)),
    db.select().from(workerPreferences).where(eq(workerPreferences.workerId, workerId)),
    db.select().from(workerSalaryExpectations).where(eq(workerSalaryExpectations.workerId, workerId)),
    db.select().from(workerProfileExtras).where(eq(workerProfileExtras.workerId, workerId)),
    db.query.users.findFirst({ where: eq(users.id, w.userId) }),
  ]);

  return {
    id: w.id,
    userId: w.userId,
    visibilityStatus: w.visibilityStatus,
    profileCompletionPct: w.profileCompletionPct,
    workforceCategoryId: w.workforceCategoryId,
    submittedAt: w.submittedAt,
    referral: {
      source: owner?.referralSource ?? null,
      referrerName: owner?.referrerName ?? null,
    },
    sections: {
      A: personalInfo ?? null,
      B: identity ?? null,
      C: consent ?? null,
      D: { items: education },
      E: { items: experience },
      F: { items: references },
      G:
        preferences || w.workforceCategoryId
          ? { ...(preferences ?? {}), workforceCategoryId: w.workforceCategoryId ?? null }
          : null,
      H: { items: skills },
      I: extras
        ? { interests: extras.interests, personalStatement: extras.personalStatement }
        : null,
      J: extras ? { videoIntroDocumentId: extras.videoIntroDocumentId } : null,
      K: salary ?? null,
      L: extras
        ? {
            cpdEnrolled: extras.cpdEnrolled,
            oakvaleProgrammeAcknowledged: extras.oakvaleProgrammeAcknowledged,
            immunisationDeclared: extras.immunisationDeclared,
          }
        : null,
    },
  };
}

async function ensureExtrasRow(workerId: string): Promise<void> {
  await db.insert(workerProfileExtras).values({ workerId }).onConflictDoNothing();
}

export async function updateSection<S extends WorkerSection>(
  workerId: string,
  section: S,
  rawData: unknown,
): Promise<void> {
  const schema = sectionSchemas[section];
  const data = schema.parse(rawData);

  if ((REVALIDATION_SECTIONS as readonly string[]).includes(section)) {
    const worker = await db.query.workers.findFirst({ where: eq(workers.id, workerId) });
    if (worker?.visibilityStatus === 'APPROVED') {
      throw new AppError({
        code: 'PROFILE_SECTION_LOCKED',
        message: 'This verified section is locked. Request changes to edit it — it requires revalidation.',
        statusCode: 409,
        details: { section },
      });
    }
  }

  switch (section) {
    case 'A': {
      const d = data as import('@oakvale/shared/schema/worker.js').SectionPayloads['A'];
      await db
        .insert(workerPersonalInfo)
        .values({
          workerId,
          fullName: d.fullName,
          dob: d.dob,
          gender: d.gender,
          nationality: d.nationality,
          stateOfOrigin: d.stateOfOrigin,
          lga: d.lga,
          address: d.address,
          phone: d.phone,
          emergencyContact: d.emergencyContact,
        })
        .onConflictDoUpdate({
          target: workerPersonalInfo.workerId,
          set: {
            fullName: d.fullName,
            dob: d.dob,
            gender: d.gender,
            nationality: d.nationality,
            stateOfOrigin: d.stateOfOrigin,
            lga: d.lga,
            address: d.address,
            phone: d.phone,
            emergencyContact: d.emergencyContact,
          },
        });
      break;
    }
    case 'B': {
      const d = data as import('@oakvale/shared/schema/worker.js').SectionPayloads['B'];
      await db
        .insert(workerIdentityDocs)
        .values({ workerId, ...d })
        .onConflictDoUpdate({ target: workerIdentityDocs.workerId, set: d });
      break;
    }
    case 'C': {
      const d = data as import('@oakvale/shared/schema/worker.js').SectionPayloads['C'];
      const cValues = {
        consentGiven: d.backgroundCheckConsent,
        consentedAt: new Date(d.consentedAt),
        policeCertificateDocumentId: d.policeCertificateDocumentId ?? null,
        guarantorLetterDocumentId: d.guarantorLetterDocumentId ?? null,
        affidavitDocumentId: d.affidavitDocumentId ?? null,
      };
      await db
        .insert(workerBackgroundConsent)
        .values({ workerId, ...cValues })
        .onConflictDoUpdate({ target: workerBackgroundConsent.workerId, set: cValues });
      break;
    }
    case 'D': {
      const d = data as import('@oakvale/shared/schema/worker.js').SectionPayloads['D'];
      await db.delete(workerEducation).where(eq(workerEducation.workerId, workerId));
      if (d.items.length) {
        await db.insert(workerEducation).values(d.items.map((i) => ({ ...i, workerId })));
      }
      break;
    }
    case 'E': {
      const d = data as import('@oakvale/shared/schema/worker.js').SectionPayloads['E'];
      await db.delete(workerExperience).where(eq(workerExperience.workerId, workerId));
      if (d.items.length) {
        await db
          .insert(workerExperience)
          .values(d.items.map((i) => ({ ...i, workerId, skillsApplied: i.skillsApplied })));
      }
      break;
    }
    case 'F': {
      const d = data as import('@oakvale/shared/schema/worker.js').SectionPayloads['F'];
      await db.delete(workerReferences).where(eq(workerReferences.workerId, workerId));
      if (d.items.length) {
        await db.insert(workerReferences).values(d.items.map((i) => ({ ...i, workerId })));
      }
      break;
    }
    case 'G': {
      const d = data as import('@oakvale/shared/schema/worker.js').SectionPayloads['G'];
      // workforceCategoryId lives on the workers row, not worker_preferences.
      const { workforceCategoryId, ...prefs } = d;
      await db
        .update(workers)
        .set({ workforceCategoryId: workforceCategoryId ?? null })
        .where(eq(workers.id, workerId));
      await db
        .insert(workerPreferences)
        .values({ workerId, ...prefs })
        .onConflictDoUpdate({ target: workerPreferences.workerId, set: prefs });
      break;
    }
    case 'H': {
      const d = data as import('@oakvale/shared/schema/worker.js').SectionPayloads['H'];
      await db.delete(workerSkills).where(eq(workerSkills.workerId, workerId));
      if (d.items.length) {
        await db.insert(workerSkills).values(d.items.map((i) => ({ ...i, workerId })));
      }
      break;
    }
    case 'I': {
      const d = data as import('@oakvale/shared/schema/worker.js').SectionPayloads['I'];
      await ensureExtrasRow(workerId);
      await db
        .update(workerProfileExtras)
        .set({ interests: d.interests, personalStatement: d.personalStatement })
        .where(eq(workerProfileExtras.workerId, workerId));
      break;
    }
    case 'J': {
      const d = data as import('@oakvale/shared/schema/worker.js').SectionPayloads['J'];
      await ensureExtrasRow(workerId);
      await db
        .update(workerProfileExtras)
        .set({ videoIntroDocumentId: d.videoIntroDocumentId ?? null })
        .where(eq(workerProfileExtras.workerId, workerId));
      break;
    }
    case 'K': {
      const d = data as import('@oakvale/shared/schema/worker.js').SectionPayloads['K'];
      await db
        .insert(workerSalaryExpectations)
        .values({
          workerId,
          wageStructure: d.wageStructure,
          minRate: String(d.minRate),
          maxRate: String(d.maxRate),
          currency: d.currency,
          negotiable: d.negotiable,
          expectedBenefits: d.expectedBenefits,
        })
        .onConflictDoUpdate({
          target: workerSalaryExpectations.workerId,
          set: {
            wageStructure: d.wageStructure,
            minRate: String(d.minRate),
            maxRate: String(d.maxRate),
            currency: d.currency,
            negotiable: d.negotiable,
            expectedBenefits: d.expectedBenefits,
          },
        });
      break;
    }
    case 'L': {
      const d = data as import('@oakvale/shared/schema/worker.js').SectionPayloads['L'];
      await ensureExtrasRow(workerId);
      await db
        .update(workerProfileExtras)
        .set({
          cpdEnrolled: d.cpdEnrolled,
          oakvaleProgrammeAcknowledged: d.oakvaleProgrammeAcknowledged,
          immunisationDeclared: d.immunisationDeclared ?? false,
        })
        .where(eq(workerProfileExtras.workerId, workerId));
      break;
    }
  }

  await recomputeCompletion(workerId);
  // Phase 12: keep materialised aggregates current. Cheap and idempotent.
  if (section === 'E') void recomputeExperienceTotal(workerId);
}

export async function recomputeCompletion(workerId: string): Promise<number> {
  const profile = await getProfile(workerId);
  const status = evaluateSections({
    personalInfo: profile.sections.A,
    identity: profile.sections.B,
    consent: profile.sections.C ? { consentGiven: profile.sections.C.consentGiven } : null,
    education: profile.sections.D.items,
    experience: profile.sections.E.items,
    references: profile.sections.F.items,
    skills: profile.sections.H.items,
    preferences: profile.sections.G,
    salary: profile.sections.K,
    extras: {
      personalStatement: profile.sections.I?.personalStatement ?? null,
      videoIntroDocumentId: profile.sections.J?.videoIntroDocumentId ?? null,
      cpdEnrolled: profile.sections.L?.cpdEnrolled ?? false,
      oakvaleProgrammeAcknowledged: profile.sections.L?.oakvaleProgrammeAcknowledged ?? false,
    },
  });
  const pct = calculateCompletionPct(status);
  await db.update(workers).set({ profileCompletionPct: pct }).where(eq(workers.id, workerId));
  await redis.set(completionKey(workerId), String(pct), 'EX', 600);
  return pct;
}

export async function getCompletion(workerId: string): Promise<number> {
  const cached = await redis.get(completionKey(workerId));
  if (cached) return Number.parseInt(cached, 10);
  return recomputeCompletion(workerId);
}

export async function submitForReview(workerId: string): Promise<void> {
  const worker = await db.query.workers.findFirst({ where: eq(workers.id, workerId) });
  if (!worker) {
    throw new AppError({ code: 'WORKER_NOT_FOUND', message: 'Worker not found.', statusCode: 404 });
  }
  if (worker.visibilityStatus !== 'DRAFT' && worker.visibilityStatus !== 'REJECTED') {
    throw new AppError({
      code: 'SUBMISSION_NOT_ALLOWED',
      message: 'Only draft or rejected profiles can be submitted for review.',
      statusCode: 409,
      details: { visibilityStatus: worker.visibilityStatus },
    });
  }
  const pct = await recomputeCompletion(workerId);
  if (pct < 80) {
    throw new AppError({
      code: 'PROFILE_INCOMPLETE',
      message: `Profile must be at least 80% complete to submit (currently ${pct}%).`,
      statusCode: 400,
      details: { completionPct: pct },
    });
  }
  await db
    .update(workers)
    .set({ visibilityStatus: 'PENDING_REVIEW', submittedAt: new Date() })
    .where(eq(workers.id, workerId));
  await submitIdentityForReview(workerId);
  await submitBackgroundForReview(workerId);
  if (worker.preEditSnapshot != null) {
    events.emit('worker.profileResubmitted', { workerId });
  }
}

export async function requestEdit(workerId: string): Promise<void> {
  const worker = await db.query.workers.findFirst({ where: eq(workers.id, workerId) });
  if (!worker) {
    throw new AppError({ code: 'WORKER_NOT_FOUND', message: 'Worker not found.', statusCode: 404 });
  }
  if (worker.visibilityStatus !== 'APPROVED') {
    throw new AppError({
      code: 'EDIT_REQUEST_NOT_ALLOWED',
      message: 'Only approved profiles need to request changes.',
      statusCode: 409,
      details: { visibilityStatus: worker.visibilityStatus },
    });
  }
  const profile = await getProfile(workerId);
  await db
    .update(workers)
    .set({
      preEditSnapshot: profile.sections,
      editRequestedAt: new Date(),
      visibilityStatus: 'DRAFT',
      submittedAt: null,
    })
    .where(eq(workers.id, workerId));
}

export async function cancelSubmission(workerId: string): Promise<void> {
  const worker = await db.query.workers.findFirst({ where: eq(workers.id, workerId) });
  if (!worker) {
    throw new AppError({ code: 'WORKER_NOT_FOUND', message: 'Worker not found.', statusCode: 404 });
  }
  if (worker.visibilityStatus !== 'PENDING_REVIEW') {
    throw new AppError({
      code: 'SUBMISSION_NOT_CANCELLABLE',
      message: 'Only profiles pending review can be withdrawn.',
      statusCode: 409,
      details: { visibilityStatus: worker.visibilityStatus },
    });
  }
  await db
    .update(workers)
    .set({ visibilityStatus: 'DRAFT', submittedAt: null })
    .where(eq(workers.id, workerId));
  await withdrawIdentityReview(workerId);
}

export interface SearchFilters {
  q?: string;
  status?: string;
  page: number;
  limit: number;
  /**
   * When true (employer-facing search), restricts results to workers passing the
   * CLAUDE.md §1 visibility gate: background-check CLEAR + active Oakvale cert +
   * no active SAFEGUARDING flag. Admin/agent callers should pass false.
   */
  applyVisibilityGate?: boolean;

  // Phase 12 faceted filters
  certStatus?: 'ACTIVE' | 'IN_PROGRESS' | 'EXPIRED';
  bgCheckStatus?: string;
  state?: string;
  workforceCategoryId?: string;
  /** §5: restrict to these worker categories (employer-type allow-list; empty/undefined = all). */
  allowedWorkerCategoryIds?: string[];
  employmentType?: string;
  skills?: string[];
  languages?: string[];
  availableFrom?: string;
  minExperienceYears?: number;
  cpdHoursMin?: number;
}

interface SearchRow {
  id: string;
  userId: string;
  visibilityStatus: string;
  profileCompletionPct: number;
  /** Date from the DB; ISO string when rehydrated from the Redis cache. */
  submittedAt: Date | string | null;
  fullName: string | null;
  phone: string | null;
  stateOfOrigin: string | null;
  workforceCategoryId: string | null;
  /** Storage key of the worker's CLEAN selfie, if any. Presigned post-cache by the route. */
  selfieStorageKey: string | null;
}

export interface SearchResult {
  rows: SearchRow[];
  total: number;
}

/** Deterministic serialization: sorted object keys, sorted array values. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value
      .map((v) => stableStringify(v))
      .sort()
      .join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

export function searchCacheKey(filters: SearchFilters): string {
  const hash = createHash('sha256').update(stableStringify(filters)).digest('hex').slice(0, 32);
  return `search:workers:${hash}`;
}

export async function search(filters: SearchFilters): Promise<SearchResult> {
  // CLAUDE.md Redis table: employer-facing search is cached 5min (TTL-only
  // invalidation, so results may lag worker approval/suspension by up to
  // 5min). Admin searches (applyVisibilityGate=false) always hit the DB.
  const cacheKey = filters.applyVisibilityGate ? searchCacheKey(filters) : null;
  if (cacheKey) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as SearchResult;
    } catch (err) {
      logger.warn({ err }, 'worker search cache read failed; falling back to DB');
    }
  }

  const offset = (filters.page - 1) * filters.limit;
  const conds = [];
  if (filters.q) {
    conds.push(ilike(workerPersonalInfo.fullName, `%${filters.q}%`));
  }
  if (filters.status) {
    conds.push(
      eq(
        workers.visibilityStatus,
        filters.status as 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED',
      ),
    );
  }
  if (filters.applyVisibilityGate) {
    conds.push(...visibilityGateConds(workers.id));
    conds.push(isNull(workers.deletedAt));
    // Workers re-editing verified details (or otherwise not approved) are off-marketplace.
    conds.push(eq(workers.visibilityStatus, 'APPROVED'));
  }

  // Phase 12 facets
  if (filters.certStatus === 'ACTIVE') {
    conds.push(
      sql`EXISTS (SELECT 1 FROM certifications c WHERE c.worker_id = ${workers.id} AND c.is_oakvale_cert = true AND (c.expires_at IS NULL OR c.expires_at > now()))`,
    );
  } else if (filters.certStatus === 'IN_PROGRESS') {
    conds.push(
      sql`NOT EXISTS (SELECT 1 FROM certifications c WHERE c.worker_id = ${workers.id} AND c.is_oakvale_cert = true)`,
    );
  } else if (filters.certStatus === 'EXPIRED') {
    conds.push(
      sql`EXISTS (SELECT 1 FROM certifications c WHERE c.worker_id = ${workers.id} AND c.is_oakvale_cert = true AND c.expires_at IS NOT NULL AND c.expires_at < now())`,
    );
  }
  if (filters.bgCheckStatus) {
    conds.push(
      sql`EXISTS (SELECT 1 FROM background_checks bc WHERE bc.worker_id = ${workers.id} AND bc.status = ${filters.bgCheckStatus})`,
    );
  }
  if (filters.state) {
    conds.push(ilike(workerPersonalInfo.stateOfOrigin, `%${filters.state}%`));
  }
  if (filters.workforceCategoryId) {
    conds.push(eq(workers.workforceCategoryId, filters.workforceCategoryId));
  }
  if (filters.allowedWorkerCategoryIds && filters.allowedWorkerCategoryIds.length > 0) {
    conds.push(inArray(workers.workforceCategoryId, filters.allowedWorkerCategoryIds));
  }
  if (filters.employmentType) {
    conds.push(
      sql`EXISTS (SELECT 1 FROM worker_preferences wp WHERE wp.worker_id = ${workers.id} AND ${filters.employmentType} = ANY(wp.employment_type))`,
    );
  }
  if (filters.skills && filters.skills.length > 0) {
    for (const skill of filters.skills) {
      conds.push(
        sql`EXISTS (SELECT 1 FROM worker_skills ws WHERE ws.worker_id = ${workers.id} AND ws.name ILIKE ${'%' + skill + '%'})`,
      );
    }
  }
  if (filters.languages && filters.languages.length > 0) {
    for (const lang of filters.languages) {
      conds.push(
        sql`EXISTS (SELECT 1 FROM worker_skills ws WHERE ws.worker_id = ${workers.id} AND ws.kind = 'LANGUAGE' AND ws.name ILIKE ${'%' + lang + '%'})`,
      );
    }
  }
  if (filters.availableFrom) {
    conds.push(
      sql`EXISTS (SELECT 1 FROM worker_preferences wp WHERE wp.worker_id = ${workers.id} AND wp.availability_start IS NOT NULL AND wp.availability_start <= ${filters.availableFrom})`,
    );
  }
  if (filters.minExperienceYears !== undefined) {
    const minMonths = filters.minExperienceYears * 12;
    conds.push(sql`${workers.experienceTotalMonths} >= ${minMonths}`);
  }
  if (filters.cpdHoursMin !== undefined) {
    conds.push(sql`${workers.cpdTotalHours} >= ${filters.cpdHoursMin}`);
  }

  const where = conds.length ? and(...conds) : undefined;

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: workers.id,
        userId: workers.userId,
        visibilityStatus: workers.visibilityStatus,
        profileCompletionPct: workers.profileCompletionPct,
        workforceCategoryId: workers.workforceCategoryId,
        submittedAt: workers.submittedAt,
        fullName: workerPersonalInfo.fullName,
        phone: workerPersonalInfo.phone,
        stateOfOrigin: workerPersonalInfo.stateOfOrigin,
        selfieStorageKey: workerDocuments.storageKey,
      })
      .from(workers)
      .leftJoin(workerPersonalInfo, eq(workerPersonalInfo.workerId, workers.id))
      .leftJoin(workerIdentityDocs, eq(workerIdentityDocs.workerId, workers.id))
      .leftJoin(
        workerDocuments,
        and(
          eq(workerDocuments.id, workerIdentityDocs.selfieId),
          eq(workerDocuments.status, 'CLEAN'),
        ),
      )
      .where(where)
      .orderBy(desc(workers.updatedAt))
      .limit(filters.limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(workers)
      .leftJoin(workerPersonalInfo, eq(workerPersonalInfo.workerId, workers.id))
      .where(where),
  ]);

  const result: SearchResult = { rows, total: countRows[0]?.count ?? 0 };
  if (cacheKey) {
    try {
      await redis.set(cacheKey, JSON.stringify(result), 'EX', 300);
    } catch (err) {
      logger.warn({ err }, 'worker search cache write failed');
    }
  }
  return result;
}

/* --------------------------- Phase 12 helpers --------------------------- */

/**
 * Recompute the workers.experience_total_months materialised column for one worker.
 * Sums all worker_experience date ranges in months. Open-ended rows count from
 * start_date to now.
 */
export async function recomputeExperienceTotal(workerId: string): Promise<number> {
  const result = await db.execute<{ months: number | null }>(sql`
    SELECT COALESCE(SUM(
      GREATEST(
        DATE_PART('year', AGE(COALESCE(end_date, CURRENT_DATE), start_date)) * 12 +
        DATE_PART('month', AGE(COALESCE(end_date, CURRENT_DATE), start_date)),
        0
      )
    ), 0)::int AS months
    FROM worker_experience WHERE worker_id = ${workerId}
  `);
  const months = Number(result[0]?.months ?? 0);
  await db.update(workers).set({ experienceTotalMonths: months }).where(eq(workers.id, workerId));
  return months;
}

export async function recomputeCpdHours(workerId: string): Promise<number> {
  const rows = await db
    .select({ hours: sql<number>`COALESCE(SUM(${cpdRecords.hoursCompleted}::numeric),0)::int` })
    .from(cpdRecords)
    .where(eq(cpdRecords.workerId, workerId));
  const total = Number(rows[0]?.hours ?? 0);
  await db.update(workers).set({ cpdTotalHours: total }).where(eq(workers.id, workerId));
  return total;
}

/**
 * Phase 12 contact masking. A worker's PII (phone, email) is hidden from an
 * employer until at least one Worker Placement Agreement between them is
 * FULLY_EXECUTED. Reuses Phase 10 contracts module without cross-module DB.
 */
export async function employerHasUnlockedContact(
  employerId: string,
  workerId: string,
): Promise<boolean> {
  const found = await db
    .select({ id: contracts.id })
    .from(contracts)
    .where(
      and(
        eq(contracts.employerId, employerId),
        eq(contracts.workerId, workerId),
        eq(contracts.status, 'FULLY_EXECUTED'),
      ),
    )
    .limit(1);
  return found.length > 0;
}

/**
 * Batched form of {@link employerHasUnlockedContact} for list views: returns the
 * set of worker IDs this employer has unlocked (≥1 FULLY_EXECUTED contract). Used
 * by the browse route to decide, per card, whether to serve the clear or blurred
 * selfie in a single query.
 */
export async function getUnlockedWorkerIds(employerId: string): Promise<Set<string>> {
  const rows = await db
    .selectDistinct({ workerId: contracts.workerId })
    .from(contracts)
    .where(and(eq(contracts.employerId, employerId), eq(contracts.status, 'FULLY_EXECUTED')));
  return new Set(rows.flatMap((r) => (r.workerId ? [r.workerId] : [])));
}

/**
 * Admin/agent action: suspend or reactivate a worker account (TC-AUTH-007).
 * Suspend revokes portal access (`users.is_active=false` → login blocked) and hides
 * the profile from employer search (`visibility_status=SUSPENDED`), and kills active
 * sessions. Reactivate restores access and routes the worker back through review.
 */
export async function setWorkerSuspended(
  workerId: string,
  suspended: boolean,
  actorId?: string,
): Promise<{ workerId: string; visibilityStatus: string; isActive: boolean }> {
  const worker = await db.query.workers.findFirst({ where: eq(workers.id, workerId) });
  if (!worker) {
    throw new AppError({ code: 'WORKER_NOT_FOUND', message: 'Worker not found.', statusCode: 404 });
  }
  const isActive = !suspended;
  await db.update(users).set({ isActive }).where(eq(users.id, worker.userId));
  await db
    .update(workers)
    .set({ visibilityStatus: suspended ? 'SUSPENDED' : 'PENDING_REVIEW' })
    .where(eq(workers.id, workerId));
  if (suspended) await revokeAllSessions(worker.userId);
  void recordAudit({
    actorId: actorId ?? null,
    action: suspended ? 'worker.suspend' : 'worker.reactivate',
    targetType: 'worker',
    targetId: workerId,
  });
  return { workerId, visibilityStatus: suspended ? 'SUSPENDED' : 'PENDING_REVIEW', isActive };
}


