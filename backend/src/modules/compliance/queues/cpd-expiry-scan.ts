import { Worker } from 'bullmq';
import { queues } from '@/shared/queue/queues.js';
import { loadEnv } from '@/shared/config/env.js';
import { logger } from '@/shared/logger/logger.js';
import { findCertsExpiringWithinDays } from '../service.js';

const env = loadEnv();
const SCHEDULER_ID = 'cpd-daily-scan';
const EVERY_24H_MS = 24 * 60 * 60 * 1000;

export async function registerCpdExpiryScheduler(): Promise<void> {
  await queues.cpdReminders.upsertJobScheduler(
    SCHEDULER_ID,
    { every: EVERY_24H_MS },
    { name: 'cpd-daily-scan', data: {} },
  );
  logger.info({ schedulerId: SCHEDULER_ID }, 'CPD expiry scheduler registered (daily)');
}

export function startCpdExpiryWorker(): Worker {
  return new Worker(
    'cpd-reminders',
    async () => {
      const expiring = await findCertsExpiringWithinDays(60);
      logger.info({ count: expiring.length }, 'CPD expiry scan: certifications expiring in ≤60 days');
      const seen = new Set<string>();
      for (const cert of expiring) {
        if (seen.has(cert.workerId)) continue;
        seen.add(cert.workerId);
        await queues.notifications.add('cpd-expiry-warning', {
          template: 'cpd-expiry-warning',
          workerId: cert.workerId,
          certId: cert.id,
          expiresAt: cert.expiresAt,
        });
      }
    },
    { connection: { url: env.REDIS_URL }, concurrency: 1 },
  );
}
