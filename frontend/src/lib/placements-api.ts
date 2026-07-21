'use client';

import { api } from './api-client';
import type {
  PipelineType,
  PlacementStatus,
  WellbeingLevel,
  ReplacementRequestStatus,
} from '@oakvale/shared/enums/placement';
import type { WelfareCheckLogInput } from '@oakvale/shared/schema/placement';

export interface Placement {
  id: string;
  employerId: string;
  workerId: string;
  jobPostingId: string | null;
  pipelineType: PipelineType;
  status: PlacementStatus;
  placedAt: string | null;
  activatedAt: string | null;
  guaranteeExpiresAt: string | null;
  endedAt: string | null;
  endReason: string | null;
  replacementOf: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MatchedCandidate {
  workerId: string;
  score: number;
  breakdown: { skills: number; experience: number; certification: number; rating: number };
}

export interface Shortlist {
  id: string;
  employerId: string;
  jobPostingId: string | null;
  requestType: PipelineType;
  workerIds: MatchedCandidate[];
  expiresAt: string | null;
  viewedAt: string | null;
  decidedAt: string | null;
  selectedWorkerId: string | null;
  createdAt: string;
}

export interface WelfareCheck {
  id: string;
  placementId: string;
  scheduledAt: string | null;
  completedAt: string | null;
  recipientWellbeing: WellbeingLevel | null;
  workerAttendance: WellbeingLevel | null;
  issuesFlagged: boolean;
  notes: string | null;
}

export interface PlacementEvent {
  id: string;
  placementId: string;
  eventType: string;
  occurredAt: string;
  actorId: string | null;
  metadata: Record<string, unknown> | null;
}

export interface ReplacementRequestRow {
  id: string;
  originalPlacementId: string;
  requestedAt: string;
  reason: string;
  slaDeadline: string;
  status: ReplacementRequestStatus;
  newPlacementId: string | null;
  replacementFeeWaived: boolean;
}

export const placementsApi = {
  me: () => api.get<{ data: Placement[] }>('/placements/me').then((r) => r.data),
  employerMe: () => api.get<{ data: Placement[] }>('/placements/employer/me').then((r) => r.data),
  employerShortlists: () =>
    api.get<{ data: Shortlist[] }>('/placements/employer/me/shortlists').then((r) => r.data),
  shortlist: (id: string) =>
    api.get<{ data: Shortlist }>(`/placements/employer/me/shortlists/${id}`).then((r) => r.data),
  select: (shortlistId: string, workerId: string) =>
    api
      .post<{ data: Placement }>(`/placements/employer/me/shortlists/${shortlistId}/select`, {
        workerId,
      })
      .then((r) => r.data),
  detail: (placementId: string) =>
    api
      .get<{ data: { placement: Placement; events: PlacementEvent[]; welfareChecks: WelfareCheck[] } }>(
        `/placements/${placementId}`,
      )
      .then((r) => r.data),
  logWelfareCheck: (placementId: string, input: WelfareCheckLogInput) =>
    api.post(`/placements/${placementId}/welfare-checks`, input as Record<string, unknown>),
  requestReplacement: (placementId: string, reason: string) =>
    api.post(`/placements/${placementId}/request-replacement`, { reason }),

  rateWorker: (placementId: string, input: { stars: number; review?: string }) =>
    api
      .post<{ data: { id: string; stars: number } }>(
        `/placements/${placementId}/rating`,
        input as Record<string, unknown>,
      )
      .then((r) => r.data),
  workerRatings: (workerId: string) =>
    api
      .get<{ data: { summary: RatingSummary; reviews: WorkerRatingRow[] } }>(
        `/placements/workers/${workerId}/ratings`,
      )
      .then((r) => r.data),

  adminList: (params: { status?: PlacementStatus; pipeline?: PipelineType; page?: number }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) qs.set(k, String(v));
    });
    return api
      .get<{ data: Placement[]; meta: { total: number; page: number; limit: number } }>(
        `/placements/admin${qs.toString() ? `?${qs}` : ''}`,
      )
      .then((r) => r);
  },
  activate: (placementId: string) =>
    api.post(`/placements/admin/${placementId}/activate`),
  end: (placementId: string, input: { endReason: string; notes?: string }) =>
    api.post(`/placements/admin/${placementId}/end`, input as Record<string, unknown>),
  generateShortlist: (input: { employerId: string; jobPostingId?: string }) =>
    api
      .post<{ data: { shortlistId: string; matches: MatchedCandidate[] } }>(
        '/placements/admin/shortlists/generate',
        input as Record<string, unknown>,
      )
      .then((r) => r.data),
  adminShortlists: () =>
    api
      .get<{ data: Shortlist[]; meta: { total: number; page: number; limit: number } }>(
        '/placements/admin/shortlists',
      )
      .then((r) => r),
  adminShortlist: (id: string) =>
    api.get<{ data: Shortlist }>(`/placements/admin/shortlists/${id}`).then((r) => r.data),
  overrideShortlist: (id: string, workerIds: string[]) =>
    api
      .post<{ data: MatchedCandidate[] }>(`/placements/admin/shortlists/${id}/override`, { workerIds })
      .then((r) => r.data),
  openReplacements: () =>
    api
      .get<{ data: ReplacementRequestRow[] }>('/placements/admin/replacement-requests')
      .then((r) => r.data),
  fulfilReplacement: (id: string, newWorkerId: string) =>
    api.post(`/placements/admin/replacement-requests/${id}/fulfil`, { newWorkerId }),

  welfareReports: (placementId: string) =>
    api
      .get<{ data: WelfareReportRow[] }>(`/placements/${placementId}/welfare-reports`)
      .then((r) => r.data),
  welfareReportDownloadUrl: (placementId: string, reportId: string) => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';
    return `${base}/placements/${placementId}/welfare-reports/${reportId}/download`;
  },
  welfareEscalationsForPlacement: (placementId: string) =>
    api
      .get<{ data: WelfareEscalationRow[] }>(`/placements/${placementId}/welfare-escalations`)
      .then((r) => r.data),
  openWelfareEscalations: () =>
    api
      .get<{ data: { escalation: WelfareEscalationRow; placement: Placement }[] }>(
        '/placements/admin/welfare-escalations',
      )
      .then((r) => r.data),
  resolveWelfareEscalation: (id: string, notes?: string) =>
    api.post(`/placements/welfare-escalations/${id}/resolve`, notes ? { notes } : {}),
};

export interface RatingSummary {
  average: number;
  count: number;
}

export interface WorkerRatingRow {
  id: string;
  placementId: string;
  stars: number;
  review: string | null;
  createdAt: string;
}

export interface WelfareReportRow {
  id: string;
  welfareCheckId: string;
  deliveredToEmail: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export interface WelfareEscalationRow {
  id: string;
  welfareCheckId: string;
  placementId: string;
  severity: WellbeingLevel;
  dueAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNotes: string | null;
  overdueNotifiedAt: string | null;
  createdAt: string;
}
