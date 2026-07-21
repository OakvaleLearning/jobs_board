import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import { AppError } from '@/shared/errors/app-error.js';
import {
  openConversationSchema,
  sendMessageSchema,
} from '@oakvale/shared/schema/messaging.js';
import * as messagingService from './service.js';

function requireUserId(req: FastifyRequest): string {
  if (!req.user) {
    throw new AppError({ code: 'UNAUTHORIZED', message: 'Auth required', statusCode: 401 });
  }
  return req.user.sub;
}

function requireRole(req: FastifyRequest): string {
  if (!req.user) {
    throw new AppError({ code: 'UNAUTHORIZED', message: 'Auth required', statusCode: 401 });
  }
  return req.user.role;
}

export const messagingRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/conversations', { preHandler: app.requireAuth }, async (req) => {
    const rows = await messagingService.listForUser(requireUserId(req), requireRole(req));
    return { data: rows };
  });

  app.post('/conversations', { preHandler: app.requireAuth }, async (req) => {
    const input = openConversationSchema.parse(req.body);
    const row = await messagingService.openOrGetConversation(
      input.shortlistId,
      input.workerId,
      requireUserId(req),
    );
    return { data: row };
  });

  app.get('/conversations/:id/messages', { preHandler: app.requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const rows = await messagingService.listMessages(id, requireUserId(req));
    return { data: rows };
  });

  app.post('/conversations/:id/messages', { preHandler: app.requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const input = sendMessageSchema.parse(req.body);
    const row = await messagingService.sendMessage(id, requireUserId(req), input.body);
    return { data: row };
  });

  // Admin / agent
  app.get('/admin/flagged', { preHandler: app.requireRole('ADMIN', 'AGENT') }, async (req) => {
    const { page, limit } = req.query as { page?: string; limit?: string };
    return messagingService.listFlagged({
      page: page ? Number.parseInt(page, 10) : 1,
      limit: limit ? Number.parseInt(limit, 10) : 25,
    });
  });

  app.post(
    '/admin/messages/:id/release',
    { preHandler: app.requireRole('ADMIN', 'AGENT') },
    async (req) => {
      const { id } = req.params as { id: string };
      const row = await messagingService.releaseMessage(id, requireUserId(req));
      return { data: row };
    },
  );

  app.post(
    '/admin/conversations/:id/lock',
    { preHandler: app.requireRole('ADMIN', 'AGENT') },
    async (req) => {
      const { id } = req.params as { id: string };
      const row = await messagingService.lockConversation(id, requireUserId(req));
      return { data: row };
    },
  );
};
