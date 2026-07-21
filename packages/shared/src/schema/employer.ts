import { z } from 'zod';
import {
  ACCOMMODATION_TYPES,
  CARE_SPECIALISATIONS,
  EMPLOYER_DOCUMENT_CATEGORIES,
  JOB_COUNTRIES,
  JOB_POSTING_STATUSES,
  JOB_PRIORITY_LEVELS,
  JOB_SALARY_CURRENCIES,
  JOB_VISIBILITY,
  MOBILITY_LEVELS,
  URGENCY_LEVELS,
} from '../enums/employer.js';

const nonEmpty = z.string().trim().min(1);
const phone = z.string().trim().regex(/^\+?[0-9\s-]{7,20}$/, 'Enter a valid phone number');
const optIsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .or(z.literal('').transform(() => undefined));
// Optional ISO date that, when provided, must be today or later (no past deadlines).
const futureIsoDate = optIsoDate.refine(
  (d) => !d || d >= new Date().toISOString().slice(0, 10),
  'Deadline must be today or a future date.',
);

export const employerProfileUpdateSchema = z.object({
  orgName: nonEmpty.max(160),
  sector: z.string().trim().max(120).optional(),
  regNumber: z.string().trim().max(80).optional(),
  address: z.string().trim().max(240).optional(),
  website: z.string().trim().url().optional().or(z.literal('').transform(() => undefined)),
  about: z.string().trim().max(2000).optional(),
});
export type EmployerProfileUpdate = z.infer<typeof employerProfileUpdateSchema>;

export const contactCreateSchema = z.object({
  name: nonEmpty.max(120),
  position: z.string().trim().max(120).optional(),
  email: z.string().trim().toLowerCase().email(),
  phone,
  isPrimary: z.boolean().optional().default(false),
});
export type ContactCreateInput = z.infer<typeof contactCreateSchema>;

export const contactUpdateSchema = contactCreateSchema.partial();
export type ContactUpdateInput = z.infer<typeof contactUpdateSchema>;

export const individualEmployerNeedsAssessmentSchema = z.object({
  careRecipientName: nonEmpty.max(120),
  age: z.number().int().min(0).max(130),
  relationship: nonEmpty.max(60),
  conditions: z.string().trim().max(2000).optional(),
  mobilityLevel: z.enum(MOBILITY_LEVELS),
  medicationNeeds: z.string().trim().max(1000).optional(),
  preferredLanguage: nonEmpty.max(60),
  culturalRequirements: z.string().trim().max(1000).optional(),
  dietaryRequirements: z.string().trim().max(1000).optional(),
  accommodationType: z.enum(ACCOMMODATION_TYPES),
  urgencyLevel: z.enum(URGENCY_LEVELS),
  additionalNotes: z.string().trim().max(2000).optional(),
});
export type IndividualEmployerNeedsAssessmentInput = z.infer<
  typeof individualEmployerNeedsAssessmentSchema
>;

export const corporateNeedsAssessmentSchema = z.object({
  numStaffRequired: z.number().int().min(1).max(500),
  ageRangesServed: z.array(z.string().trim().min(1)).max(20).default([]),
  hoursOfOperation: nonEmpty.max(160),
  existingStaffCount: z.number().int().min(0).max(10_000).default(0),
  specificSkillsNeeded: z.array(z.string().trim().min(1)).max(50).default([]),
  budgetParameters: z.string().trim().max(1000).optional(),
  siteAssessmentNotes: z.string().trim().max(2000).optional(),
});
export type CorporateNeedsAssessmentInput = z.infer<typeof corporateNeedsAssessmentSchema>;

// §6.2 — employer verification document upload + agent review.
export const employerDocumentUploadSchema = z.object({
  category: z.enum(EMPLOYER_DOCUMENT_CATEGORIES),
  mimeType: nonEmpty.max(120),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
  originalFilename: nonEmpty.max(255),
});
export type EmployerDocumentUploadInput = z.infer<typeof employerDocumentUploadSchema>;

export const employerVerificationReviewSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  notes: z.string().trim().max(2000).optional(),
  accountManagerId: z.string().uuid().optional(),
});
export type EmployerVerificationReviewInput = z.infer<typeof employerVerificationReviewSchema>;

export const jobPostingCreateSchema = z.object({
  title: nonEmpty.max(160),
  description: z.string().trim().min(20).max(5000),
  duties: z.string().trim().max(5000).optional(),
  country: z.enum(JOB_COUNTRIES).default('NIGERIA'),
  workLocation: z.string().trim().max(160).optional(),
  schedule: z.string().trim().max(160).optional(),
  salaryCurrency: z.enum(JOB_SALARY_CURRENCIES).default('NGN'),
  salaryRange: z.string().trim().max(80).optional(),
  benefits: z.array(z.string().trim().min(1)).max(30).default([]),
  // §5 — optional care specialisations this role involves (grouped multi-select).
  specialisations: z
    .array(z.enum(CARE_SPECIALISATIONS as unknown as [string, ...string[]]))
    .max(30)
    .default([]),
  openings: z.number().int().min(1).max(200).default(1),
  deadline: futureIsoDate,
  priorityLevel: z.enum(JOB_PRIORITY_LEVELS).default('MEDIUM'),
  status: z.enum(JOB_POSTING_STATUSES).default('OPEN'),
  // §6.3 job-post fields
  workforceCategoryId: z.string().uuid(),
  // §5 — required type of care this role needs (drives caregiver self-selection).
  careTypeId: z.string().uuid({ message: 'Select the type of care this role needs.' }),
  backgroundCheckRequired: z.boolean().default(true),
  visibility: z.enum(JOB_VISIBILITY).default('PUBLIC'),
});
export type JobPostingCreateInput = z.infer<typeof jobPostingCreateSchema>;

// Update stays lenient on deadline so editing a posting whose deadline already
// passed doesn't fail validation on an unchanged value.
export const jobPostingUpdateSchema = jobPostingCreateSchema.partial().extend({ deadline: optIsoDate });
export type JobPostingUpdateInput = z.infer<typeof jobPostingUpdateSchema>;

export const workerBrowseQuerySchema = z.object({
  q: z.string().trim().optional(),
  sector: z.string().trim().optional(),
  city: z.string().trim().optional(),
  employmentType: z.string().trim().optional(),
  language: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type WorkerBrowseQuery = z.infer<typeof workerBrowseQuerySchema>;
