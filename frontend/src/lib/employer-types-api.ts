'use client';

import { api } from './api-client';
import type {
  EmployerTypeCreateInput,
  EmployerTypeUpdateInput,
  EmployerPricing,
} from '@oakvale/shared/schema/employer-type';

export interface EmployerTypeRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  roleKey: string;
  registrationFields: string[];
  verificationMethods: string[];
  serviceModel: string;
  jobPostingEnabled: boolean;
  onboardingSteps: string[];
  allowedWorkerCategoryIds: string[] | null;
  applicableContractTypes: string[];
  pricing: EmployerPricing;
  paymentProviders: string[];
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Trimmed public shape returned by the signup picker. */
export interface PublicEmployerType {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  roleKey: string;
}

export const employerTypesApi = {
  /** Public: active types for the signup picker. */
  listPublic: () =>
    api.get<{ data: PublicEmployerType[] }>('/employers/types').then((r) => r.data),

  /** Admin: all types, including inactive. */
  adminList: () =>
    api.get<{ data: EmployerTypeRow[] }>('/admin/employer-types').then((r) => r.data),

  create: (body: EmployerTypeCreateInput) =>
    api.post<{ data: EmployerTypeRow }>('/admin/employer-types', body).then((r) => r.data),

  update: (id: string, body: EmployerTypeUpdateInput) =>
    api.patch<{ data: EmployerTypeRow }>(`/admin/employer-types/${id}`, body).then((r) => r.data),
};
