'use client';

import { api } from './api-client';
import type {
  OfferAccommodationType,
  OfferCurrency,
  OfferStatus,
} from '@oakvale/shared/enums/offer';

export interface OfferRow {
  id: string;
  shortlistId: string;
  employerId: string;
  workerId: string;
  status: OfferStatus;
  pipelineType: 'INDIVIDUAL_EMPLOYER' | 'CORPORATE';
  startDate: string;
  endDate: string | null;
  salaryAmountMinor: number;
  salaryCurrency: OfferCurrency;
  accommodationType: OfferAccommodationType | null;
  schedule: string | null;
  notes: string | null;
  agentReviewedBy: string | null;
  agentReviewedAt: string | null;
  workerRespondedAt: string | null;
  counterOfferId: string | null;
  acceptedAt: string | null;
  declinedReason: string | null;
  placementId: string | null;
  createdAt: string;
  updatedAt: string;
}

export const offersApi = {
  create: (body: {
    shortlistId: string;
    workerId: string;
    startDate: string;
    endDate?: string;
    salaryAmountMinor: number;
    salaryCurrency: OfferCurrency;
    accommodationType?: OfferAccommodationType;
    schedule?: string;
    notes?: string;
  }) => api.post<{ data: OfferRow }>('/offers', body),
  myEmployerList: (params: { status?: OfferStatus; page?: number; limit?: number } = {}) => {
    const qs = buildQs(params);
    return api.get<{ data: OfferRow[] }>(`/offers/me/employer${qs}`);
  },
  myWorkerList: (params: { status?: OfferStatus; page?: number; limit?: number } = {}) => {
    const qs = buildQs(params);
    return api.get<{ data: OfferRow[] }>(`/offers/me/worker${qs}`);
  },
  detail: (id: string) => api.get<{ data: OfferRow }>(`/offers/${id}`).then((r) => r.data),
  accept: (id: string) => api.post<{ data: OfferRow }>(`/offers/${id}/accept`),
  decline: (id: string, reason: string) =>
    api.post<{ data: OfferRow }>(`/offers/${id}/decline`, { reason }),
  counter: (id: string, body: Partial<OfferRow> & { notes: string }) =>
    api.post<{ data: OfferRow }>(`/offers/${id}/counter`, body),
  withdraw: (id: string) => api.post<{ data: OfferRow }>(`/offers/${id}/withdraw`),
  adminQueue: (params: { page?: number; limit?: number } = {}) => {
    const qs = buildQs(params);
    return api.get<{ data: OfferRow[]; meta: { total: number; page: number; limit: number } }>(
      `/offers/admin/review-queue${qs}`,
    );
  },
  adminApprove: (id: string) => api.post<{ data: OfferRow }>(`/offers/admin/${id}/approve`),
};

function buildQs(p: Record<string, unknown>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  return qs.toString() ? `?${qs.toString()}` : '';
}
