'use client';

import { api } from './api-client';
import type {
  NotificationChannel,
  NotificationKind,
  NotificationStatus,
} from '@oakvale/shared/enums/notifications';

export interface NotificationRow {
  id: string;
  userId: string;
  kind: NotificationKind | string;
  channel: NotificationChannel;
  status: NotificationStatus;
  subject: string | null;
  body: string | null;
  payload: Record<string, unknown> | null;
  sentAt: string | null;
  readAt: string | null;
  createdAt: string;
}

function qs(p: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export interface PreferenceRow {
  kind: NotificationKind | string;
  channel: NotificationChannel;
  enabled: boolean;
  digestMode: 'immediate' | 'daily';
  forced: boolean;
}

export const notificationsApi = {
  list: (opts: { unreadOnly?: boolean; page?: number } = {}) =>
    api
      .get<{ data: NotificationRow[]; meta: { total: number; page: number; limit: number } }>(
        `/notifications/me${qs(opts)}`,
      )
      .then((r) => r),
  unreadCount: () =>
    api.get<{ data: { count: number } }>('/notifications/me/unread-count').then((r) => r.data.count),
  markRead: (ids: string[]) =>
    api.post('/notifications/me/mark-read', { ids } as Record<string, unknown>),
  markAllRead: () => api.post('/notifications/me/mark-all-read', {} as Record<string, unknown>),
  getPreferences: () =>
    api.get<{ data: PreferenceRow[] }>('/notifications/me/preferences').then((r) => r.data),
  updatePreferences: (
    updates: Array<{
      kind: string;
      channel: NotificationChannel;
      enabled: boolean;
      digestMode?: 'immediate' | 'daily';
    }>,
  ) => api.patch('/notifications/me/preferences', { updates } as Record<string, unknown>),
};
