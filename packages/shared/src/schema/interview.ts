import { z } from 'zod';
import { INTERVIEW_FORMATS, INTERVIEW_OUTCOMES } from '../enums/interview.js';

export const interviewRequestSchema = z.object({
  workerId: z.string().uuid(),
  shortlistId: z.string().uuid().optional(),
  jobPostingId: z.string().uuid().optional(),
  format: z.enum(INTERVIEW_FORMATS),
  proposedSlots: z.array(z.string().datetime()).min(1).max(5),
});
export type InterviewRequestInput = z.infer<typeof interviewRequestSchema>;

export const interviewConfirmSchema = z.object({
  slot: z.string().datetime(),
});

export const interviewProposeSchema = z.object({
  slots: z.array(z.string().datetime()).min(1).max(5),
});

export const interviewOutcomeSchema = z.object({
  outcome: z.enum(INTERVIEW_OUTCOMES),
  notes: z.string().max(2000).optional(),
});
