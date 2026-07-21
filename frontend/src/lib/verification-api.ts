'use client';

import { api } from './api-client';
import type {
  BackgroundCheckStatus,
  VerificationStatus,
} from '@oakvale/shared/enums/verification';

export interface VerificationStatusAggregate {
  workerId: string;
  visibilityStatus: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  identity: {
    status: VerificationStatus | 'UNSTARTED';
    submittedAt: string | null;
    reviewedAt: string | null;
    notes: string | null;
  };
  background: {
    status: BackgroundCheckStatus | 'UNSTARTED';
    submittedAt: string | null;
    completedAt: string | null;
    notes: string | null;
  };
  overallVerified: boolean;
  visibilityGate?: {
    identityVerified: boolean;
    oakvaleCertified: boolean;
    completionOk: boolean;
    noSafeguarding: boolean;
    visible: boolean;
  };
}

export interface QueueRow {
  workerId: string;
  fullName: string | null;
  visibilityStatus: string;
  profileCompletionPct: number;
  identityStatus: VerificationStatus | 'UNSTARTED';
  submittedAt: string | null;
}

export interface BackgroundCheckRow {
  id: string;
  workerId: string;
  fullName: string | null;
  status: BackgroundCheckStatus;
  submittedAt: string | null;
  completedAt: string | null;
  notes: string | null;
}

export const verificationApi = {
  me: () => api.get<{ data: VerificationStatusAggregate }>('/verification/me').then((r) => r.data),
  queue: (page = 1) =>
    api
      .get<{ data: QueueRow[]; meta: { total: number; page: number; limit: number } }>(`/verification/queue?page=${page}`)
      .then((r) => r),
  worker: (workerId: string) =>
    api.get<{ data: VerificationStatusAggregate }>(`/verification/workers/${workerId}`).then((r) => r.data),
  review: (workerId: string, input: { decision: 'VERIFIED' | 'REJECTED'; notes?: string }) =>
    api.post(`/verification/workers/${workerId}/identity/review`, input),
  reviewBackground: (workerId: string, input: { decision: 'CLEAR' | 'FLAGGED'; notes?: string }) =>
    api.post(`/verification/workers/${workerId}/background/review`, input),
  backgroundChecks: (page = 1) =>
    api
      .get<{ data: BackgroundCheckRow[] }>(`/verification/background-checks?page=${page}`)
      .then((r) => r.data),
};
