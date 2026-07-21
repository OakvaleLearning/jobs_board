import type { PlacementStatus } from '@oakvale/shared/enums/placement.js';
import { AppError } from '@/shared/errors/app-error.js';

const TRANSITIONS: Record<PlacementStatus, readonly PlacementStatus[]> = {
  PENDING_PAYMENT: ['ACTIVE', 'TERMINATED'],
  SHORTLISTED: ['INTERVIEWING', 'SELECTED', 'TERMINATED'],
  INTERVIEWING: ['SELECTED', 'TERMINATED'],
  SELECTED: ['CONTRACT_PENDING', 'PENDING_PAYMENT', 'ACTIVE', 'TERMINATED'],
  CONTRACT_PENDING: ['PENDING_PAYMENT', 'TERMINATED'],
  ACTIVE: ['COMPLETED', 'TERMINATED', 'SUSPENDED'],
  SUSPENDED: ['ACTIVE', 'TERMINATED'],
  COMPLETED: [],
  TERMINATED: [],
};

export function canTransition(from: PlacementStatus, to: PlacementStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: PlacementStatus, to: PlacementStatus): void {
  if (!canTransition(from, to)) {
    throw new AppError({
      code: 'INVALID_PLACEMENT_TRANSITION',
      message: `Cannot transition placement from ${from} to ${to}.`,
      statusCode: 409,
      details: { from, to },
    });
  }
}
