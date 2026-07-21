import type { VerificationStatus } from '@oakvale/shared/enums/verification.js';
import { AppError } from '@/shared/errors/app-error.js';

const TRANSITIONS: Record<VerificationStatus, readonly VerificationStatus[]> = {
  PENDING: ['SUBMITTED', 'IN_REVIEW'],
  SUBMITTED: ['IN_REVIEW', 'VERIFIED', 'REJECTED', 'FLAGGED', 'PENDING'],
  IN_REVIEW: ['VERIFIED', 'REJECTED', 'FLAGGED', 'PENDING'],
  VERIFIED: ['FLAGGED'],
  REJECTED: ['IN_REVIEW'],
  FLAGGED: ['IN_REVIEW', 'REJECTED'],
};

export function canTransition(from: VerificationStatus, to: VerificationStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: VerificationStatus, to: VerificationStatus): void {
  if (!canTransition(from, to)) {
    throw new AppError({
      code: 'INVALID_VERIFICATION_TRANSITION',
      message: `Cannot transition verification from ${from} to ${to}.`,
      statusCode: 409,
      details: { from, to },
    });
  }
}
