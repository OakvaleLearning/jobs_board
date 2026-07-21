import { events } from '@/shared/events/bus.js';
import { logger } from '@/shared/logger/logger.js';
import { isEmployerRole } from '@oakvale/shared/roles.js';
import { getOrCreateForUser } from './service.js';

export function registerEmployerSubscribers(): void {
  // Eagerly create the employer row (with the chosen configurable type) on signup.
  events.on('user.registered', async ({ userId, role, employerTypeId }) => {
    if (!isEmployerRole(role)) return;
    try {
      await getOrCreateForUser(userId, { employerTypeId });
    } catch (err) {
      logger.error({ err, userId }, 'Failed to create employer row on registration');
    }
  });
}
