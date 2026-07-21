'use client';

import { api } from './api-client';
import type {
  ContractStatus,
  ContractType,
  SignatureParty,
} from '@oakvale/shared/enums/contracts';

export interface ContractRow {
  id: string;
  type: ContractType;
  status: ContractStatus;
  placementId: string | null;
  employerId: string | null;
  workerId: string | null;
  fullyExecutedAt: string | null;
  expiresAt: string | null;
  bodyRendered: string;
  templateVersion: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContractSignatureRow {
  id: string;
  contractId: string;
  party: SignatureParty;
  signerName: string;
  signedAt: string;
}

export interface ContractTemplateRow {
  id: string;
  type: ContractType;
  name: string;
  version: number;
  body: string;
  variables: string[];
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const contractsApi = {
  mine: () => api.get<{ data: ContractRow[] }>('/contracts/me').then((r) => r.data),
  detail: (id: string) =>
    api
      .get<{ data: { contract: ContractRow; signatures: ContractSignatureRow[] } }>(
        `/contracts/${id}`,
      )
      .then((r) => r.data),
  sign: (id: string, body: { party: SignatureParty; typedName: string; password: string }) =>
    api.post<{ data: { contract: ContractRow; fullyExecuted: boolean } }>(
      `/contracts/${id}/sign`,
      body,
    ),
  adminList: (params: { status?: string; type?: ContractType; page?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    }
    const tail = qs.toString() ? `?${qs.toString()}` : '';
    return api.get<{ data: ContractRow[]; meta: { total: number; page: number; limit: number } }>(
      `/contracts/admin${tail}`,
    );
  },
  adminCreate: (body: {
    templateId: string;
    employerId: string;
    workerId?: string;
    placementId?: string;
    variables?: Record<string, string | number>;
    expiresAt?: string;
  }) => api.post<{ data: ContractRow }>('/contracts/admin', body),
  adminTerminate: (id: string, reason: string) =>
    api.post<{ data: ContractRow }>(`/contracts/admin/${id}/terminate`, { reason }),
  templates: (opts: { type?: ContractType; activeOnly?: boolean } = {}) => {
    const qs = new URLSearchParams();
    if (opts.type) qs.set('type', opts.type);
    if (opts.activeOnly) qs.set('activeOnly', 'true');
    const tail = qs.toString() ? `?${qs.toString()}` : '';
    return api
      .get<{ data: ContractTemplateRow[] }>(`/contracts/admin/templates${tail}`)
      .then((r) => r.data);
  },
  createTemplate: (body: {
    type: ContractType;
    name: string;
    version?: number;
    body: string;
    variables?: string[];
    notes?: string;
  }) => api.post<{ data: ContractTemplateRow }>('/contracts/admin/templates', body),
  updateTemplate: (id: string, body: Partial<ContractTemplateRow>) =>
    api.patch<{ data: ContractTemplateRow }>(`/contracts/admin/templates/${id}`, body),

  amend: (id: string, body: { reason: string; changedTerms: Record<string, string | number> }) =>
    api.post<{
      data: { amendment: ContractAmendmentRow; supersedingContract: ContractRow };
    }>(`/contracts/${id}/amend`, body),
  amendments: (id: string) =>
    api
      .get<{
        data: {
          asOriginal: ContractAmendmentRow[];
          asSuperseding: ContractAmendmentRow[];
        };
      }>(`/contracts/${id}/amendments`)
      .then((r) => r.data),
  renewalsDue: (withinDays = 60) =>
    api
      .get<{ data: { contract: ContractRow; daysUntilExpiry: number }[] }>(
        `/contracts/admin/renewals/due?withinDays=${withinDays}`,
      )
      .then((r) => r.data),
  renewalPreview: (id: string) =>
    api
      .get<{
        data: {
          originalContractId: string;
          proposedStart: string;
          proposedEnd: string;
          employerId: string | null;
        };
      }>(`/contracts/admin/renewals/${id}/preview`)
      .then((r) => r.data),
  renew: (id: string, body: { newPeriodStart: string; newPeriodEnd: string }) =>
    api.post<{
      data: { amendment: ContractAmendmentRow; supersedingContract: ContractRow };
    }>(`/contracts/admin/${id}/renew`, body),
};

export interface ContractAmendmentRow {
  id: string;
  originalContractId: string;
  supersedingContractId: string;
  changedFields: Record<string, { from: unknown; to: unknown }>;
  reason: string | null;
  kind: 'AMENDMENT' | 'RENEWAL';
  initiatedBy: string | null;
  createdAt: string;
}
