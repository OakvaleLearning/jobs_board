'use client';

import { api } from './api-client';

export interface ConversationRow {
  id: string;
  shortlistId: string;
  employerId: string;
  workerId: string;
  status: 'OPEN' | 'LOCKED';
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MessageRow {
  id: string;
  conversationId: string;
  senderUserId: string;
  body: string;
  flaggedForReview: boolean;
  flaggedReasons: string[];
  redactedBody: string | null;
  reviewedByAgentId: string | null;
  reviewedAt: string | null;
  readByRecipientAt: string | null;
  /** Set when the message was rejected for contact details and never delivered. */
  blockedAt: string | null;
  createdAt: string;
}

export const messagingApi = {
  conversations: () =>
    api.get<{ data: ConversationRow[] }>('/messaging/conversations').then((r) => r.data),
  openConversation: (body: { shortlistId: string; workerId: string }) =>
    api.post<{ data: ConversationRow }>('/messaging/conversations', body),
  messages: (conversationId: string) =>
    api
      .get<{ data: MessageRow[] }>(`/messaging/conversations/${conversationId}/messages`)
      .then((r) => r.data),
  send: (conversationId: string, body: string) =>
    api.post<{ data: MessageRow }>(`/messaging/conversations/${conversationId}/messages`, { body }),
  adminFlagged: (params: { page?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    const tail = qs.toString() ? `?${qs.toString()}` : '';
    return api.get<{ data: MessageRow[]; meta: { total: number; page: number; limit: number } }>(
      `/messaging/admin/flagged${tail}`,
    );
  },
  adminRelease: (id: string) =>
    api.post<{ data: MessageRow }>(`/messaging/admin/messages/${id}/release`),
  adminLock: (id: string) =>
    api.post<{ data: ConversationRow }>(`/messaging/admin/conversations/${id}/lock`),
};
