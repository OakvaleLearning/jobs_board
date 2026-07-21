'use client';

import { api } from './api-client';
import type {
  CertificationInput,
  CpdRecordInput,
  FlagCreateInput,
} from '@oakvale/shared/schema/verification';
import type { CertType, FlagSeverity, FlagType } from '@oakvale/shared/enums/verification';

export interface CpdRecord {
  id: string;
  workerId: string;
  courseName: string;
  provider: string;
  completedAt: string;
  expiresAt: string | null;
  hoursCompleted: string | null;
  certificateDocumentId: string | null;
  verifiedByOakvale: boolean;
  verifiedAt: string | null;
}

export interface Certification {
  id: string;
  workerId: string;
  certType: CertType;
  certNumber: string | null;
  issuedBy: string;
  issuedAt: string;
  expiresAt: string | null;
  isOakvaleCert: boolean;
}

export interface CategoryRequirements {
  categoryId: string;
  categoryName: string;
  requiredCertifications: { name: string; met: boolean }[];
  requiredIdentityFields: string[];
  requiredComplianceFields: string[];
}

export interface ComplianceStatusResp {
  cpdRecords: CpdRecord[];
  certifications: Certification[];
  oakvaleCertified: boolean;
  categoryRequirements: CategoryRequirements | null;
  activeFlags: { id: string; flagType: FlagType; severity: string; raisedAt: string; details: string }[];
  visibleToEmployers: boolean;
}

export interface FlagRow {
  id: string;
  workerId: string;
  fullName: string | null;
  flagType: FlagType;
  severity: FlagSeverity;
  raisedAt: string;
  resolvedAt: string | null;
  details: string;
}

export interface CpdProgramme {
  id: string;
  name: string;
  hours: number;
}

export interface CpdEnrolment {
  id: string;
  workerId: string;
  programmeId: string;
  programmeName: string;
  status: 'ENROLLED' | 'IN_PROGRESS' | 'COMPLETED';
  lmsEnrolmentId: string | null;
  enrolledAt: string;
  completedAt: string | null;
}

export const complianceApi = {
  me: () => api.get<{ data: ComplianceStatusResp }>('/compliance/me').then((r) => r.data),
  addCpd: (input: CpdRecordInput) =>
    api.post<{ data: CpdRecord }>('/compliance/me/cpd-records', input as Record<string, unknown>).then((r) => r.data),
  cpdProgrammes: () =>
    api.get<{ data: CpdProgramme[] }>('/compliance/cpd/programmes').then((r) => r.data),
  cpdEnrolments: () =>
    api.get<{ data: CpdEnrolment[] }>('/compliance/me/cpd-enrolments').then((r) => r.data),
  enrolCpd: (programmeId: string) =>
    api.post<{ data: CpdEnrolment }>('/compliance/me/cpd-enrolments', { programmeId }).then((r) => r.data),
  completeCpdEnrolment: (id: string) =>
    api.post<{ data: CpdEnrolment }>(`/compliance/me/cpd-enrolments/${id}/complete`).then((r) => r.data),
  addCertification: (input: CertificationInput) =>
    api
      .post<{ data: Certification }>('/compliance/me/certifications', input as Record<string, unknown>)
      .then((r) => r.data),
  flags: (params?: { onlyActive?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.onlyActive === false) qs.set('onlyActive', 'false');
    return api.get<{ data: FlagRow[] }>(`/compliance/flags${qs.toString() ? `?${qs}` : ''}`).then((r) => r.data);
  },
  raiseFlag: (input: FlagCreateInput) =>
    api.post<{ data: FlagRow }>('/compliance/flags', input as Record<string, unknown>),
  resolveFlag: (id: string) => api.patch(`/compliance/flags/${id}/resolve`),
};
