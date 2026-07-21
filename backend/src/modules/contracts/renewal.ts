import { and, asc, eq, gte, isNull, lte } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import { contractAmendments, contracts } from '@/shared/db/schema.js';
import { AppError } from '@/shared/errors/app-error.js';
import { amendContract } from './service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RenewalCandidate {
  contract: typeof contracts.$inferSelect;
  daysUntilExpiry: number;
}

export async function listRenewalCandidates(opts: {
  withinDays: number;
}): Promise<RenewalCandidate[]> {
  const now = new Date();
  const horizon = new Date(now.getTime() + opts.withinDays * DAY_MS);
  const rows = await db
    .select()
    .from(contracts)
    .where(
      and(
        eq(contracts.type, 'ANNUAL_PARTNERSHIP'),
        eq(contracts.status, 'FULLY_EXECUTED'),
        gte(contracts.expiresAt, now),
        lte(contracts.expiresAt, horizon),
        isNull(contracts.supersededById),
      ),
    )
    .orderBy(asc(contracts.expiresAt));
  return rows.map((c) => ({
    contract: c,
    daysUntilExpiry: c.expiresAt
      ? Math.max(0, Math.ceil((c.expiresAt.getTime() - now.getTime()) / DAY_MS))
      : 0,
  }));
}

export async function listLapsedPartnerships(opts: { gracePeriodDays: number }) {
  const cutoff = new Date(Date.now() - opts.gracePeriodDays * DAY_MS);
  return db
    .select()
    .from(contracts)
    .where(
      and(
        eq(contracts.type, 'ANNUAL_PARTNERSHIP'),
        eq(contracts.status, 'FULLY_EXECUTED'),
        lte(contracts.expiresAt, cutoff),
        isNull(contracts.supersededById),
      ),
    );
}

export async function previewRenewal(originalContractId: string) {
  const original = await db.query.contracts.findFirst({
    where: eq(contracts.id, originalContractId),
  });
  if (!original) {
    throw new AppError({
      code: 'CONTRACT_NOT_FOUND',
      message: 'Contract not found',
      statusCode: 404,
    });
  }
  if (original.type !== 'ANNUAL_PARTNERSHIP') {
    throw new AppError({
      code: 'RENEWAL_NOT_AVAILABLE',
      message: 'Only ANNUAL_PARTNERSHIP contracts can be renewed.',
      statusCode: 409,
    });
  }
  const currentEnd = original.expiresAt ?? new Date();
  const proposedStart = new Date(currentEnd.getTime() + DAY_MS);
  const proposedEnd = new Date(proposedStart.getTime() + 365 * DAY_MS);
  return {
    originalContractId,
    proposedStart: proposedStart.toISOString().slice(0, 10),
    proposedEnd: proposedEnd.toISOString().slice(0, 10),
    employerId: original.employerId,
  };
}

export async function createRenewal(opts: {
  originalContractId: string;
  newPeriodStart: string;
  newPeriodEnd: string;
  initiatedBy: string;
}) {
  const original = await db.query.contracts.findFirst({
    where: eq(contracts.id, opts.originalContractId),
  });
  if (!original) {
    throw new AppError({
      code: 'CONTRACT_NOT_FOUND',
      message: 'Contract not found',
      statusCode: 404,
    });
  }
  if (original.type !== 'ANNUAL_PARTNERSHIP') {
    throw new AppError({
      code: 'RENEWAL_NOT_AVAILABLE',
      message: 'Only ANNUAL_PARTNERSHIP contracts can be renewed.',
      statusCode: 409,
    });
  }

  return amendContract({
    originalContractId: original.id,
    changedTerms: {
      'partnership.periodStart': opts.newPeriodStart,
      'partnership.periodEnd': opts.newPeriodEnd,
    },
    reason: `Annual renewal: ${opts.newPeriodStart} → ${opts.newPeriodEnd}`,
    initiatedBy: opts.initiatedBy,
    kind: 'RENEWAL',
    expiresAt: opts.newPeriodEnd,
  });
}

export async function reminderAlreadySentRecently(
  contractId: string,
  withinDays: number,
): Promise<boolean> {
  // Look in contract_amendments for a recent RENEWAL entry — if we already created one, no reminder needed.
  // Otherwise, we rely on notifications.enqueue's idempotencyKey to dedupe at the notification layer.
  const cutoff = new Date(Date.now() - withinDays * DAY_MS);
  const recent = await db
    .select()
    .from(contractAmendments)
    .where(
      and(
        eq(contractAmendments.originalContractId, contractId),
        gte(contractAmendments.createdAt, cutoff),
      ),
    )
    .limit(1);
  return recent.length > 0;
}
