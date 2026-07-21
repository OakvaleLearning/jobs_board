import { eq } from 'drizzle-orm';
import { events } from '@/shared/events/bus.js';
import { logger } from '@/shared/logger/logger.js';
import { db } from '@/shared/db/client.js';
import { workers } from '@/shared/db/schema.js';
import { suspendActivePlacements } from '@/modules/placements/service.js';

let registered = false;

export function registerComplaintSubscribers(): void {
  if (registered) return;
  registered = true;

  // SAFEGUARDING complaint → auto-suspend all active placements of the accused worker.
  events.on('complaint.safeguardingRaised', async ({ complaintId, placementId, againstUserId }) => {
    if (!againstUserId) return;
    const worker = await db.query.workers.findFirst({ where: eq(workers.userId, againstUserId) });
    if (!worker) return;
    const count = await suspendActivePlacements(
      worker.id,
      `SAFEGUARDING complaint ${complaintId}`,
    );
    logger.warn(
      { complaintId, workerId: worker.id, placementId, suspendedPlacements: count },
      'SAFEGUARDING complaint → active placements suspended',
    );
  });
}
