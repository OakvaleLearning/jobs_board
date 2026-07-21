import { z } from 'zod';
import { CERT_TYPES, FLAG_SEVERITIES, FLAG_TYPES } from '../enums/verification.js';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');
const optIsoDate = isoDate.optional().or(z.literal('').transform(() => undefined));

export const identityReviewSchema = z.object({
  decision: z.enum(['VERIFIED', 'REJECTED']),
  notes: z.string().trim().max(2000).optional(),
});
export type IdentityReviewInput = z.infer<typeof identityReviewSchema>;

export const backgroundReviewSchema = z.object({
  decision: z.enum(['CLEAR', 'FLAGGED']),
  notes: z.string().trim().max(2000).optional(),
});
export type BackgroundReviewInput = z.infer<typeof backgroundReviewSchema>;

export const cpdRecordCreateSchema = z.object({
  courseName: z.string().trim().min(2).max(160),
  provider: z.string().trim().min(2).max(160),
  completedAt: isoDate,
  expiresAt: optIsoDate,
  hoursCompleted: z.number().nonnegative().max(10_000).optional(),
  certificateDocumentId: z.string().uuid().optional().nullable(),
});
export type CpdRecordInput = z.infer<typeof cpdRecordCreateSchema>;

export const certificationCreateSchema = z.object({
  certType: z.enum(CERT_TYPES),
  // Optional (brief §3): Oakvale/CPD certificates don't reliably carry a number
  // (only a CPD member ID + QR code). Treat an empty field as "not provided" so
  // the min-length rule only applies when a value is actually entered.
  certNumber: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  issuedBy: z.string().trim().min(2).max(160),
  issuedAt: isoDate,
  expiresAt: optIsoDate,
  // Required (brief §3): the uploaded certificate file is the actual verification
  // artifact, so a certification cannot be saved without it.
  certificateDocumentId: z.string().uuid({ message: 'Upload the certificate document.' }),
});
export type CertificationInput = z.infer<typeof certificationCreateSchema>;

/** §3 — admin reviews an uploaded certificate and approves or rejects it. */
export const certificationReviewSchema = z
  .object({
    decision: z.enum(['APPROVED', 'REJECTED']),
    note: z.string().trim().max(2000).optional(),
  })
  .refine((v) => v.decision !== 'REJECTED' || (v.note?.length ?? 0) > 0, {
    message: 'A reason is required when rejecting a certificate.',
    path: ['note'],
  });
export type CertificationReviewInput = z.infer<typeof certificationReviewSchema>;

export const flagCreateSchema = z.object({
  workerId: z.string().uuid(),
  flagType: z.enum(FLAG_TYPES),
  severity: z.enum(FLAG_SEVERITIES),
  details: z.string().trim().min(8).max(2000),
});
export type FlagCreateInput = z.infer<typeof flagCreateSchema>;

export const queueQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** §14.2 — worker enrols in a CPD refresh programme from the portal. */
export const cpdEnrolSchema = z.object({
  programmeId: z.string().trim().min(1).max(80),
});
export type CpdEnrolInput = z.infer<typeof cpdEnrolSchema>;
