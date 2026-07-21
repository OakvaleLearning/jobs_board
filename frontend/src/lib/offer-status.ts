import type { OfferStatus } from '@oakvale/shared/enums/offer';

/**
 * A "live" offer is one that still occupies the shortlist/worker slot — the
 * employer should not be able to send another. Mirrors the backend duplicate
 * guard (`status NOT IN ('WITHDRAWN','DECLINED')`) in the offers service.
 */
export function isLiveOffer(status: OfferStatus): boolean {
  return status !== 'WITHDRAWN' && status !== 'DECLINED';
}

export function toneForOffer(status: OfferStatus): 'neutral' | 'sage' | 'terracotta' | 'brand' {
  switch (status) {
    case 'ACCEPTED':
      return 'sage';
    case 'SENT_TO_WORKER':
      return 'brand';
    case 'DECLINED':
    case 'WITHDRAWN':
      return 'terracotta';
    default:
      return 'neutral';
  }
}

export function labelForOffer(status: OfferStatus): string {
  switch (status) {
    case 'SENT_TO_WORKER':
      return 'Awaiting worker response';
    case 'AGENT_REVIEW':
      return 'In agent review';
    case 'COUNTERED':
      return 'Counter-offer received';
    case 'ACCEPTED':
      return 'Accepted';
    case 'DECLINED':
      return 'Declined';
    case 'WITHDRAWN':
      return 'Withdrawn';
    default:
      return status.toLowerCase();
  }
}
