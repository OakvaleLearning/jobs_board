export const VERIFICATION_REQUEST_TYPES = ['IDENTITY', 'BACKGROUND', 'SELFIE', 'ADDRESS'] as const;
export type VerificationRequestType = (typeof VERIFICATION_REQUEST_TYPES)[number];

export const VERIFICATION_STATUSES = [
  'PENDING',
  'SUBMITTED',
  'IN_REVIEW',
  'VERIFIED',
  'REJECTED',
  'FLAGGED',
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/**
 * Background checks are admin-reviewed document submissions (no automated provider).
 * Canonical states: PENDING (submitted, awaiting admin), CLEAR, FLAGGED. The legacy
 * values are retained so historical rows + the pg enum stay valid, but are unused.
 */
export const BACKGROUND_CHECK_STATUSES = [
  'PENDING',
  'CLEAR',
  'FLAGGED',
  'IN_PROGRESS',
  'REVIEW',
  'HIT',
  'FAILED',
] as const;
export type BackgroundCheckStatus = (typeof BACKGROUND_CHECK_STATUSES)[number];

export const CERT_TYPES = ['OAKVALE_FOUNDATION', 'OAKVALE_ADVANCED', 'EXTERNAL'] as const;
export type CertType = (typeof CERT_TYPES)[number];

export const FLAG_TYPES = ['SAFEGUARDING', 'CONDUCT', 'DOCUMENT', 'OTHER'] as const;
export type FlagType = (typeof FLAG_TYPES)[number];

export const FLAG_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type FlagSeverity = (typeof FLAG_SEVERITIES)[number];

/** §14.2 in-app CPD refresh enrolment lifecycle. */
export const CPD_ENROLMENT_STATUSES = ['ENROLLED', 'IN_PROGRESS', 'COMPLETED'] as const;
export type CpdEnrolmentStatus = (typeof CPD_ENROLMENT_STATUSES)[number];
