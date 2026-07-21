import { and, desc, eq, gt, ilike, isNull, lte, or, sql } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import {
  certifications,
  complianceFlags,
  cpdRecords,
  users,
  workerPersonalInfo,
  workers,
  workforceCategories,
} from '@/shared/db/schema.js';
import { visibleWorkerIds } from './visibility.js';
import { AppError } from '@/shared/errors/app-error.js';
import { events } from '@/shared/events/bus.js';
import { recordAudit } from '@/shared/audit/record.js';
import type {
  CertificationInput,
  CertificationReviewInput,
  CpdRecordInput,
  FlagCreateInput,
} from '@oakvale/shared/schema/verification.js';
import type { CertType, FlagType } from '@oakvale/shared/enums/verification.js';

export async function addCpdRecord(workerId: string, input: CpdRecordInput) {
  const [row] = await db
    .insert(cpdRecords)
    .values({
      workerId,
      courseName: input.courseName,
      provider: input.provider,
      completedAt: input.completedAt,
      expiresAt: input.expiresAt ?? null,
      hoursCompleted: input.hoursCompleted != null ? String(input.hoursCompleted) : null,
      certificateDocumentId: input.certificateDocumentId ?? null,
    })
    .returning();
  // Phase 12: keep workers.cpd_total_hours current for cpd-hours search facet
  void (await import('@/modules/workers/service.js')).recomputeCpdHours(workerId);
  return row;
}

export async function listCpdRecords(workerId: string) {
  return db
    .select()
    .from(cpdRecords)
    .where(eq(cpdRecords.workerId, workerId))
    .orderBy(desc(cpdRecords.completedAt));
}

export async function verifyCpdRecord(recordId: string, reviewerUserId: string) {
  const updated = await db
    .update(cpdRecords)
    .set({ verifiedByOakvale: true, verifiedAt: new Date(), verifiedBy: reviewerUserId })
    .where(eq(cpdRecords.id, recordId))
    .returning();
  if (updated.length === 0) {
    throw new AppError({
      code: 'CPD_RECORD_NOT_FOUND',
      message: 'CPD record not found.',
      statusCode: 404,
    });
  }
}

export async function addCertification(workerId: string, input: CertificationInput) {
  const isOakvale =
    input.certType === 'OAKVALE_FOUNDATION' || input.certType === 'OAKVALE_ADVANCED';
  const [row] = await db
    .insert(certifications)
    .values({
      workerId,
      certType: input.certType,
      certNumber: input.certNumber,
      issuedBy: input.issuedBy,
      issuedAt: input.issuedAt,
      expiresAt: input.expiresAt ?? null,
      certificateDocumentId: input.certificateDocumentId ?? null,
      isOakvaleCert: isOakvale,
    })
    .returning();
  // No visibility-gate event here: a new cert starts PENDING and only counts toward the
  // Oakvale-certified gate once an admin approves it (see reviewCertification).
  return row;
}

export async function reviewCertification(
  certificationId: string,
  input: CertificationReviewInput & { reviewerUserId: string },
) {
  const [row] = await db
    .update(certifications)
    .set({
      verificationStatus: input.decision,
      reviewedAt: new Date(),
      reviewedBy: input.reviewerUserId,
      reviewNote: input.note ?? null,
    })
    .where(eq(certifications.id, certificationId))
    .returning();
  if (!row) {
    throw new AppError({
      code: 'CERTIFICATION_NOT_FOUND',
      message: 'Certification not found.',
      statusCode: 404,
    });
  }
  // Approving an Oakvale cert can complete the visibility gate for a reviewed worker.
  if (input.decision === 'APPROVED' && row.isOakvaleCert) {
    events.emit('worker.certificationAdded', { workerId: row.workerId });
  }
  return row;
}

export async function listCertifications(workerId: string) {
  return db
    .select()
    .from(certifications)
    .where(eq(certifications.workerId, workerId))
    .orderBy(desc(certifications.issuedAt));
}

export interface CertSubmissionRow {
  certificationId: string;
  workerId: string;
  fullName: string | null;
  email: string;
  phone: string | null;
  certType: CertType;
  certNumber: string | null;
  issuedBy: string;
  issuedAt: string;
  expiresAt: string | null;
  isOakvaleCert: boolean;
  certificateDocumentId: string | null;
  hasDocument: boolean;
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedAt: Date | null;
  reviewNote: string | null;
  submittedAt: Date;
}

/**
 * Admin cross-check list (brief §3): every certificate submission with the worker's
 * name, email and phone so admins can reconcile against Oakvale's internal list of
 * certified students in bulk — rather than opening each worker one-by-one. `oakvaleOnly`
 * narrows to Oakvale certificates (the ones that drive the visibility gate).
 */
export async function adminListCertSubmissions(opts: {
  q?: string;
  oakvaleOnly?: boolean;
  page: number;
  limit: number;
}): Promise<CertSubmissionRow[]> {
  const conds = [];
  if (opts.oakvaleOnly) conds.push(eq(certifications.isOakvaleCert, true));
  if (opts.q) {
    const like = `%${opts.q}%`;
    conds.push(
      or(
        ilike(workerPersonalInfo.fullName, like),
        ilike(users.email, like),
        ilike(certifications.issuedBy, like),
      ),
    );
  }
  const rows = await db
    .select({
      certificationId: certifications.id,
      workerId: certifications.workerId,
      fullName: workerPersonalInfo.fullName,
      email: users.email,
      phone: users.phone,
      certType: certifications.certType,
      certNumber: certifications.certNumber,
      issuedBy: certifications.issuedBy,
      issuedAt: certifications.issuedAt,
      expiresAt: certifications.expiresAt,
      isOakvaleCert: certifications.isOakvaleCert,
      certificateDocumentId: certifications.certificateDocumentId,
      verificationStatus: certifications.verificationStatus,
      reviewedAt: certifications.reviewedAt,
      reviewNote: certifications.reviewNote,
      submittedAt: certifications.createdAt,
    })
    .from(certifications)
    .innerJoin(workers, eq(workers.id, certifications.workerId))
    .innerJoin(users, eq(users.id, workers.userId))
    .leftJoin(workerPersonalInfo, eq(workerPersonalInfo.workerId, certifications.workerId))
    .where(conds.length ? and(...conds) : sql`true`)
    .orderBy(desc(certifications.createdAt))
    .limit(opts.limit)
    .offset((opts.page - 1) * opts.limit);

  return rows.map((r) => ({
    ...r,
    hasDocument: r.certificateDocumentId !== null,
  }));
}

export async function raiseFlag(input: FlagCreateInput & { raisedBy: string }) {
  const [row] = await db
    .insert(complianceFlags)
    .values({
      workerId: input.workerId,
      flagType: input.flagType,
      severity: input.severity,
      raisedBy: input.raisedBy,
      details: input.details,
    })
    .returning();
  if (!row) {
    throw new AppError({ code: 'INTERNAL_ERROR', message: 'Failed to create flag', statusCode: 500 });
  }
  events.emit('worker.flagged', {
    workerId: input.workerId,
    flagType: input.flagType,
    severity: input.severity,
    flagId: row.id,
  });
  void recordAudit({
    actorId: input.raisedBy,
    action: 'flag.raise',
    targetType: 'worker',
    targetId: input.workerId,
    metadata: { flagId: row.id, flagType: input.flagType, severity: input.severity },
  });
  return row;
}

export async function resolveFlag(flagId: string, reviewerUserId: string) {
  const updated = await db
    .update(complianceFlags)
    .set({ resolvedAt: new Date(), resolvedBy: reviewerUserId })
    .where(eq(complianceFlags.id, flagId))
    .returning();
  if (updated.length === 0) {
    throw new AppError({ code: 'FLAG_NOT_FOUND', message: 'Flag not found.', statusCode: 404 });
  }
  void recordAudit({
    actorId: reviewerUserId,
    action: 'flag.resolve',
    targetType: 'flag',
    targetId: flagId,
  });
}

export async function listFlags(opts: { onlyActive: boolean; page: number; limit: number }) {
  const offset = (opts.page - 1) * opts.limit;
  const where = opts.onlyActive ? isNull(complianceFlags.resolvedAt) : undefined;
  const rows = await db
    .select({
      id: complianceFlags.id,
      workerId: complianceFlags.workerId,
      fullName: workerPersonalInfo.fullName,
      flagType: complianceFlags.flagType,
      severity: complianceFlags.severity,
      raisedAt: complianceFlags.raisedAt,
      resolvedAt: complianceFlags.resolvedAt,
      details: complianceFlags.details,
    })
    .from(complianceFlags)
    .leftJoin(workerPersonalInfo, eq(workerPersonalInfo.workerId, complianceFlags.workerId))
    .where(where)
    .orderBy(desc(complianceFlags.raisedAt))
    .limit(opts.limit)
    .offset(offset);
  return rows;
}

/** Phase 2 visibility gate. Delegates to the unified gate in visibility.ts. */
export async function isWorkerVisible(workerId: string): Promise<boolean> {
  return (await visibleWorkerIds([workerId])).has(workerId);
}

/**
 * Requirements derived from the worker's assigned workforce category (§4.4).
 * Certifications hold no free-text name (only certType/issuedBy/isOakvaleCert),
 * so cert matching is a coarse proxy: a required Oakvale certification counts as
 * "met" when the worker holds any active Oakvale certification. Finer-grained
 * matching needs the LMS link (deferred — brief Open Question #1).
 */
export interface CategoryRequirements {
  categoryId: string;
  categoryName: string;
  requiredCertifications: { name: string; met: boolean }[];
  requiredIdentityFields: string[];
  requiredComplianceFields: string[];
}

export interface ComplianceStatus {
  cpdRecords: Awaited<ReturnType<typeof listCpdRecords>>;
  certifications: Awaited<ReturnType<typeof listCertifications>>;
  oakvaleCertified: boolean;
  categoryRequirements: CategoryRequirements | null;
  activeFlags: {
    id: string;
    flagType: FlagType;
    severity: string;
    raisedAt: Date;
    details: string;
  }[];
}

async function getCategoryRequirements(
  workerId: string,
  oakvaleCertified: boolean,
): Promise<CategoryRequirements | null> {
  const worker = await db.query.workers.findFirst({ where: eq(workers.id, workerId) });
  if (!worker?.workforceCategoryId) return null;
  const category = await db.query.workforceCategories.findFirst({
    where: eq(workforceCategories.id, worker.workforceCategoryId),
  });
  if (!category) return null;
  return {
    categoryId: category.id,
    categoryName: category.name,
    // Coarse proxy until LMS link exists (see interface doc above).
    requiredCertifications: category.requiredCertifications.map((rc) => ({
      name: rc.name,
      met: oakvaleCertified,
    })),
    requiredIdentityFields: category.requiredIdentityFields,
    requiredComplianceFields: category.requiredComplianceFields,
  };
}

export async function getStatusFor(workerId: string): Promise<ComplianceStatus> {
  const [recs, certs, flags] = await Promise.all([
    listCpdRecords(workerId),
    listCertifications(workerId),
    db
      .select({
        id: complianceFlags.id,
        flagType: complianceFlags.flagType,
        severity: complianceFlags.severity,
        raisedAt: complianceFlags.raisedAt,
        details: complianceFlags.details,
      })
      .from(complianceFlags)
      .where(and(eq(complianceFlags.workerId, workerId), isNull(complianceFlags.resolvedAt))),
  ]);
  const oakvaleCertified = certs.some(
    (c) =>
      c.isOakvaleCert &&
      c.verificationStatus === 'APPROVED' &&
      (!c.expiresAt || new Date(c.expiresAt) > new Date()),
  );
  const categoryRequirements = await getCategoryRequirements(workerId, oakvaleCertified);
  return {
    cpdRecords: recs,
    certifications: certs,
    oakvaleCertified,
    categoryRequirements,
    activeFlags: flags,
  };
}

/** Used by the daily cron. */
export async function findCertsExpiringWithinDays(days: number) {
  const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  return db
    .select()
    .from(certifications)
    .where(and(gt(certifications.expiresAt, today), lte(certifications.expiresAt, cutoff)));
}

export type { CertType };
