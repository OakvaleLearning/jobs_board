import { logger } from '../logger/logger.js';

export type NotificationChannel = 'email' | 'sms';

export interface NotifyInput {
  channel: NotificationChannel;
  to: string;
  subject?: string;
  body: string;
  meta?: Record<string, unknown>;
}

export const notifier = {
  async send(input: NotifyInput): Promise<void> {
    logger.info({ notify: input }, '[notifier:stub] dispatch');
  },
};
