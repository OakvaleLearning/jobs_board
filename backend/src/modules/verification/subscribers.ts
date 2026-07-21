import { eq } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import { workers } from '@/shared/db/schema.js';
import { events } from '@/shared/events/bus.js';
import { logger } from '@/shared/logger/logger.js';
import { isWorkerVisible } from '@/modules/compliance/service.js';

let registered = false;

/**
 * Promote a worker to APPROVED once they satisfy the visibility gate (identity
 * verified + active Oakvale cert + ≥70% complete + no safeguarding flag). The
 * background check is advisory and no longer part of this gate.
 */
async function promoteIfEligible(workerId: string): Promise<void> {
  const worker = await db.query.workers.findFirst({ where: eq(workers.id, workerId) });
  if (!worker || worker.visibilityStatus !== 'PENDING_REVIEW') return;
  if (await isWorkerVisible(workerId)) {
    await db
      .update(workers)
      .set({ visibilityStatus: 'APPROVED', preEditSnapshot: null, editRequestedAt: null })
      .where(eq(workers.id, workerId));
    logger.info({ workerId }, 'visibilityStatus → APPROVED');
  }
}

export function registerVerificationSubscribers(): void {
  if (registered) return;
  registered = true;

  // Identity approval can complete the gate → promote when eligible.
  events.on('worker.identityApproved', async ({ workerId }) => {
    await promoteIfEligible(workerId);
  });

  // A worker who adds their Oakvale cert after identity approval also becomes eligible.
  events.on('worker.certificationAdded', async ({ workerId }) => {
    await promoteIfEligible(workerId);
  });
}
