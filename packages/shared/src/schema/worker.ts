import { z } from 'zod';
import {
  DOCUMENT_CATEGORIES,
  EDUCATION_LEVELS,
  EMPLOYMENT_TYPES,
  GENDERS,
  NATURE_OF_ROLES,
  PREFERRED_SETTINGS,
  ID_TYPES,
  REFERENCE_TYPES,
  SKILL_KINDS,
  WAGE_STRUCTURES,
  WORKER_SECTIONS,
} from '../enums/worker.js';

const nonEmpty = z.string().trim().min(1);
const phone = z.string().trim().regex(/^\+?[0-9\s-]{7,20}$/, 'Enter a valid phone number');
const optionalIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('').transform(() => undefined));
const requiredIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

export const sectionASchema = z.object({
  fullName: nonEmpty.max(120),
  dob: requiredIso,
  gender: z.enum(GENDERS),
  nationality: nonEmpty.max(60),
  stateOfOrigin: nonEmpty.max(60),
  lga: nonEmpty.max(60),
  address: nonEmpty.max(240),
  phone,
  emergencyContact: z.object({
    name: nonEmpty.max(120),
    relationship: nonEmpty.max(60),
    phone,
  }),
});

export const sectionBSchema = z.object({
  idType: z.enum(ID_TYPES),
  idNumber: nonEmpty.max(40),
  idIssueDate: optionalIso,
  idExpiryDate: optionalIso,
  idDocumentId: z.string().uuid().optional().nullable(),
  selfieId: z.string().uuid().optional().nullable(),
  proofOfAddressId: z.string().uuid().optional().nullable(),
});

export const sectionCSchema = z.object({
  backgroundCheckConsent: z.literal(true, {
    errorMap: () => ({ message: 'You must consent to a background check to proceed.' }),
  }),
  consentedAt: requiredIso,
  // Background-check documents (admin-reviewed). All optional.
  policeCertificateDocumentId: z.string().uuid().optional().nullable(),
  guarantorLetterDocumentId: z.string().uuid().optional().nullable(),
  affidavitDocumentId: z.string().uuid().optional().nullable(),
});

export const educationItemSchema = z.object({
  id: z.string().uuid().optional(),
  level: z.enum(EDUCATION_LEVELS),
  course: z.string().trim().max(120).optional(),
  institution: nonEmpty.max(160),
  country: nonEmpty.max(60),
  startDate: optionalIso,
  endDate: optionalIso,
  grade: z.string().trim().max(40).optional(),
  certificateDocumentId: z.string().uuid().optional().nullable(),
});
export const sectionDSchema = z.object({
  items: z.array(educationItemSchema),
});

export const experienceItemSchema = z.object({
  id: z.string().uuid().optional(),
  jobTitle: nonEmpty.max(120),
  employerName: nonEmpty.max(160),
  sector: z.string().trim().max(80).optional(),
  natureOfRole: z.enum(NATURE_OF_ROLES).optional().or(z.literal('').transform(() => undefined)),
  startDate: requiredIso,
  endDate: optionalIso,
  isCurrent: z.boolean().default(false),
  duties: z.string().trim().max(1000).optional(),
  skillsApplied: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  reasonForLeaving: z.string().trim().max(240).optional(),
  letterDocumentId: z.string().uuid().optional().nullable(),
});
export const sectionESchema = z.object({
  items: z.array(experienceItemSchema),
});

export const referenceItemSchema = z.object({
  id: z.string().uuid().optional(),
  name: nonEmpty.max(120),
  organisation: nonEmpty.max(160),
  position: z.string().trim().max(120).optional(),
  phone,
  email: z.string().trim().toLowerCase().email(),
  referenceType: z.enum(REFERENCE_TYPES),
  letterDocumentId: z.string().uuid().optional().nullable(),
});
export const sectionFSchema = z.object({
  items: z.array(referenceItemSchema),
});

export const sectionGSchema = z.object({
  // The worker's primary workforce category (admin-configured taxonomy). Drives the
  // skills menu, certification/identity/compliance requirements, and search facet.
  workforceCategoryId: z
    .string()
    .uuid()
    .nullish()
    .or(z.literal('').transform(() => null)),
  // Accepts workforce-category slugs (admin-configurable) as well as the legacy
  // SECTORS enum values; both are matched by string compare in placements.
  desiredSectors: z.array(z.string().trim().min(1)).max(10).default([]),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  preferredSettings: z.array(z.enum(PREFERRED_SETTINGS)).max(20).default([]),
  availabilityStart: optionalIso,
  shiftPreferences: z.array(z.string().trim().min(1)).max(20).default([]),
  relocationWillingness: z.boolean(),
  preferredCities: z.array(z.string().trim().min(1)).max(20).default([]),
});

export const skillItemSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(SKILL_KINDS),
  name: nonEmpty.max(120),
  selfRating: z.number().int().min(1).max(5).optional(),
});
export const sectionHSchema = z.object({
  items: z.array(skillItemSchema).min(1, 'Add at least one skill.'),
});

export const sectionISchema = z.object({
  interests: z.string().trim().max(600).optional().default(''),
  personalStatement: z.string().trim().min(40, 'Write at least 40 characters.').max(1500),
});

export const sectionJSchema = z.object({
  videoIntroDocumentId: z.string().uuid().optional().nullable(),
});

export const sectionKSchema = z.object({
  wageStructure: z.enum(WAGE_STRUCTURES),
  minRate: z.number().nonnegative(),
  maxRate: z.number().nonnegative(),
  currency: z.enum(['NGN','GBP','USD']).default('NGN'),
  negotiable: z.boolean().default(true),
  expectedBenefits: z.array(z.string().trim().min(1)).max(20).default([]),
}).refine((v) => v.maxRate >= v.minRate, {
  message: 'Maximum rate must be greater than or equal to minimum.',
  path: ['maxRate'],
});

export const sectionLSchema = z.object({
  cpdEnrolled: z.boolean(),
  oakvaleProgrammeAcknowledged: z.boolean(),
  immunisationDeclared: z.boolean().optional().default(false),
});

export const sectionSchemas = {
  A: sectionASchema,
  B: sectionBSchema,
  C: sectionCSchema,
  D: sectionDSchema,
  E: sectionESchema,
  F: sectionFSchema,
  G: sectionGSchema,
  H: sectionHSchema,
  I: sectionISchema,
  J: sectionJSchema,
  K: sectionKSchema,
  L: sectionLSchema,
} as const satisfies Record<(typeof WORKER_SECTIONS)[number], z.ZodTypeAny>;

export type SectionPayloads = {
  [K in keyof typeof sectionSchemas]: z.infer<(typeof sectionSchemas)[K]>;
};

export const uploadUrlRequestSchema = z.object({
  category: z.enum(DOCUMENT_CATEGORIES),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  originalFilename: z.string().min(1).max(240),
});
export type UploadUrlRequest = z.infer<typeof uploadUrlRequestSchema>;

export const confirmUploadRequestSchema = z.object({
  documentId: z.string().uuid(),
});

export const searchWorkersQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
