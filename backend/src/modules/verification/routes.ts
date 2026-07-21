import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import { workers } from '@/shared/db/schema.js';
import { AppError } from '@/shared/errors/app-error.js';
import { workerVisibilityGate } from '@/modules/compliance/visibility.js';
import {
  backgroundReviewSchema,
  identityReviewSchema,
  queueQuerySchema,
} from '@oakvale/shared/schema/verification.js';
import {
  getQueue,
  getStatus,
  listBackgroundChecks,
  reviewBackground,
  reviewIdentity,
} from './service.js';

function requireUserId(req: FastifyRequest): string {
  const sub = (req.user as { sub?: string } | undefined)?.sub;
  if (!sub) throw new AppError({ code: 'UNAUTHORIZED', message: 'Auth required.', statusCode: 401 });
  return sub;
}

export const verificationRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/me', { preHandler: app.requireRole('WORKER') }, async (req) => {
    const userId = requireUserId(req);
    const worker = await db.query.workers.findFirst({ where: eq(workers.userId, userId) });
    if (!worker) {
      throw new AppError({ code: 'WORKER_NOT_FOUND', message: 'Worker not found.', statusCode: 404 });
    }
    const status = await getStatus(worker.id);
    return { data: { workerId: worker.id, visibilityStatus: worker.visibilityStatus, ...status } };
  });

  app.get('/queue', { preHandler: app.requireRole('AGENT', 'ADMIN') }, async (req) => {
    const filters = queueQuerySchema.parse(req.query);
    const { rows, total } = await getQueue(filters);
    return { data: rows, meta: { total, page: filters.page, limit: filters.limit } };
  });

  app.get(
    '/workers/:workerId',
    { preHandler: app.requireRole('AGENT', 'ADMIN') },
    async (req) => {
      const { workerId } = z.object({ workerId: z.string().uuid() }).parse(req.params);
      const worker = await db.query.workers.findFirst({ where: eq(workers.id, workerId) });
      if (!worker) {
        throw new AppError({ code: 'WORKER_NOT_FOUND', message: 'Worker not found.', statusCode: 404 });
      }
      const [status, visibilityGate] = await Promise.all([
        getStatus(workerId),
        workerVisibilityGate(workerId),
      ]);
      return {
        data: { workerId, visibilityStatus: worker.visibilityStatus, visibilityGate, ...status },
      };
    },
  );

  app.post(
    '/workers/:workerId/identity/review',
    { preHandler: app.requireRole('AGENT', 'ADMIN') },
    async (req) => {
      const reviewerId = requireUserId(req);
      const { workerId } = z.object({ workerId: z.string().uuid() }).parse(req.params);
      const input = identityReviewSchema.parse(req.body);
      await reviewIdentity(workerId, reviewerId, input);
      return { data: { reviewed: true } };
    },
  );

  app.post(
    '/workers/:workerId/background/review',
    { preHandler: app.requireRole('AGENT', 'ADMIN') },
    async (req) => {
      const reviewerId = requireUserId(req);
      const { workerId } = z.object({ workerId: z.string().uuid() }).parse(req.params);
      const input = backgroundReviewSchema.parse(req.body);
      await reviewBackground(workerId, reviewerId, input);
      return { data: { reviewed: true } };
    },
  );

  app.get(
    '/background-checks',
    { preHandler: app.requireRole('AGENT', 'ADMIN') },
    async (req) => {
      const filters = queueQuerySchema.parse(req.query);
      const rows = await listBackgroundChecks(filters);
      return { data: rows, meta: { page: filters.page, limit: filters.limit } };
    },
  );
};
