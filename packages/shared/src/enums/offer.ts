export const OFFER_STATUSES = [
  'DRAFT',
  'AGENT_REVIEW',
  'SENT_TO_WORKER',
  'COUNTERED',
  'ACCEPTED',
  'DECLINED',
  'WITHDRAWN',
] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const OFFER_CURRENCIES = ['NGN', 'GBP', 'USD'] as const;
export type OfferCurrency = (typeof OFFER_CURRENCIES)[number];

export const OFFER_ACCOMMODATION_TYPES = ['LIVE_IN', 'LIVE_OUT', 'HYBRID'] as const;
export type OfferAccommodationType = (typeof OFFER_ACCOMMODATION_TYPES)[number];

/** Offers respondable by the worker (i.e. agent has approved and sent). */
export function isWorkerRespondable(status: OfferStatus): boolean {
  return status === 'SENT_TO_WORKER';
}

/** Offers the agent can still act on. */
export function isAgentReviewable(status: OfferStatus): boolean {
  return status === 'AGENT_REVIEW';
}
