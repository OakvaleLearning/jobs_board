import type { OfferStatus } from '@oakvale/shared/enums/offer.js';
import { AppError } from '@/shared/errors/app-error.js';

const TRANSITIONS: Record<OfferStatus, readonly OfferStatus[]> = {
  DRAFT: ['AGENT_REVIEW', 'WITHDRAWN'],
  AGENT_REVIEW: ['SENT_TO_WORKER', 'COUNTERED', 'WITHDRAWN'],
  SENT_TO_WORKER: ['ACCEPTED', 'DECLINED', 'COUNTERED', 'WITHDRAWN'],
  COUNTERED: ['AGENT_REVIEW', 'WITHDRAWN'],
  ACCEPTED: [],
  DECLINED: [],
  WITHDRAWN: [],
};

export function canTransition(from: OfferStatus, to: OfferStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertOfferTransition(from: OfferStatus, to: OfferStatus): void {
  if (!canTransition(from, to)) {
    throw new AppError({
      code: 'OFFER_NOT_RESPONDABLE',
      message: `Cannot transition offer from ${from} to ${to}`,
      statusCode: 409,
      details: { from, to },
    });
  }
}
