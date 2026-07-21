import { z } from 'zod';
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_OUTCOMES,
  COMPLAINT_STATUSES,
  COMPLAINT_URGENCIES,
} from '../enums/complaints.js';

const nonEmpty = z.string().trim().min(1);

export const complaintRaiseSchema = z.object({
  category: z.enum(COMPLAINT_CATEGORIES),
  urgency: z.enum(COMPLAINT_URGENCIES),
  subject: nonEmpty.max(160),
  narrative: nonEmpty.min(20).max(5_000),
  againstUserId: z.string().uuid().optional(),
  placementId: z.string().uuid().optional(),
});
export type ComplaintRaiseInput = z.infer<typeof complaintRaiseSchema>;

export const complaintAddNoteSchema = z.object({
  note: nonEmpty.max(5_000),
});
export type ComplaintAddNoteInput = z.infer<typeof complaintAddNoteSchema>;

export const complaintAssignSchema = z.object({
  agentId: z.string().uuid(),
});
export type ComplaintAssignInput = z.infer<typeof complaintAssignSchema>;

export const complaintResolveSchema = z.object({
  outcome: z.enum(COMPLAINT_OUTCOMES),
  resolutionNote: nonEmpty.max(5_000),
});
export type ComplaintResolveInput = z.infer<typeof complaintResolveSchema>;

export const complaintFiltersSchema = z.object({
  category: z.enum(COMPLAINT_CATEGORIES).optional(),
  urgency: z.enum(COMPLAINT_URGENCIES).optional(),
  status: z.enum(COMPLAINT_STATUSES).optional(),
  assignedToMe: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type ComplaintFiltersInput = z.infer<typeof complaintFiltersSchema>;
