'use client';

import { api, downloadBlob } from './api-client';
import type {
  AgentSpecialty,
  AssignmentRole,
} from '@oakvale/shared/enums/admin';
import type {
  CreateAgentInput,
  UpdateAgentInput,
  UpdateAgentSelfInput,
  CreateAssignmentInput,
} from '@oakvale/shared/schema/admin';
import type { VisibilityStatus } from '@oakvale/shared/enums/worker';
import type { Currency } from '@oakvale/shared/enums/payment';
import type { CertType } from '@oakvale/shared/enums/verification';
import type { CertificationReviewInput } from '@oakvale/shared/schema/verification';

export interface AgentUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
}
export interface AgentProfile {
  id: string;
  specialty: AgentSpecialty;
  region: string | null;
  bio: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface AgentAssignment {
  id: string;
  agentId: string;
  placementId: string | null;
  workerId: string | null;
  roleOnAssignment: AssignmentRole;
  assignedBy: string | null;
  assignedAt: string;
  removedAt: string | null;
  notes: string | null;
}
export interface AgentRow {
  user: AgentUser;
  profile: AgentProfile;
}
export interface AgentDetail extends AgentRow {
  assignments: AgentAssignment[];
}

/** Self-serve staff record: pure ADMINs have no agent profile, so it may be null. */
export interface StaffSelf {
  user: AgentUser;
  profile: AgentProfile | null;
}

export interface WorkerRosterRow {
  id: string;
  userId: string;
  visibilityStatus: VisibilityStatus;
  profileCompletionPct: number;
  submittedAt: string | null;
  fullName: string | null;
  phone: string | null;
  stateOfOrigin: string | null;
}

export interface CertSubmissionRow {
  certificationId: string;
  workerId: string;
  fullName: string | null;
  email: string;
  phone: string | null;
  certType: CertType;
  certNumber: string | null;
  issuedBy: string;
  issuedAt: string;
  expiresAt: string | null;
  isOakvaleCert: boolean;
  certificateDocumentId: string | null;
  hasDocument: boolean;
  verificationStatus: CertVerificationStatus;
  reviewedAt: string | null;
  reviewNote: string | null;
  submittedAt: string;
}

export type CertVerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface EmployerRosterRow {
  id: string;
  employerTypeId: string;
  /** Slug of the configurable employer type (e.g. INDIVIDUAL_EMPLOYER, CORPORATE). */
  employerType: string;
  employerTypeName: string;
  orgName: string | null;
  onboardingCompletedAt: string | null;
  ndpaConsentGiven: boolean;
  createdAt: string;
  email: string;
  fullName: string;
  activeSubscriptionId: string | null;
}

type CurrencyBucket = Partial<Record<Currency, number>>;

export interface KpiSnapshot {
  workers: {
    total: number;
    draft: number;
    pendingReview: number;
    approved: number;
    rejected: number;
    suspended: number;
    visible: number;
    backgroundCheckClear: number;
    backgroundCheckPending: number;
    profileCompletion: { p50: number; p90: number; under50pct: number };
  };
  employers: {
    total: number;
    individualEmployer: number;
    corporate: number;
    onboarded: number;
    withActiveSubscription: number;
    ndpaConsentMissingCorporate: number;
  };
  placements: {
    total: number;
    byStatus: Record<string, number>;
    activatedLast30d: number;
    completedLast30d: number;
    terminatedLast30d: number;
    replacementsOpen: number;
    replacementsSlaAtRisk: number;
    replacementsBreached: number;
    welfareChecksDueSoon: number;
  };
  revenue: {
    totalBilledMinor: CurrencyBucket;
    paidLast30dMinor: CurrencyBucket;
    refundedLast30dMinor: CurrencyBucket;
    mrrMinor: CurrencyBucket;
    activeSubscriptions: number;
  };
  generatedAt: string;
}

function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const adminApi = {
  me: () => api.get<{ data: StaffSelf }>('/admin/me').then((r) => r.data),
  updateMe: (patch: UpdateAgentSelfInput) =>
    api.patch<{ data: StaffSelf }>('/admin/me', patch as Record<string, unknown>).then((r) => r.data),
  agents: {
    list: (filters: { specialty?: AgentSpecialty; active?: boolean; page?: number } = {}) =>
      api
        .get<{ data: AgentRow[]; meta: { total: number; page: number; limit: number } }>(
          `/admin/agents${qs(filters)}`,
        )
        .then((r) => r),
    create: (input: CreateAgentInput) =>
      api
        .post<{ data: AgentRow }>('/admin/agents', input as Record<string, unknown>)
        .then((r) => r.data),
    get: (id: string) =>
      api.get<{ data: AgentDetail }>(`/admin/agents/${id}`).then((r) => r.data),
    update: (id: string, patch: UpdateAgentInput) =>
      api
        .patch<{ data: AgentRow }>(`/admin/agents/${id}`, patch as Record<string, unknown>)
        .then((r) => r.data),
    deactivate: (id: string) => api.del(`/admin/agents/${id}`),
  },
  assignments: {
    create: (agentId: string, input: CreateAssignmentInput) =>
      api
        .post<{ data: AgentAssignment }>(
          `/admin/agents/${agentId}/assignments`,
          input as Record<string, unknown>,
        )
        .then((r) => r.data),
    remove: (assignmentId: string) => api.del(`/admin/assignments/${assignmentId}`),
  },
  rosters: {
    workers: (filters: { visibility?: VisibilityStatus; q?: string; page?: number } = {}) =>
      api
        .get<{ data: WorkerRosterRow[]; meta: { total: number; page: number; limit: number } }>(
          `/admin/workers${qs(filters)}`,
        )
        .then((r) => r),
    employers: (
      filters: {
        employerTypeId?: string;
        hasSubscription?: boolean;
        onboarded?: boolean;
        page?: number;
      } = {},
    ) =>
      api
        .get<{ data: EmployerRosterRow[]; meta: { total: number; page: number; limit: number } }>(
          `/admin/employers${qs(filters)}`,
        )
        .then((r) => r),
  },
  navCounts: () =>
    api.get<{ data: Record<string, number> }>('/admin/nav-counts').then((r) => r.data),
  markNavSeen: (key: string) =>
    api.post(`/admin/nav-counts/${key}/seen`, {} as Record<string, unknown>),
  kpis: () => api.get<{ data: KpiSnapshot }>('/admin/kpis').then((r) => r.data),
  kpisTimeseries: (window: '30d' | '90d') =>
    api.get<{ data: KpiTimeseries }>(`/admin/kpis/timeseries?window=${window}`).then((r) => r.data),
  analytics: () => api.get<{ data: AnalyticsSnapshot }>('/admin/analytics').then((r) => r.data),
  agentActivity: (agentId: string, opts: { page?: number; limit?: number } = {}) =>
    api
      .get<{ data: ActivityItem[]; meta: { total: number; page: number; limit: number } }>(
        `/admin/agents/${agentId}/activity${qs(opts)}`,
      )
      .then((r) => r),
  exportCsv: (resource: 'invoices' | 'placements' | 'workers', filters: Record<string, unknown> = {}) => {
    const path = `/admin/exports/${resource}.csv${qs(filters)}`;
    const filename = `${resource}_${new Date().toISOString().slice(0, 10)}.csv`;
    return downloadBlob(path, filename);
  },

  // Certificate cross-check (brief §3)
  certifications: (filters: { q?: string; oakvaleOnly?: boolean; page?: number; limit?: number } = {}) =>
    api
      .get<{ data: CertSubmissionRow[]; meta: { page: number; limit: number } }>(
        `/admin/certifications${qs(filters)}`,
      )
      .then((r) => r),
  exportCertificationsCsv: (filters: { q?: string; oakvaleOnly?: boolean } = {}) => {
    const path = `/admin/certifications.csv${qs(filters)}`;
    const filename = `certifications_${new Date().toISOString().slice(0, 10)}.csv`;
    return downloadBlob(path, filename);
  },
  reviewCertification: (certificationId: string, body: CertificationReviewInput) =>
    api
      .post<{ data: { ok: true } }>(
        `/admin/certifications/${certificationId}/review`,
        body,
      )
      .then((r) => r.data),
  auditLog: (
    filters: {
      action?: string;
      actorId?: string;
      targetType?: string;
      targetId?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    } = {},
  ) =>
    api
      .get<{
        data: AuditLogRow[];
        meta: { total: number; page: number; limit: number };
      }>(`/admin/audit-log${qs(filters)}`)
      .then((r) => r),
  placementPdf: (placementId: string) => {
    const path = `/placements/${placementId}/record.pdf`;
    const filename = `placement_${placementId.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.pdf`;
    return downloadBlob(path, filename);
  },

  // §6.2 — employer verification
  employerVerificationQueue: (page = 1) =>
    api
      .get<{
        data: EmployerVerificationRow[];
        meta: { total: number; page: number; limit: number };
      }>(`/admin/employers/verification-queue?page=${page}&limit=50`)
      .then((r) => r),
  getEmployerVerification: (employerId: string) =>
    api
      .get<{
        data: {
          employer: EmployerVerificationDetail;
          documents: EmployerReviewDoc[];
          referral: { source: string | null; referrerName: string | null };
        };
      }>(`/admin/employers/${employerId}/verification`)
      .then((r) => r.data),
  employerDocumentUrl: (documentId: string) =>
    api
      .get<{ data: { document: EmployerReviewDoc; downloadUrl: string } }>(
        `/admin/employer-documents/${documentId}`,
      )
      .then((r) => r.data),
  reviewEmployerVerification: (
    employerId: string,
    input: { decision: 'APPROVED' | 'REJECTED'; notes?: string; accountManagerId?: string },
  ) => api.post(`/admin/employers/${employerId}/verification/review`, input),

  // GAP-004 — notification templates
  notificationTemplates: {
    list: () =>
      api
        .get<{ data: NotificationTemplateRow[] }>('/notifications/admin/notification-templates')
        .then((r) => r.data),
    get: (kind: string) =>
      api
        .get<{ data: NotificationTemplateDetail }>(
          `/notifications/admin/notification-templates/${kind}`,
        )
        .then((r) => r.data),
    update: (kind: string, input: NotificationTemplateBody & { isActive?: boolean }) =>
      api
        .patch<{ data: NotificationTemplateRow }>(
          `/notifications/admin/notification-templates/${kind}`,
          input as unknown as Record<string, unknown>,
        )
        .then((r) => r.data),
    preview: (kind: string, draft: NotificationTemplateBody) =>
      api
        .post<{ data: NotificationTemplateBody }>(
          `/notifications/admin/notification-templates/${kind}/preview`,
          draft as unknown as Record<string, unknown>,
        )
        .then((r) => r.data),
  },
};

export interface NotificationTemplateBody {
  subject: string;
  html: string;
  text: string;
  sms: string;
}
export interface NotificationTemplateRow extends NotificationTemplateBody {
  id: string;
  kind: string;
  label: string;
  variables: string[];
  isActive: boolean;
  isModified: boolean;
  updatedAt: string;
}
export interface NotificationTemplateVariable {
  name: string;
  sample: string;
}
export interface NotificationTemplateDetail {
  kind: string;
  label: string;
  variables: NotificationTemplateVariable[];
  template: NotificationTemplateBody & { isActive: boolean };
  default: NotificationTemplateBody;
}

export interface EmployerVerificationRow {
  employerId: string;
  orgName: string | null;
  email: string;
  verificationStatus: string;
  verificationSubmittedAt: string | null;
  documentCount: number;
  createdAt: string;
}

export interface EmployerVerificationDetail {
  id: string;
  orgName: string | null;
  sector: string | null;
  regNumber: string | null;
  address: string | null;
  website: string | null;
  verificationStatus: string;
  verificationNotes: string | null;
}

export interface EmployerReviewDoc {
  id: string;
  category: string;
  originalFilename: string;
  status: string;
}

export interface AuditLogRow {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: string;
}

export interface FunnelStage {
  stage: string;
  count: number;
  pctOfTop: number;
  pctOfPrev: number;
}
export interface AnalyticsSnapshot {
  funnel: FunnelStage[];
  timeToPlacement: { sample: number; avgDays: number | null; medianDays: number | null };
  successRates: { shortlistToPlacementPct: number; offerToAcceptancePct: number };
  generatedAt: string;
}

export interface DailyPoint { date: string; value: number }
export interface KpiTimeseries {
  workers: { verifiedDaily: DailyPoint[]; submittedDaily: DailyPoint[] };
  placements: { activatedDaily: DailyPoint[]; replacementsOpenedDaily: DailyPoint[] };
  revenue: { paidMinorDailyByCurrency: Partial<Record<Currency, DailyPoint[]>> };
  window: '30d' | '90d';
  from: string;
  to: string;
}
export interface ActivityItem {
  occurredAt: string;
  kind: string;
  summary: string;
  refType: 'placement' | 'assignment' | 'notification';
  refId: string;
}
