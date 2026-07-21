import { z } from 'zod';
import { CONTRACT_TYPES, SIGNATURE_PARTIES } from '../enums/contracts.js';

const nonEmpty = z.string().trim().min(1);

export const contractTemplateCreateSchema = z.object({
  type: z.enum(CONTRACT_TYPES),
  name: nonEmpty.max(160),
  version: z.number().int().min(1).default(1),
  body: nonEmpty.max(50_000),
  variables: z.array(z.string().trim().min(1)).max(60).default([]),
  notes: z.string().trim().max(2_000).optional(),
});
export type ContractTemplateCreateInput = z.infer<typeof contractTemplateCreateSchema>;

export const contractTemplateUpdateSchema = contractTemplateCreateSchema
  .partial()
  .extend({ isActive: z.boolean().optional() });
export type ContractTemplateUpdateInput = z.infer<typeof contractTemplateUpdateSchema>;

export const contractCreateSchema = z.object({
  templateId: z.string().uuid(),
  placementId: z.string().uuid().optional(),
  employerId: z.string().uuid(),
  workerId: z.string().uuid().optional(),
  expiresAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  variables: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
});
export type ContractCreateInput = z.infer<typeof contractCreateSchema>;

export const contractSignSchema = z.object({
  party: z.enum(SIGNATURE_PARTIES),
  typedName: nonEmpty.max(160),
  password: nonEmpty.max(200),
});
export type ContractSignInput = z.infer<typeof contractSignSchema>;

export const contractAmendSchema = z.object({
  reason: nonEmpty.max(2_000),
  changedTerms: z
    .record(z.string(), z.union([z.string(), z.number()]))
    .refine((o) => Object.keys(o).length > 0, 'At least one term must change.'),
});
export type ContractAmendInput = z.infer<typeof contractAmendSchema>;

export const contractRenewSchema = z.object({
  newPeriodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  newPeriodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type ContractRenewInput = z.infer<typeof contractRenewSchema>;

export const contractFiltersSchema = z.object({
  status: z.string().optional(),
  type: z.enum(CONTRACT_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type ContractFiltersInput = z.infer<typeof contractFiltersSchema>;
