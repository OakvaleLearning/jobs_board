import { Worker } from 'bullmq';
import { loadEnv } from '@/shared/config/env.js';
import { logger } from '@/shared/logger/logger.js';
import { queues } from '@/shared/queue/queues.js';
import { db } from '@/shared/db/client.js';
import { employers, users } from '@/shared/db/schema.js';
import { eq } from 'drizzle-orm';
import * as paymentsService from '@/modules/payments/service.js';
import * as employersService from '@/modules/employers/service.js';
import * as notifications from '../service.js';
import { bandFor, overdueDays } from '../dunning-bands.js';

export async function runDunningSweep(now: Date = new Date()): Promise<{
  scanned: number;
  enqueued: number;
  flaggedPastDue: number;
}> {
  const overdue = await paymentsService.listOverdueCorporate();
  let enqueued = 0;
  let flaggedPastDue = 0;
  for (const inv of overdue) {
    if (!inv.dueAt) continue;
    const days = overdueDays(inv.dueAt as unknown as Date, now);
    const band = bandFor(days);
    if (!band) continue;
    const idempotencyKey = `dunning:${inv.id}:day${band.day}`;
    const employer = await db.query.employers.findFirst({ where: eq(employers.id, inv.employerId) });
    const primary = await employersService.getPrimaryContact(inv.employerId);
    const employerName = employer?.orgName ?? primary?.name ?? 'Customer';
    if (band.admin) {
      // Recipient: admins (one notification per admin user, all sharing the idempotency key)
      const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, 'ADMIN'));
      for (const a of admins) {
        const row = await notifications.enqueue({
          userId: a.id,
          kind: 'invoice_overdue_day14_admin',
          channel: 'IN_APP',
          payload: { invoiceId: inv.id, employerName },
          idempotencyKey,
        });
        if (row) enqueued += 1;
      }
      await paymentsService.markPastDue(inv.id);
      flaggedPastDue += 1;
    } else {
      const row = await notifications.enqueue({
        userId: employer?.userId ?? '',
        kind: band.kind as 'invoice_overdue_day1' | 'invoice_overdue_day7',
        channel: 'EMAIL',
        payload: { invoiceId: inv.id, employerName },
        idempotencyKey,
      });
      if (row) enqueued += 1;
    }
  }
  return { scanned: overdue.length, enqueued, flaggedPastDue };
}

export async function registerDunningScheduler() {
  await queues.dunning.upsertJobScheduler('dunning-daily', { pattern: '0 6 * * *' }, {
    name: 'sweep',
    data: {},
  });
}

export function startDunningWorker() {
  const env = loadEnv();
  const worker = new Worker(
    'dunning',
    async () => {
      const result = await runDunningSweep();
      logger.info(result, 'dunning sweep complete');
    },
    { connection: { url: env.REDIS_URL }, concurrency: 1 },
  );
  worker.on('failed', (job, err) => {
    logger.warn({ jobId: job?.id, err }, 'dunning worker failed');
  });
  return worker;
}

export { bandFor, overdueDays };

