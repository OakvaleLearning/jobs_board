import { z } from 'zod';
import {
  PLACEMENT_SETTINGS,
  CATEGORY_EMPLOYMENT_TYPES,
  IDENTITY_FIELD_KEYS,
  COMPLIANCE_FIELD_KEYS,
} from '../enums/workforce-category.js';

const nonEmpty = z.string().trim().min(1);

/** A required certification descriptor. `lmsCourseRef` is a placeholder for a future LMS hook. */
export const requiredCertificationSchema = z.object({
  name: nonEmpty.max(160),
  lmsCourseRef: z.string().trim().max(160).optional(),
});
export type RequiredCertification = z.infer<typeof requiredCertificationSchema>;

const skillList = z.array(z.string().trim().min(1).max(120)).max(100).default([]);

export const workforceCategoryCreateSchema = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[A-Z][A-Z0-9_]*$/, 'Slug must be UPPER_SNAKE_CASE.')
    .max(80),
  name: nonEmpty.max(160),
  description: z.string().trim().max(2_000).optional(),
  requiredCertifications: z.array(requiredCertificationSchema).max(40).default([]),
  requiredIdentityFields: z.array(z.enum(IDENTITY_FIELD_KEYS)).default([]),
  skillsMenu: skillList,
  specialistTags: skillList,
  applicableSettings: z.array(z.enum(PLACEMENT_SETTINGS)).default([]),
  applicableEmploymentTypes: z.array(z.enum(CATEGORY_EMPLOYMENT_TYPES)).default([]),
  requiredComplianceFields: z.array(z.enum(COMPLIANCE_FIELD_KEYS)).default([]),
  displayOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});
export type WorkforceCategoryCreateInput = z.infer<typeof workforceCategoryCreateSchema>;

export const workforceCategoryUpdateSchema = workforceCategoryCreateSchema
  .omit({ slug: true })
  .partial();
export type WorkforceCategoryUpdateInput = z.infer<typeof workforceCategoryUpdateSchema>;

export const workforceCategoryFiltersSchema = z.object({
  activeOnly: z.coerce.boolean().optional(),
});
export type WorkforceCategoryFiltersInput = z.infer<typeof workforceCategoryFiltersSchema>;
