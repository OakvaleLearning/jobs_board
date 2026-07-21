import { events } from '@/shared/events/bus.js';
import { logger } from '@/shared/logger/logger.js';
import * as paymentsService from './service.js';

export function registerPaymentSubscribers(): void {
  events.on('placement.selected', async (payload) => {
    try {
      await paymentsService.openInvoiceForPlacement({
        placementId: payload.placementId,
        requestedBy: payload.employerId,
      });
    } catch (err) {
      logger.warn(
        { err, placementId: payload.placementId },
        'Failed to auto-open invoice on placement.selected (will retry on manual Pay now)',
      );
    }
  });
}
