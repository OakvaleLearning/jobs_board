'use client';

import { api } from './api-client';
import type {
  WorkforceCategoryCreateInput,
  WorkforceCategoryUpdateInput,
} from '@oakvale/shared/schema/workforce-category';

export interface RequiredCertification {
  name: string;
  lmsCourseRef?: string;
}

export interface WorkforceCategoryRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  requiredCertifications: RequiredCertification[];
  requiredIdentityFields: string[];
  skillsMenu: string[];
  specialistTags: string[];
  applicableSettings: string[];
  applicableEmploymentTypes: string[];
  requiredComplianceFields: string[];
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const workforceCategoriesApi = {
  /** Active categories — for worker profile & employer needs selects. */
  list: () =>
    api.get<{ data: WorkforceCategoryRow[] }>('/workers/categories').then((r) => r.data),

  /** Admin: all categories, including inactive. */
  adminList: () =>
    api.get<{ data: WorkforceCategoryRow[] }>('/workers/admin/categories').then((r) => r.data),

  create: (body: WorkforceCategoryCreateInput) =>
    api
      .post<{ data: WorkforceCategoryRow }>('/workers/admin/categories', body)
      .then((r) => r.data),

  update: (id: string, body: WorkforceCategoryUpdateInput) =>
    api
      .patch<{ data: WorkforceCategoryRow }>(`/workers/admin/categories/${id}`, body)
      .then((r) => r.data),
};
