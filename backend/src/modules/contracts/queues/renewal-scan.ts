import { Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import { employers } from '@/shared/db/schema.js';
import { queues } from '@/shared/queue/queues.js';
import { loadEnv } from '@/shared/config/env.js';
import { logger } from '@/shared/logger/logger.js';
import { events } from '@/shared/events/bus.js';
import * as notifications from '@/modules/notifications/service.js';
import { listLapsedPartnerships, listRenewalCandidates } from '../renewal.js';

const env = loadEnv();
const SCHEDULER_ID = 'contract-renewal-scan';
const DAILY_CRON = '0 8 * * *';
const REMINDER_WINDOW_DAYS = 60;
const LAPSE_GRACE_DAYS = 30;
const REMINDER_DEDUP_WINDOW_DAYS = 14;

export async function registerRenewalScanScheduler(): Promise<void> {
  await queues.contractRenewals.upsertJobScheduler(
    SCHEDULER_ID,
    { pattern: DAILY_CRON },
    { name: 'renewal-scan', data: {} },
  );
  logger.info({ schedulerId: SCHEDULER_ID }, 'contract renewal scheduler registered');
}

async function notifyEmployerUser(
  employerId: string | null,
  payload: Record<string, string | number>,
  kind: 'contract_renewal_due',
  dedupKey: string,
): Promise<void> {
  if (!employerId) return;
  const e = await db.query.employers.findFirst({ where: eq(employers.id, employerId) });
  if (!e) return;
  await notifications.enqueue({
    userId: e.userId,
    kind,
    channel: 'EMAIL',
    payload,
    idempotencyKey: dedupKey,
  });
  await notifications.enqueue({
    userId: e.userId,
    kind,
    channel: 'IN_APP',
    payload,
    idempotencyKey: `${dedupKey}-inapp`,
  });
}

async function runScan(): Promise<{ upcoming: number; lapsed: number }> {
  const upcoming = await listRenewalCandidates({ withinDays: REMINDER_WINDOW_DAYS });
  for (const { contract, daysUntilExpiry } of upcoming) {
    const bucket = Math.floor(daysUntilExpiry / REMINDER_DEDUP_WINDOW_DAYS);
    const dedupKey = `renewal-due-${contract.id}-bucket-${bucket}`;
    await notifyEmployerUser(
      contract.employerId,
      { contractId: contract.id, daysUntilExpiry },
      'contract_renewal_due',
      dedupKey,
    );
    events.emit('contract.renewalDue', {
      contractId: contract.id,
      employerId: contract.employerId,
      daysUntilExpiry,
    });
  }

  const lapsed = await listLapsedPartnerships({ gracePeriodDays: LAPSE_GRACE_DAYS });
  for (const c of lapsed) {
    const dedupKey = `partnership-lapsed-${c.id}`;
    const e = c.employerId
      ? await db.query.employers.findFirst({ where: eq(employers.id, c.employerId) })
      : null;
    const employerName = e?.orgName ?? 'an employer';
    await notifications.enqueueForRole('ADMIN', {
      kind: 'partnership_lapsed',
      channel: 'EMAIL',
      payload: { contractId: c.id, employerName },
      idempotencyKey: dedupKey,
    });
    await notifications.enqueueForRole('ADMIN', {
      kind: 'partnership_lapsed',
      channel: 'IN_APP',
      payload: { contractId: c.id, employerName },
      idempotencyKey: `${dedupKey}-inapp`,
    });
    events.emit('partnership.lapsed', { contractId: c.id, employerId: c.employerId });
  }

  return { upcoming: upcoming.length, lapsed: lapsed.length };
}

export function startRenewalScanWorker(): Worker {
  return new Worker(
    'contract-renewals',
    async () => {
      const stats = await runScan();
      logger.info(stats, 'contract renewal scan complete');
    },
    { connection: { url: env.REDIS_URL }, concurrency: 1 },
  );
}

// Test-only export
export const _internal = { runScan };
