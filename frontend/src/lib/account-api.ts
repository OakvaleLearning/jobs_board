import { api } from './api-client';
import type { AuthUser } from './auth-store';
import type { UpdateAccountInput, ChangePasswordInput } from '@oakvale/shared/schema/auth';

/**
 * Self-serve account endpoints shared by every role. Backed by the auth module,
 * which owns the `users` table. Email is display-only (no change endpoint).
 */
export const accountApi = {
  me: () => api.get<{ data: { user: AuthUser } }>('/auth/me').then((r) => r.data.user),
  updateMe: (input: UpdateAccountInput) =>
    api.patch<{ data: { user: AuthUser } }>('/auth/me', input).then((r) => r.data.user),
  changePassword: (input: ChangePasswordInput) =>
    api.post<{ data: { changed: boolean } }>('/auth/change-password', input).then((r) => r.data),
};
