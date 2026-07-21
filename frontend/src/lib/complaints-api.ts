'use client';

import { api } from './api-client';
import type {
  ComplaintCategory,
  ComplaintOutcome,
  ComplaintStatus,
  ComplaintUrgency,
} from '@oakvale/shared/enums/complaints';

export interface ComplaintRow {
  id: string;
  caseRef: string;
  category: ComplaintCategory;
  urgency: ComplaintUrgency;
  status: ComplaintStatus;
  subject: string;
  narrative: string;
  raisedByUserId: string;
  againstUserId: string | null;
  placementId: string | null;
  assignedToAgentId: string | null;
  slaDeadline: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  outcome: ComplaintOutcome | null;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ComplaintEventRow {
  id: string;
  complaintId: string;
  actorId: string | null;
  kind: string;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: string;
}

export const complaintsApi = {
  raise: (body: {
    category: ComplaintCategory;
    urgency: ComplaintUrgency;
    subject: string;
    narrative: string;
    againstUserId?: string;
    placementId?: string;
  }) => api.post<{ data: ComplaintRow }>('/complaints', body),
  mine: () => api.get<{ data: ComplaintRow[] }>('/complaints/me').then((r) => r.data),
  detail: (id: string) =>
    api
      .get<{ data: { complaint: ComplaintRow; events: ComplaintEventRow[] } }>(
        `/complaints/${id}`,
      )
      .then((r) => r.data),
  adminList: (params: {
    category?: ComplaintCategory;
    urgency?: ComplaintUrgency;
    status?: ComplaintStatus;
    assignedToMe?: boolean;
    page?: number;
    limit?: number;
  } = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) qs.set(k, String(v));
    }
    const tail = qs.toString() ? `?${qs.toString()}` : '';
    return api.get<{ data: ComplaintRow[]; meta: { total: number; page: number; limit: number } }>(
      `/complaints/admin${tail}`,
    );
  },
  acknowledge: (id: string) =>
    api.post<{ data: ComplaintRow }>(`/complaints/admin/${id}/acknowledge`),
  assign: (id: string, agentId: string) =>
    api.post<{ data: ComplaintRow }>(`/complaints/admin/${id}/assign`, { agentId }),
  setStatus: (id: string, status: ComplaintStatus) =>
    api.post<{ data: ComplaintRow }>(`/complaints/admin/${id}/status`, { status }),
  addNote: (id: string, note: string) =>
    api.post<{ data: { ok: boolean } }>(`/complaints/admin/${id}/notes`, { note }),
  resolve: (id: string, outcome: ComplaintOutcome, resolutionNote: string) =>
    api.post<{ data: ComplaintRow }>(`/complaints/admin/${id}/resolve`, {
      outcome,
      resolutionNote,
    }),
};
