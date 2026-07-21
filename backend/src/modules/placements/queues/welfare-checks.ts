import { Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import { placements, welfareChecks } from '@/shared/db/schema.js';
import { queues } from '@/shared/queue/queues.js';
import { loadEnv } from '@/shared/config/env.js';
import { logger } from '@/shared/logger/logger.js';
import { getEscalationOrThrow, markOverdueNotified } from '../welfare-escalations.js';
import * as notifications from '@/modules/notifications/service.js';

const env = loadEnv();

export function startWelfareCheckWorker(): Worker {
  return new Worker(
    'welfare-checks',
    async (job) => {
      if (job.name === 'welfare-escalation-overdue') {
        const { escalationId } = job.data as { escalationId: string };
        const row = await getEscalationOrThrow(escalationId);
        if (row.resolvedAt) {
          logger.info({ escalationId }, 'welfare escalation already resolved, skipping overdue');
          return;
        }
        await markOverdueNotified(escalationId);
        await notifications.enqueueForRole('ADMIN', {
          kind: 'welfare_escalation_overdue',
          channel: 'EMAIL',
          payload: { placementId: row.placementId, severity: row.severity },
          idempotencyKey: `welfare-overdue-${escalationId}`,
        });
        await notifications.enqueueForRole('ADMIN', {
          kind: 'welfare_escalation_overdue',
          channel: 'IN_APP',
          payload: { placementId: row.placementId, severity: row.severity },
          idempotencyKey: `welfare-overdue-inapp-${escalationId}`,
        });
        logger.warn({ escalationId, placementId: row.placementId }, 'welfare escalation OVERDUE');
        return;
      }
      const { placementId } = job.data as { placementId: string };
      const p = await db.query.placements.findFirst({ where: eq(placements.id, placementId) });
      if (!p || p.status !== 'ACTIVE') {
        logger.info({ placementId, status: p?.status }, 'welfare-check skipped (not active)');
        return;
      }
      await db.insert(welfareChecks).values({
        placementId,
        scheduledAt: new Date(),
      });
      await queues.notifications.add('welfare-check-due', {
        template: 'welfare-check-due',
        placementId,
      });
      logger.info({ placementId }, 'welfare-check scheduled');
    },
    { connection: { url: env.REDIS_URL }, concurrency: 1 },
  );
}
