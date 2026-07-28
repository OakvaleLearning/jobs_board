'use client';

import { api } from './api-client';
import type {
  ContactCreateInput,
  ContactUpdateInput,
  CorporateNeedsAssessmentInput,
  IndividualEmployerNeedsAssessmentInput,
  EmployerProfileUpdate,
  JobPostingCreateInput,
  JobPostingUpdateInput,
  WorkerBrowseQuery,
} from '@oakvale/shared/schema/employer';
import type {
  EmployerType,
  JobCountry,
  JobPostingStatus,
  JobSalaryCurrency,
  JobVisibility,
} from '@oakvale/shared/enums/employer';

export interface EmployerContact {
  id: string;
  employerId: string;
  name: string;
  position: string | null;
  email: string;
  phone: string;
  isPrimary: boolean;
}

export interface EmployerTypeConfig {
  id: string;
  slug: string;
  name: string;
  roleKey: string;
  serviceModel: string;
  jobPostingEnabled: boolean;
  onboardingSteps: string[];
  // Derived behavioural flags (§5) — see backend deriveTypeFlags.
  usesIndividualEmployerNeeds: boolean;
  usesCorporateNeeds: boolean;
  requiresNdpa: boolean;
  isAccountManaged: boolean;
  pipeline: 'INDIVIDUAL_EMPLOYER' | 'CORPORATE';
}

export interface EmployerProfile {
  id: string;
  userId: string;
  employerType: EmployerType;
  employerTypeId: string | null;
  /** §5: resolved configurable employer-type config (null for legacy rows w/o a type). */
  employerTypeConfig: EmployerTypeConfig | null;
  orgName: string | null;
  sector: string | null;
  regNumber: string | null;
  address: string | null;
  logoUrl: string | null;
  website: string | null;
  about: string | null;
  ndpaConsentGiven: boolean;
  ndpaConsentTimestamp: string | null;
  ndpaConsentedBy: string | null;
  onboardingCompletedAt: string | null;
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  verificationSubmittedAt: string | null;
  verificationNotes: string | null;
  accountManager: { name: string; email: string } | null;
  contacts: EmployerContact[];
  individualEmployerNeedsAssessment: Record<string, unknown> | null;
  corporateNeedsAssessment: Record<string, unknown> | null;
}

export interface EmployerDocument {
  id: string;
  employerId: string;
  category: 'PROOF_OF_RESIDENCE' | 'EMPLOYER_ID' | 'CAC_CERTIFICATE';
  originalFilename: string;
  mimeType: string;
  status: 'UPLOADING' | 'SCANNING' | 'CLEAN' | 'INFECTED' | 'REJECTED';
  createdAt: string;
}

export interface JobPosting {
  id: string;
  employerId: string;
  title: string;
  description: string;
  duties: string | null;
  country: JobCountry;
  workLocation: string | null;
  schedule: string | null;
  salaryCurrency: JobSalaryCurrency;
  salaryRange: string | null;
  benefits: string[];
  specialisations: string[];
  openings: number;
  deadline: string | null;
  priorityLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  status: JobPostingStatus;
  workforceCategoryId: string | null;
  careTypeId: string | null;
  backgroundCheckRequired: boolean;
  visibility: JobVisibility;
  createdAt: string;
}

export interface WorkforceCategoryOption {
  id: string;
  name: string;
  requiredCertifications: { name: string; lmsCourseRef?: string }[];
}

export interface CareTypeOption {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

export interface BrowseWorkerRow {
  id: string;
  userId: string;
  visibilityStatus: string;
  profileCompletionPct: number;
  workforceCategoryId: string | null;
  submittedAt: string | null;
  fullName: string | null;
  phone: string | null;
  stateOfOrigin: string | null;
  /** Presigned selfie URL — blurred variant unless photoUnlocked. Null when no CLEAN selfie. */
  photoUrl: string | null;
  /** True once a placement contract with this worker is fully executed (clear photo). */
  photoUnlocked: boolean;
}

export interface PublicWorkerProfile {
  id: string;
  visibilityStatus: string;
  photoUrl: string | null;
  photoUnlocked: boolean;
  personal: {
    fullName: string | null;
    stateOfOrigin: string | null;
    lga: string | null;
    nationality: string | null;
    gender: string | null;
  };
  identity: { idType: string | null };
  education: Array<Record<string, unknown>>;
  experience: Array<Record<string, unknown>>;
  skills: Array<{ kind: string; name: string; selfRating: number | null; category: string | null }>;
  interests: string | null;
  personalStatement: string | null;
  preferences: {
    employmentType: string | null;
    preferredCities: unknown;
    relocationWillingness: boolean | null;
  };
  salary: {
    wageStructure: string | null;
    minRate: string | null;
    maxRate: string | null;
    currency: string | null;
    negotiable: boolean | null;
  } | null;
  credentials: {
    identityVerified: boolean;
    backgroundClear: boolean;
    oakvaleCertified: boolean;
    latestOakvaleCertExpiresAt: string | null;
  };
}

export const employersApi = {
  me: () => api.get<{ data: EmployerProfile }>('/employers/me').then((r) => r.data),
  updateMe: (input: EmployerProfileUpdate) =>
    api
      .patch<{ data: EmployerProfile }>('/employers/me', input as Record<string, unknown>)
      .then((r) => r.data),
  addContact: (input: ContactCreateInput) =>
    api
      .post<{ data: EmployerContact }>('/employers/me/contacts', input as Record<string, unknown>)
      .then((r) => r.data),
  updateContact: (id: string, input: ContactUpdateInput) =>
    api
      .patch<{ data: EmployerContact }>(
        `/employers/me/contacts/${id}`,
        input as Record<string, unknown>,
      )
      .then((r) => r.data),
  deleteContact: (id: string) => api.del(`/employers/me/contacts/${id}`),
  upsertIndividualEmployerNeeds: (input: IndividualEmployerNeedsAssessmentInput) =>
    api.put('/employers/me/needs-assessment', input as Record<string, unknown>),
  upsertCorporateNeeds: (input: CorporateNeedsAssessmentInput) =>
    api.put('/employers/me/needs-assessment', input as Record<string, unknown>),
  recordNdpaConsent: () => api.post('/employers/me/ndpa-consent'),
  completeOnboarding: () => api.post('/employers/me/onboarding/complete'),
  listJobPostings: () =>
    api.get<{ data: JobPosting[] }>('/employers/me/job-postings').then((r) => r.data),
  getJobPosting: (id: string) =>
    api.get<{ data: JobPosting }>(`/employers/me/job-postings/${id}`).then((r) => r.data),
  createJobPosting: (input: JobPostingCreateInput) =>
    api
      .post<{ data: JobPosting }>('/employers/me/job-postings', input as Record<string, unknown>)
      .then((r) => r.data),
  updateJobPosting: (id: string, input: JobPostingUpdateInput) =>
    api
      .patch<{ data: JobPosting }>(
        `/employers/me/job-postings/${id}`,
        input as Record<string, unknown>,
      )
      .then((r) => r.data),
  closeJobPosting: (id: string) =>
    api.post<{ data: JobPosting }>(`/employers/me/job-postings/${id}/close`).then((r) => r.data),
  listWorkforceCategories: () =>
    api.get<{ data: WorkforceCategoryOption[] }>('/workers/categories').then((r) => r.data),
  listCareTypes: () =>
    api.get<{ data: CareTypeOption[] }>('/employers/care-types').then((r) => r.data),

  // §6.2 — employer verification documents
  listDocuments: () =>
    api.get<{ data: EmployerDocument[] }>('/employers/me/documents').then((r) => r.data),
  issueDocumentUploadUrl: (input: {
    category: EmployerDocument['category'];
    mimeType: string;
    sizeBytes: number;
    originalFilename: string;
  }) =>
    api
      .post<{ data: { documentId: string; uploadUrl: string; expiresIn: number } }>(
        '/employers/me/documents/upload-url',
        input as Record<string, unknown>,
      )
      .then((r) => r.data),
  confirmDocument: (documentId: string) =>
    api
      .post<{ data: { documentId: string; status: EmployerDocument['status'] } }>(
        '/employers/me/documents/confirm',
        { documentId },
      )
      .then((r) => r.data),

  browseWorkers: (query: Partial<WorkerBrowseQuery> & { workforceCategoryId?: string }) => {
    const qs = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    return api
      .get<{ data: BrowseWorkerRow[]; meta: { total: number; page: number; limit: number } }>(
        `/workers/browse${qs.toString() ? `?${qs}` : ''}`,
      )
      .then((r) => r);
  },
  getBrowsedWorker: (id: string) =>
    api.get<{ data: PublicWorkerProfile }>(`/workers/browse/${id}`).then((r) => r.data),
};

