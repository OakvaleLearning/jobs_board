'use client';

import { api } from './api-client';
import type {
  InterviewFormat,
  InterviewOutcome,
  InterviewStatus,
} from '@oakvale/shared/enums/interview';

export interface InterviewRow {
  id: string;
  employerId: string;
  workerId: string;
  shortlistId: string | null;
  jobPostingId: string | null;
  format: InterviewFormat;
  proposedSlots: string[];
  confirmedSlot: string | null;
  status: InterviewStatus;
  outcome: InterviewOutcome | null;
  outcomeNotes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

function buildQs(p: Record<string, unknown>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  return qs.toString() ? `?${qs.toString()}` : '';
}

export const interviewsApi = {
  // Worker
  myWorkerList: () =>
    api.get<{ data: InterviewRow[] }>(`/placements/interviews/me`).then((r) => r.data),
  accept: (id: string, slot: string) =>
    api.post<{ data: InterviewRow }>(`/placements/interviews/${id}/accept`, { slot }),
  propose: (id: string, slots: string[]) =>
    api.post<{ data: InterviewRow }>(`/placements/interviews/${id}/propose`, { slots }),

  // Employer
  myEmployerList: () =>
    api.get<{ data: InterviewRow[] }>(`/placements/interviews/employer/me`).then((r) => r.data),
  request: (body: {
    workerId: string;
    shortlistId?: string;
    jobPostingId?: string;
    format: InterviewFormat;
    proposedSlots: string[];
  }) => api.post<{ data: InterviewRow }>(`/placements/interviews`, body),
  confirm: (id: string, slot: string) =>
    api.post<{ data: InterviewRow }>(`/placements/interviews/${id}/confirm`, { slot }),
  logOutcome: (id: string, outcome: InterviewOutcome, notes?: string) =>
    api.post<{ data: InterviewRow }>(`/placements/interviews/${id}/outcome`, { outcome, notes }),
  cancel: (id: string) =>
    api.post<{ data: InterviewRow }>(`/placements/interviews/${id}/cancel`),

  // Admin
  adminList: (params: { page?: number; limit?: number } = {}) =>
    api.get<{ data: InterviewRow[] }>(`/placements/admin/interviews${buildQs(params)}`).then((r) => r.data),
};
