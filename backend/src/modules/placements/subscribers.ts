import { events } from '@/shared/events/bus.js';
import { logger } from '@/shared/logger/logger.js';
import { suspendActivePlacements } from './service.js';

let registered = false;

export function registerPlacementSubscribers(): void {
  if (registered) return;
  registered = true;

  events.on('worker.flagged', async ({ workerId, flagType, severity, flagId }) => {
    if (flagType !== 'SAFEGUARDING') return;
    const count = await suspendActivePlacements(
      workerId,
      `SAFEGUARDING flag ${flagId} (severity ${severity})`,
    );
    logger.warn(
      { workerId, flagId, severity, suspendedPlacements: count },
      'SAFEGUARDING flag → active placements suspended',
    );
  });
}
