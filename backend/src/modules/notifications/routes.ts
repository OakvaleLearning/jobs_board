import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import { AppError } from '@/shared/errors/app-error.js';
import {
  inboxFiltersSchema,
  markReadSchema,
  notificationTemplatePreviewSchema,
  notificationTemplateUpdateSchema,
  preferenceUpdateSchema,
} from '@oakvale/shared/schema/notifications.js';
import * as notifications from './service.js';
import * as preferences from './preferences.js';
import * as templateStore from './template-store.js';

function requireUserId(req: FastifyRequest): string {
  const sub = (req.user as { sub?: string } | undefined)?.sub;
  if (!sub) throw new AppError({ code: 'UNAUTHORIZED', message: 'Auth required.', statusCode: 401 });
  return sub;
}

export const notificationRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/me', { preHandler: app.requireAuth }, async (req) => {
    const userId = requireUserId(req);
    const filters = inboxFiltersSchema.parse(req.query);
    const { rows, total } = await notifications.listForUser(userId, filters);
    return { data: rows, meta: { page: filters.page, limit: filters.limit, total } };
  });

  app.get('/me/unread-count', { preHandler: app.requireAuth }, async (req) => {
    const userId = requireUserId(req);
    const count = await notifications.unreadCount(userId);
    return { data: { count } };
  });

  app.post('/me/mark-read', { preHandler: app.requireAuth }, async (req) => {
    const userId = requireUserId(req);
    const { ids } = markReadSchema.parse(req.body);
    await notifications.markRead(ids, userId);
    return { data: { ok: true } };
  });

  app.post('/me/mark-all-read', { preHandler: app.requireAuth }, async (req) => {
    const userId = requireUserId(req);
    await notifications.markAllRead(userId);
    return { data: { ok: true } };
  });

  app.get('/me/preferences', { preHandler: app.requireAuth }, async (req) => {
    const userId = requireUserId(req);
    const rows = await preferences.listForUser(userId);
    return { data: rows };
  });

  app.patch('/me/preferences', { preHandler: app.requireAuth }, async (req) => {
    const userId = requireUserId(req);
    const { updates } = preferenceUpdateSchema.parse(req.body);
    await preferences.applyUpdates(userId, updates);
    return { data: { ok: true } };
  });

  // --- Admin: notification templates (GAP-004) ---
  app.get(
    '/admin/notification-templates',
    { preHandler: app.requireRole('ADMIN', 'AGENT') },
    async () => {
      const rows = await templateStore.listTemplates();
      return { data: rows };
    },
  );

  app.get(
    '/admin/notification-templates/:kind',
    { preHandler: app.requireRole('ADMIN', 'AGENT') },
    async (req) => {
      const { kind } = req.params as { kind: string };
      const data = await templateStore.getTemplate(kind);
      return { data };
    },
  );

  app.patch(
    '/admin/notification-templates/:kind',
    { preHandler: app.requireRole('ADMIN') },
    async (req) => {
      const { kind } = req.params as { kind: string };
      const input = notificationTemplateUpdateSchema.parse(req.body);
      const row = await templateStore.updateTemplate(kind, input, requireUserId(req));
      return { data: row };
    },
  );

  app.post(
    '/admin/notification-templates/:kind/preview',
    { preHandler: app.requireRole('ADMIN') },
    async (req) => {
      const { kind } = req.params as { kind: string };
      const draft = notificationTemplatePreviewSchema.parse(req.body);
      const data = templateStore.previewTemplate(kind, draft);
      return { data };
    },
  );
};
