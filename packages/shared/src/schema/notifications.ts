import { z } from 'zod';
import { NOTIFICATION_CHANNELS, NOTIFICATION_KINDS } from '../enums/notifications.js';

export const inboxFiltersSchema = z.object({
  unreadOnly: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type InboxFiltersInput = z.infer<typeof inboxFiltersSchema>;

export const markReadSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
});
export type MarkReadInput = z.infer<typeof markReadSchema>;

export const preferenceUpdateSchema = z.object({
  updates: z
    .array(
      z.object({
        kind: z.enum(NOTIFICATION_KINDS),
        channel: z.enum(NOTIFICATION_CHANNELS),
        enabled: z.boolean(),
        digestMode: z.enum(['immediate', 'daily']).optional(),
      }),
    )
    .min(1)
    .max(200),
});
export type PreferenceUpdateInput = z.infer<typeof preferenceUpdateSchema>;

const templateBody = z.object({
  subject: z.string().trim().min(1).max(300),
  text: z.string().trim().min(1).max(5_000),
  html: z.string().trim().min(1).max(20_000),
  sms: z.string().trim().min(1).max(640),
});

export const notificationTemplateUpdateSchema = templateBody.extend({
  isActive: z.boolean().optional(),
});
export type NotificationTemplateUpdateInput = z.infer<typeof notificationTemplateUpdateSchema>;

export const notificationTemplatePreviewSchema = templateBody;
export type NotificationTemplatePreviewInput = z.infer<typeof notificationTemplatePreviewSchema>;
