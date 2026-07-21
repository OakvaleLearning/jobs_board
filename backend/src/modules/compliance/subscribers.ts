import { events } from '@/shared/events/bus.js';
import { logger } from '@/shared/logger/logger.js';

let registered = false;

export function registerComplianceSubscribers(): void {
  if (registered) return;
  registered = true;

  events.on('worker.flagged', ({ workerId, flagType, severity, flagId }) => {
    // SAFEGUARDING flags are handled by the placements module subscriber
    // (suspends active placements). Phase 7 will dispatch a notification here.
    logger.info({ workerId, flagId, flagType, severity }, 'compliance flag raised');
  });
}
