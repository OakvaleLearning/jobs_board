import { eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import { EMPLOYER_ROLES } from '@oakvale/shared/roles.js';
import { AppError } from '@/shared/errors/app-error.js';
import { db } from '@/shared/db/client.js';
import { employers, workers, shortlists } from '@/shared/db/schema.js';
import {
  offerCounterSchema,
  offerCreateSchema,
  offerDeclineSchema,
  offerFiltersSchema,
} from '@oakvale/shared/schema/offer.js';
import * as offersService from './service.js';
import * as placementsService from '@/modules/placements/service.js';

function requireUserId(req: FastifyRequest): string {
  if (!req.user) {
    throw new AppError({ code: 'UNAUTHORIZED', message: 'Auth required', statusCode: 401 });
  }
  return req.user.sub;
}

async function getEmployerOrThrow(userId: string) {
  const e = await db.query.employers.findFirst({ where: eq(employers.userId, userId) });
  if (!e) {
    throw new AppError({
      code: 'EMPLOYER_NOT_FOUND',
      message: 'Employer profile not found',
      statusCode: 404,
    });
  }
  return e;
}

async function getWorkerOrThrow(userId: string) {
  const w = await db.query.workers.findFirst({ where: eq(workers.userId, userId) });
  if (!w) {
    throw new AppError({
      code: 'WORKER_NOT_FOUND',
      message: 'Worker profile not found',
      statusCode: 404,
    });
  }
  return w;
}

export const offerRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Employer: create
  app.post(
    '/',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const employer = await getEmployerOrThrow(requireUserId(req));
      const input = offerCreateSchema.parse(req.body);
      const row = await offersService.createOffer(input, requireUserId(req), employer.id);
      return { data: row };
    },
  );

  // Employer: own list
  app.get(
    '/me/employer',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const employer = await getEmployerOrThrow(requireUserId(req));
      const filters = offerFiltersSchema.parse(req.query);
      return offersService.listForEmployer(employer.id, filters);
    },
  );

  // Worker: own list
  app.get('/me/worker', { preHandler: app.requireRole('WORKER') }, async (req) => {
    const worker = await getWorkerOrThrow(requireUserId(req));
    const filters = offerFiltersSchema.parse(req.query);
    return offersService.listForWorker(worker.id, filters);
  });

  // Anyone authed: detail (role check happens at action endpoints)
  app.get('/:id', { preHandler: app.requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const row = await offersService.detail(id);
    return { data: row };
  });

  // Worker: respond
  app.post('/:id/accept', { preHandler: app.requireRole('WORKER') }, async (req) => {
    const { id } = req.params as { id: string };
    const userId = requireUserId(req);
    const row = await offersService.workerAccept(id, userId, async (offerId) => {
      const offer = await offersService.detail(offerId);
      const sl = await db.query.shortlists.findFirst({ where: eq(shortlists.id, offer.shortlistId) });
      return placementsService.createFromOffer({
        shortlistId: offer.shortlistId,
        employerId: offer.employerId,
        workerId: offer.workerId,
        jobPostingId: sl?.jobPostingId ?? null,
        pipelineType: offer.pipelineType,
        actorUserId: userId,
      });
    });
    return { data: row };
  });

  app.post('/:id/decline', { preHandler: app.requireRole('WORKER') }, async (req) => {
    const { id } = req.params as { id: string };
    const input = offerDeclineSchema.parse(req.body);
    const row = await offersService.workerDecline(id, requireUserId(req), input.reason);
    return { data: row };
  });

  app.post('/:id/counter', { preHandler: app.requireRole('WORKER') }, async (req) => {
    const { id } = req.params as { id: string };
    const input = offerCounterSchema.parse(req.body);
    const row = await offersService.workerCounter(id, requireUserId(req), input);
    return { data: row };
  });

  // Employer or admin: withdraw
  app.post(
    '/:id/withdraw',
    { preHandler: app.requireRole(...EMPLOYER_ROLES, 'AGENT', 'ADMIN') },
    async (req) => {
      const { id } = req.params as { id: string };
      const row = await offersService.withdraw(id, requireUserId(req));
      return { data: row };
    },
  );

  // Agent / Admin: review queue + approve
  app.get('/admin/review-queue', { preHandler: app.requireRole('ADMIN', 'AGENT') }, async (req) => {
    const { page, limit } = req.query as { page?: string; limit?: string };
    return offersService.listForAgentReview({
      page: page ? Number.parseInt(page, 10) : 1,
      limit: limit ? Number.parseInt(limit, 10) : 25,
    });
  });

  app.post(
    '/admin/:id/approve',
    { preHandler: app.requireRole('ADMIN', 'AGENT') },
    async (req) => {
      const { id } = req.params as { id: string };
      const row = await offersService.agentApprove(id, requireUserId(req));
      return { data: row };
    },
  );
};
