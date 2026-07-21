import { events } from '@/shared/events/bus.js';
import { logger } from '@/shared/logger/logger.js';
import { queues } from '@/shared/queue/queues.js';

const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;

let registered = false;

export function registerOfferSubscribers(): void {
  if (registered) return;
  registered = true;

  // 72h after an offer is accepted, remind the assigned agent to make the welfare call.
  events.on('offer.accepted', async ({ offerId, placementId }) => {
    try {
      await queues.prePlacementWelfare.add(
        'pre-placement-welfare',
        { offerId, placementId },
        { delay: SEVENTY_TWO_HOURS_MS },
      );
      logger.info({ offerId, placementId }, 'pre-placement welfare check scheduled (72h)');
    } catch (err) {
      logger.warn({ err, offerId }, 'failed to schedule pre-placement welfare check');
    }
  });
}
