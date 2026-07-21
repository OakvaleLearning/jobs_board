import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import {
  payrollRuns,
  placementOffers,
  placements,
  workerPayouts,
} from '@/shared/db/schema.js';
import { AppError } from '@/shared/errors/app-error.js';
import { events } from '@/shared/events/bus.js';
import { recordAudit } from '@/shared/audit/record.js';
import type {
  MarkPayoutPaidInput,
  PayrollRunCreateInput,
} from '@oakvale/shared/schema/payroll.js';

/**
 * §14.2 Payroll. Internal NGN worker-payout ledger — Business Rule #6: this module
 * ONLY touches payroll_runs / worker_payouts / (read-only) placements + offers. It must
 * never write to the employer-facing invoices/payments tables. There is no live bank
 * rail at launch (§10.1); an admin marks payouts paid once the NGN transfer is made.
 */

export async function createRun(input: PayrollRunCreateInput, createdBy: string) {
  const [row] = await db
    .insert(payrollRuns)
    .values({
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      createdBy,
    })
    .returning();
  if (!row) throw new AppError({ code: 'INTERNAL_ERROR', message: 'Failed to create run.', statusCode: 500 });
  void recordAudit({ actorId: createdBy, action: 'payroll.runCreated', targetType: 'payroll_run', targetId: row.id });
  return row;
}

export async function listRuns() {
  return db.select().from(payrollRuns).orderBy(desc(payrollRuns.createdAt));
}

async function getRunOrThrow(runId: string) {
  const run = await db.query.payrollRuns.findFirst({ where: eq(payrollRuns.id, runId) });
  if (!run) throw new AppError({ code: 'NOT_FOUND', message: 'Payroll run not found.', statusCode: 404 });
  return run;
}

export async function listPayouts(runId: string) {
  return db
    .select()
    .from(workerPayouts)
    .where(eq(workerPayouts.payrollRunId, runId))
    .orderBy(desc(workerPayouts.createdAt));
}

/**
 * Build payouts for a DRAFT run from currently ACTIVE placements, using the worker's
 * agreed salary from their accepted offer. NGN-only: salaries quoted in GBP/USD belong
 * to the cross-border employer ledger, not this internal payout run, so they're skipped.
 */
export async function generatePayouts(runId: string) {
  const run = await getRunOrThrow(runId);
  if (run.status !== 'DRAFT') {
    throw new AppError({ code: 'CONFLICT', message: 'Only draft runs can be (re)generated.', statusCode: 409 });
  }
  const active = await db
    .select({ id: placements.id, workerId: placements.workerId, employerId: placements.employerId })
    .from(placements)
    .where(eq(placements.status, 'ACTIVE'));
  if (active.length === 0) return [];

  // Clear any prior draft lines so regeneration is idempotent.
  await db.delete(workerPayouts).where(eq(workerPayouts.payrollRunId, runId));

  const rows: (typeof workerPayouts.$inferInsert)[] = [];
  const seen = new Set<string>();
  for (const p of active) {
    if (seen.has(p.workerId)) continue; // one payout per worker per run
    const offer = await db.query.placementOffers.findFirst({
      where: and(
        eq(placementOffers.workerId, p.workerId),
        eq(placementOffers.employerId, p.employerId),
        eq(placementOffers.status, 'ACCEPTED'),
      ),
      orderBy: desc(placementOffers.acceptedAt),
    });
    if (!offer || offer.salaryCurrency !== 'NGN') continue;
    seen.add(p.workerId);
    rows.push({
      payrollRunId: runId,
      workerId: p.workerId,
      placementId: p.id,
      currency: 'NGN',
      amountMinor: offer.salaryAmountMinor,
    });
  }
  if (rows.length === 0) return [];
  return db.insert(workerPayouts).values(rows).returning();
}

export async function approveRun(runId: string, actorId: string) {
  const run = await getRunOrThrow(runId);
  if (run.status !== 'DRAFT') {
    throw new AppError({ code: 'CONFLICT', message: 'Only draft runs can be approved.', statusCode: 409 });
  }
  const [updated] = await db
    .update(payrollRuns)
    .set({ status: 'APPROVED', approvedAt: new Date() })
    .where(eq(payrollRuns.id, runId))
    .returning();
  void recordAudit({ actorId, action: 'payroll.runApproved', targetType: 'payroll_run', targetId: runId });
  return updated;
}

export async function markPayoutPaid(payoutId: string, actorId: string, input: MarkPayoutPaidInput) {
  const payout = await db.query.workerPayouts.findFirst({ where: eq(workerPayouts.id, payoutId) });
  if (!payout) throw new AppError({ code: 'NOT_FOUND', message: 'Payout not found.', statusCode: 404 });
  const run = await getRunOrThrow(payout.payrollRunId);
  if (run.status === 'DRAFT') {
    throw new AppError({ code: 'CONFLICT', message: 'Approve the run before paying out.', statusCode: 409 });
  }
  if (payout.status === 'PAID') return payout;

  const [updated] = await db
    .update(workerPayouts)
    .set({
      status: 'PAID',
      paidAt: new Date(),
      reference: input.reference ?? null,
      notes: input.notes ?? null,
    })
    .where(eq(workerPayouts.id, payoutId))
    .returning();

  // Flip the run to PAID once every line is settled.
  const remaining = await db
    .select({ id: workerPayouts.id })
    .from(workerPayouts)
    .where(and(eq(workerPayouts.payrollRunId, run.id), eq(workerPayouts.status, 'PENDING')));
  if (remaining.length === 0) {
    await db.update(payrollRuns).set({ status: 'PAID' }).where(eq(payrollRuns.id, run.id));
  }

  void recordAudit({
    actorId,
    action: 'payroll.payoutPaid',
    targetType: 'worker_payout',
    targetId: payoutId,
    metadata: { amountMinor: payout.amountMinor, currency: payout.currency },
  });
  events.emit('payroll.payoutPaid', {
    payoutId,
    workerId: payout.workerId,
    amountMinor: payout.amountMinor,
    period: `${run.periodStart} – ${run.periodEnd}`,
  });
  return updated;
}
