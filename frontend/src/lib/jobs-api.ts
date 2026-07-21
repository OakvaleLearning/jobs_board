'use client';

import { api } from './api-client';
import type {
  JobApplicationStatus,
  JobCountry,
  JobPostingStatus,
  JobSalaryCurrency,
  JobVisibility,
} from '@oakvale/shared/enums/employer';

export interface JobPostingRow {
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
  orgName?: string;
  careTypeName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobApplicationRow {
  id: string;
  jobPostingId: string;
  workerId: string;
  status: JobApplicationStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  // joined
  jobTitle?: string;
  orgName?: string;
  workerName?: string | null;
}

function buildQs(p: Record<string, unknown>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  return qs.toString() ? `?${qs.toString()}` : '';
}

export const jobsApi = {
  // Worker
  browse: (params: { q?: string; page?: number; limit?: number } = {}) =>
    api.get<{ data: JobPostingRow[] }>(`/workers/jobs${buildQs(params)}`).then((r) => r.data),
  myApplications: () =>
    api.get<{ data: JobApplicationRow[] }>(`/workers/jobs/applications/me`).then((r) => r.data),
  apply: (jobId: string, note?: string) =>
    api.post<{ data: JobApplicationRow }>(`/workers/jobs/${jobId}/apply`, { note }),

  // Employer (corporate) — applicants
  applicants: (jobId: string) =>
    api
      .get<{ data: JobApplicationRow[] }>(`/employers/me/job-postings/${jobId}/applications`)
      .then((r) => r.data),
  setApplicationStatus: (jobId: string, appId: string, status: JobApplicationStatus) =>
    api.patch<{ data: JobApplicationRow }>(
      `/employers/me/job-postings/${jobId}/applications/${appId}`,
      { status },
    ),

  // Admin / agent — review queue
  adminList: (params: { status?: JobPostingStatus; page?: number; limit?: number } = {}) =>
    api.get<{ data: JobPostingRow[] }>(`/admin/job-postings${buildQs(params)}`).then((r) => r.data),
  review: (jobId: string, approved: boolean, notes?: string) =>
    api.post<{ data: JobPostingRow }>(`/admin/job-postings/${jobId}/review`, { approved, notes }),
};
