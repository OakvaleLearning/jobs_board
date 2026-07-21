import { logger } from '@/shared/logger/logger.js';
import { events } from '@/shared/events/bus.js';
import * as contractsService from './service.js';
import * as placementsService from '@/modules/placements/service.js';

export function registerContractSubscribers(): void {
  // When a worker is selected from a shortlist, draft a Worker Placement Agreement.
  events.on('placement.selected', async ({ placementId, employerId, workerId }) => {
    try {
      await contractsService.createContract({
        type: 'WORKER_PLACEMENT',
        placementId,
        employerId,
        workerId,
        createdBy: null,
      });
    } catch (err) {
      logger.warn({ err, placementId }, 'Failed to auto-draft Worker Placement contract');
    }
  });

  // When a contract is fully executed, advance its placement to PENDING_PAYMENT.
  events.on('contract.fullyExecuted', async ({ contractId, placementId }) => {
    if (!placementId) return;
    try {
      await placementsService.advanceToPendingPayment(placementId, null);
    } catch (err) {
      logger.warn({ err, contractId, placementId }, 'Failed to advance placement to PENDING_PAYMENT');
    }
  });
}
