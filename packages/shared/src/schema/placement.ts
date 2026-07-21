import { z } from 'zod';
import {
  END_REASONS,
  PLACEMENT_STATUSES,
  WELLBEING_LEVELS,
} from '../enums/placement.js';

export const generateShortlistSchema = z.object({
  employerId: z.string().uuid(),
  jobPostingId: z.string().uuid().optional(),
});
export type GenerateShortlistInput = z.infer<typeof generateShortlistSchema>;

export const overrideShortlistSchema = z.object({
  workerIds: z.array(z.string().uuid()).min(1).max(10),
});
export type OverrideShortlistInput = z.infer<typeof overrideShortlistSchema>;

export const selectWorkerSchema = z.object({
  workerId: z.string().uuid(),
});

export const welfareCheckLogSchema = z.object({
  recipientWellbeing: z.enum(WELLBEING_LEVELS),
  workerAttendance: z.enum(WELLBEING_LEVELS),
  issuesFlagged: z.boolean().default(false),
  notes: z.string().trim().max(2000).optional(),
});
export type WelfareCheckLogInput = z.infer<typeof welfareCheckLogSchema>;

export const replacementRequestSchema = z.object({
  reason: z.string().trim().min(8).max(2000),
});
export type ReplacementRequestInput = z.infer<typeof replacementRequestSchema>;

export const fulfilReplacementSchema = z.object({
  newWorkerId: z.string().uuid(),
});

export const endPlacementSchema = z.object({
  endReason: z.enum(END_REASONS),
  notes: z.string().trim().max(2000).optional(),
});

export const placementFiltersSchema = z.object({
  status: z.enum(PLACEMENT_STATUSES).optional(),
  pipeline: z.enum(['INDIVIDUAL_EMPLOYER', 'CORPORATE']).optional(),
  slaAtRisk: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** §14.2 — employer rates a worker after a placement. */
export const ratingCreateSchema = z.object({
  stars: z.number().int().min(1).max(5),
  review: z.string().trim().max(2000).optional(),
});
export type RatingCreateInput = z.infer<typeof ratingCreateSchema>;
