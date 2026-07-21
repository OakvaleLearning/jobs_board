import { Worker } from 'bullmq';
import { queues } from '@/shared/queue/queues.js';
import { loadEnv } from '@/shared/config/env.js';
import { logger } from '@/shared/logger/logger.js';
import { scanSlaBreaches } from '../service.js';

const env = loadEnv();
const SCAN_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const SCHEDULER_ID = 'replacement-sla-scan';

export async function registerReplacementSlaScheduler(): Promise<void> {
  await queues.replacementSla.upsertJobScheduler(
    SCHEDULER_ID,
    { every: SCAN_INTERVAL_MS },
    { name: 'sla-scan', data: {} },
  );
  logger.info({ schedulerId: SCHEDULER_ID }, 'replacement-SLA scan scheduler registered');
}

export function startReplacementSlaWorker(): Worker {
  return new Worker(
    'replacement-sla',
    async () => {
      const { warningCount } = await scanSlaBreaches();
      logger.info({ warningCount }, 'replacement-SLA scan complete');
    },
    { connection: { url: env.REDIS_URL }, concurrency: 1 },
  );
}
