import { z } from 'zod';

export const openConversationSchema = z.object({
  shortlistId: z.string().uuid(),
  workerId: z.string().uuid(),
});
export type OpenConversationInput = z.infer<typeof openConversationSchema>;

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1).max(4_000),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const workerSearchFiltersSchema = z.object({
  q: z.string().trim().max(160).optional(),
  certStatus: z.enum(['ACTIVE', 'IN_PROGRESS', 'EXPIRED']).optional(),
  bgCheckStatus: z.string().optional(),
  state: z.string().trim().max(100).optional(),
  workforceCategoryId: z.string().uuid().optional(),
  employmentType: z.string().optional(),
  skills: z.array(z.string().trim().min(1)).max(20).optional(),
  languages: z.array(z.string().trim().min(1)).max(10).optional(),
  availableFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  minExperienceYears: z.coerce.number().int().min(0).max(60).optional(),
  cpdHoursMin: z.coerce.number().int().min(0).max(10_000).optional(),
  savedSearchId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type WorkerSearchFiltersInput = z.infer<typeof workerSearchFiltersSchema>;

export const savedSearchCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  filters: z.record(z.string(), z.unknown()),
  notifyOnNewMatch: z.boolean().optional(),
});
export type SavedSearchCreateInput = z.infer<typeof savedSearchCreateSchema>;
