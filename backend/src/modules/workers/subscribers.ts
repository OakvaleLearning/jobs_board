import { events } from '@/shared/events/bus.js';
import { logger } from '@/shared/logger/logger.js';
import { getOrCreateForUser } from './service.js';

export function registerWorkerSubscribers(): void {
  // Eagerly create the worker row on signup for WORKER role users.
  // This ensures the foreign key relationship is established immediately,
  // preventing constraint violations when the worker tries to access their profile.
  events.on('user.registered', async ({ userId, role }) => {
    if (role !== 'WORKER') return;
    try {
      await getOrCreateForUser(userId);
    } catch (err) {
      logger.error({ err, userId }, 'Failed to create worker row on registration');
    }
  });
}
