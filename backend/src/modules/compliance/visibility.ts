import { and, eq, gt, gte, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { db } from '@/shared/db/client.js';
import {
  certifications,
  complianceFlags,
  verificationRequests,
  workers,
} from '@/shared/db/schema.js';

/**
 * Brief §6.1: a worker is visible to employers iff they hold an active,
 * admin-APPROVED Oakvale certification (expires_at IS NULL = non-expiring, counts
 * as active), they have no unresolved SAFEGUARDING flag, their profile is at least
 * 70% complete, and their identity verification has been approved (latest IDENTITY
 * request VERIFIED).
 *
 * Brief §3: an uploaded Oakvale certificate only counts toward the gate once an
 * admin has reviewed and approved it (certifications.verification_status).
 *
 * The background check is ADVISORY — it surfaces as a badge but no longer gates
 * visibility (admin-reviewed document submission).
 *
 * The compliance module owns these tables; other modules compose the gate
 * into their queries via the fragments below instead of referencing the
 * tables directly.
 */

/** Minimum profile completion (%) before a worker is searchable (§6.1). */
export const VISIBILITY_MIN_COMPLETION_PCT = 70;

/** Gate as individual conditions, for spreading into `and(...)` in a Drizzle query. */
export function visibilityGateConds(workerIdCol: AnyPgColumn | SQL): SQL[] {
  return [
    sql`EXISTS (SELECT 1 FROM certifications c WHERE c.worker_id = ${workerIdCol} AND c.is_oakvale_cert = true AND c.verification_status = 'APPROVED' AND (c.expires_at IS NULL OR c.expires_at > now()))`,
    sql`NOT EXISTS (SELECT 1 FROM compliance_flags cf WHERE cf.worker_id = ${workerIdCol} AND cf.flag_type = 'SAFEGUARDING' AND cf.resolved_at IS NULL)`,
    sql`EXISTS (SELECT 1 FROM workers w WHERE w.id = ${workerIdCol} AND w.profile_completion_pct >= ${VISIBILITY_MIN_COMPLETION_PCT})`,
    sql`EXISTS (SELECT 1 FROM verification_requests vr WHERE vr.worker_id = ${workerIdCol} AND vr.request_type = 'IDENTITY' AND vr.status = 'VERIFIED')`,
  ];
}

/** Gate as a single AND-joined fragment, for interpolation into raw SQL. */
export function visibilityGateSql(workerIdCol: AnyPgColumn | SQL): SQL {
  return sql.join(visibilityGateConds(workerIdCol), sql` AND `);
}

/** Batch gate: the subset of `workerIds` that pass the visibility gate. */
export interface VisibilityGate {
  identityVerified: boolean;
  oakvaleCertified: boolean;
  completionOk: boolean;
  noSafeguarding: boolean;
  visible: boolean;
}

/**
 * Per-condition breakdown of the visibility gate for a single worker, so the
 * admin review UI can explain exactly why a worker is (not) yet visible. Uses
 * the same four conditions as {@link visibleWorkerIds}; `visible` is their AND.
 */
export async function workerVisibilityGate(workerId: string): Promise<VisibilityGate> {
  const [certRow, flagRow, completeRow, identityRow] = await Promise.all([
    db
      .select({ workerId: certifications.workerId })
      .from(certifications)
      .where(
        and(
          eq(certifications.workerId, workerId),
          eq(certifications.isOakvaleCert, true),
          eq(certifications.verificationStatus, 'APPROVED'),
          or(isNull(certifications.expiresAt), gt(certifications.expiresAt, sql`now()`)),
        ),
      )
      .limit(1),
    db
      .select({ workerId: complianceFlags.workerId })
      .from(complianceFlags)
      .where(
        and(
          eq(complianceFlags.workerId, workerId),
          eq(complianceFlags.flagType, 'SAFEGUARDING'),
          isNull(complianceFlags.resolvedAt),
        ),
      )
      .limit(1),
    db
      .select({ workerId: workers.id })
      .from(workers)
      .where(and(eq(workers.id, workerId), gte(workers.profileCompletionPct, VISIBILITY_MIN_COMPLETION_PCT)))
      .limit(1),
    db
      .select({ workerId: verificationRequests.workerId })
      .from(verificationRequests)
      .where(
        and(
          eq(verificationRequests.workerId, workerId),
          eq(verificationRequests.requestType, 'IDENTITY'),
          eq(verificationRequests.status, 'VERIFIED'),
        ),
      )
      .limit(1),
  ]);

  const identityVerified = identityRow.length > 0;
  const oakvaleCertified = certRow.length > 0;
  const completionOk = completeRow.length > 0;
  const noSafeguarding = flagRow.length === 0;
  return {
    identityVerified,
    oakvaleCertified,
    completionOk,
    noSafeguarding,
    visible: identityVerified && oakvaleCertified && completionOk && noSafeguarding,
  };
}

/** Batch gate: the subset of `workerIds` that pass the visibility gate. */
export async function visibleWorkerIds(workerIds: string[]): Promise<Set<string>> {
  if (workerIds.length === 0) return new Set();

  const [certRows, flaggedRows, completeRows, identityRows] = await Promise.all([
    db
      .select({ workerId: certifications.workerId })
      .from(certifications)
      .where(
        and(
          inArray(certifications.workerId, workerIds),
          eq(certifications.isOakvaleCert, true),
          eq(certifications.verificationStatus, 'APPROVED'),
          or(isNull(certifications.expiresAt), gt(certifications.expiresAt, sql`now()`)),
        ),
      ),
    db
      .select({ workerId: complianceFlags.workerId })
      .from(complianceFlags)
      .where(
        and(
          inArray(complianceFlags.workerId, workerIds),
          eq(complianceFlags.flagType, 'SAFEGUARDING'),
          isNull(complianceFlags.resolvedAt),
        ),
      ),
    db
      .select({ workerId: workers.id })
      .from(workers)
      .where(
        and(
          inArray(workers.id, workerIds),
          gte(workers.profileCompletionPct, VISIBILITY_MIN_COMPLETION_PCT),
        ),
      ),
    db
      .select({ workerId: verificationRequests.workerId })
      .from(verificationRequests)
      .where(
        and(
          inArray(verificationRequests.workerId, workerIds),
          eq(verificationRequests.requestType, 'IDENTITY'),
          eq(verificationRequests.status, 'VERIFIED'),
        ),
      ),
  ]);

  const flagged = new Set(flaggedRows.map((r) => r.workerId));
  const complete = new Set(completeRows.map((r) => r.workerId));
  const identityVerified = new Set(identityRows.map((r) => r.workerId));
  const visible = new Set<string>();
  for (const { workerId } of certRows) {
    if (complete.has(workerId) && identityVerified.has(workerId) && !flagged.has(workerId)) {
      visible.add(workerId);
    }
  }
  return visible;
}
