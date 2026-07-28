import { z } from 'zod';
import { AGENT_SPECIALTIES, ASSIGNMENT_ROLES } from '../enums/admin.js';
import { VISIBILITY_STATUS } from '../enums/worker.js';

export const createAgentSchema = z.object({
  email: z.string().email(),
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(32).optional(),
  password: z.string().min(8).max(200),
  specialty: z.enum(AGENT_SPECIALTIES),
  region: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(2000).optional(),
});
export type CreateAgentInput = z.infer<typeof createAgentSchema>;

export const updateAgentSchema = z.object({
  specialty: z.enum(AGENT_SPECIALTIES).optional(),
  region: z.string().trim().max(120).nullish(),
  bio: z.string().trim().max(2000).nullish(),
  isActive: z.boolean().optional(),
});
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;

/**
 * Self-serve agent profile edit. Mirrors updateAgentSchema but deliberately omits
 * `isActive` — an agent must not be able to (de)activate their own account.
 */
export const updateAgentSelfSchema = z.object({
  specialty: z.enum(AGENT_SPECIALTIES).optional(),
  region: z.string().trim().max(120).nullish(),
  bio: z.string().trim().max(2000).nullish(),
});
export type UpdateAgentSelfInput = z.infer<typeof updateAgentSelfSchema>;

export const createAssignmentSchema = z
  .object({
    placementId: z.string().uuid().optional(),
    workerId: z.string().uuid().optional(),
    roleOnAssignment: z.enum(ASSIGNMENT_ROLES).default('PRIMARY'),
    notes: z.string().trim().max(500).optional(),
  })
  .refine(
    (v) => (v.placementId && !v.workerId) || (!v.placementId && v.workerId),
    { message: 'Provide exactly one of placementId or workerId.' },
  );
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;

export const agentFiltersSchema = z.object({
  specialty: z.enum(AGENT_SPECIALTIES).optional(),
  active: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const workerRosterFiltersSchema = z.object({
  visibility: z.enum(VISIBILITY_STATUS).optional(),
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const employerRosterFiltersSchema = z.object({
  employerTypeId: z.string().uuid().optional(),
  hasSubscription: z.coerce.boolean().optional(),
  onboarded: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
