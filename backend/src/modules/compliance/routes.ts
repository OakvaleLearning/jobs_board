import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import { workers } from '@/shared/db/schema.js';
import { AppError } from '@/shared/errors/app-error.js';
import {
  certificationCreateSchema,
  cpdEnrolSchema,
  cpdRecordCreateSchema,
  flagCreateSchema,
  queueQuerySchema,
} from '@oakvale/shared/schema/verification.js';
import {
  addCertification,
  addCpdRecord,
  getStatusFor,
  isWorkerVisible,
  listFlags,
  raiseFlag,
  resolveFlag,
  verifyCpdRecord,
} from './service.js';
import {
  completeEnrolment,
  enrol,
  listEnrolments,
  listProgrammes,
} from './enrolment.js';

function requireUserId(req: FastifyRequest): string {
  const sub = (req.user as { sub?: string } | undefined)?.sub;
  if (!sub) throw new AppError({ code: 'UNAUTHORIZED', message: 'Auth required.', statusCode: 401 });
  return sub;
}

async function workerIdForUser(userId: string): Promise<string> {
  const w = await db.query.workers.findFirst({ where: eq(workers.userId, userId) });
  if (!w) throw new AppError({ code: 'WORKER_NOT_FOUND', message: 'Worker not found.', statusCode: 404 });
  return w.id;
}

export const complianceRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/me', { preHandler: app.requireRole('WORKER') }, async (req) => {
    const userId = requireUserId(req);
    const wid = await workerIdForUser(userId);
    const status = await getStatusFor(wid);
    const visible = await isWorkerVisible(wid);
    return { data: { ...status, visibleToEmployers: visible } };
  });

  app.post('/me/cpd-records', { preHandler: app.requireRole('WORKER') }, async (req) => {
    const userId = requireUserId(req);
    const wid = await workerIdForUser(userId);
    const input = cpdRecordCreateSchema.parse(req.body);
    const row = await addCpdRecord(wid, input);
    return { data: row };
  });

  app.post('/me/certifications', { preHandler: app.requireRole('WORKER') }, async (req) => {
    const userId = requireUserId(req);
    const wid = await workerIdForUser(userId);
    const input = certificationCreateSchema.parse(req.body);
    const row = await addCertification(wid, input);
    return { data: row };
  });

  /* §14.2 — in-app CPD refresh enrolment */
  app.get('/cpd/programmes', { preHandler: app.requireRole('WORKER') }, async () => {
    return { data: listProgrammes() };
  });

  app.get('/me/cpd-enrolments', { preHandler: app.requireRole('WORKER') }, async (req) => {
    const wid = await workerIdForUser(requireUserId(req));
    const rows = await listEnrolments(wid);
    return { data: rows };
  });

  app.post('/me/cpd-enrolments', { preHandler: app.requireRole('WORKER') }, async (req) => {
    const wid = await workerIdForUser(requireUserId(req));
    const input = cpdEnrolSchema.parse(req.body);
    const row = await enrol(wid, input.programmeId);
    return { data: row };
  });

  app.post(
    '/me/cpd-enrolments/:id/complete',
    { preHandler: app.requireRole('WORKER') },
    async (req) => {
      const wid = await workerIdForUser(requireUserId(req));
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
      const row = await completeEnrolment(id, wid);
      return { data: row };
    },
  );

  // Admin/agent
  app.post(
    '/workers/:workerId/cpd-records/:recordId/verify',
    { preHandler: app.requireRole('AGENT', 'ADMIN') },
    async (req) => {
      const reviewerId = requireUserId(req);
      const { recordId } = z
        .object({ workerId: z.string().uuid(), recordId: z.string().uuid() })
        .parse(req.params);
      await verifyCpdRecord(recordId, reviewerId);
      return { data: { verified: true } };
    },
  );

  app.post(
    '/workers/:workerId/certifications',
    { preHandler: app.requireRole('AGENT', 'ADMIN') },
    async (req) => {
      const { workerId } = z.object({ workerId: z.string().uuid() }).parse(req.params);
      const input = certificationCreateSchema.parse(req.body);
      const row = await addCertification(workerId, input);
      return { data: row };
    },
  );

  app.get(
    '/workers/:workerId',
    { preHandler: app.requireRole('AGENT', 'ADMIN') },
    async (req) => {
      const { workerId } = z.object({ workerId: z.string().uuid() }).parse(req.params);
      const status = await getStatusFor(workerId);
      return { data: status };
    },
  );

  app.get('/flags', { preHandler: app.requireRole('AGENT', 'ADMIN') }, async (req) => {
    const filters = queueQuerySchema
      .extend({ onlyActive: z.coerce.boolean().default(true) })
      .parse(req.query);
    const rows = await listFlags({
      page: filters.page,
      limit: filters.limit,
      onlyActive: filters.onlyActive,
    });
    return { data: rows, meta: { page: filters.page, limit: filters.limit } };
  });

  app.post('/flags', { preHandler: app.requireRole('AGENT', 'ADMIN') }, async (req) => {
    const raisedBy = requireUserId(req);
    const input = flagCreateSchema.parse(req.body);
    const row = await raiseFlag({ ...input, raisedBy });
    return { data: row };
  });

  app.patch(
    '/flags/:id/resolve',
    { preHandler: app.requireRole('AGENT', 'ADMIN') },
    async (req) => {
      const reviewerId = requireUserId(req);
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
      await resolveFlag(id, reviewerId);
      return { data: { resolved: true } };
    },
  );
};
