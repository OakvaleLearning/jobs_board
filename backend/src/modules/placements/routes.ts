import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { EMPLOYER_ROLES, isEmployerRole } from '@oakvale/shared/roles.js';
import { db } from '@/shared/db/client.js';
import {
  employers,
  users,
  welfareReports,
  workerPersonalInfo,
  workers,
} from '@/shared/db/schema.js';
import { storage } from '@/shared/storage/r2.js';
import {
  getEscalationOrThrow,
  listForPlacement as listEscalationsForPlacement,
  listOpen as listOpenEscalations,
  resolve as resolveEscalation,
} from './welfare-escalations.js';
import {
  normalisePlacementRecord,
  renderPlacementRecord,
} from '@/shared/pdf/placement-record.js';
import { AppError } from '@/shared/errors/app-error.js';
import {
  endPlacementSchema,
  fulfilReplacementSchema,
  generateShortlistSchema,
  overrideShortlistSchema,
  placementFiltersSchema,
  ratingCreateSchema,
  replacementRequestSchema,
  selectWorkerSchema,
  welfareCheckLogSchema,
} from '@oakvale/shared/schema/placement.js';
import {
  activatePlacement,
  adminList,
  adminListShortlists,
  endPlacement,
  fulfilReplacement,
  generateShortlist,
  getPlacementOrThrow,
  getShortlist,
  listForEmployer,
  listForWorker,
  listOpenReplacementRequests,
  listPlacementEvents,
  listShortlistsForEmployer,
  listWelfareChecks,
  logWelfareCheck,
  markShortlistViewed,
  overrideShortlist,
  requestReplacement,
  selectWorker,
} from './service.js';
import * as interviewsService from './interviews.js';
import { createRating, getWorkerRatingSummary, listWorkerRatings } from './ratings.js';
import { isPlacementFeePaid } from '@/modules/payments/service.js';
import {
  interviewConfirmSchema,
  interviewOutcomeSchema,
  interviewProposeSchema,
  interviewRequestSchema,
} from '@oakvale/shared/schema/interview.js';

function requireUserId(req: FastifyRequest): string {
  const sub = (req.user as { sub?: string } | undefined)?.sub;
  if (!sub) throw new AppError({ code: 'UNAUTHORIZED', message: 'Auth required.', statusCode: 401 });
  return sub;
}

function getRole(req: FastifyRequest): string | undefined {
  return (req.user as { role?: string } | undefined)?.role;
}

async function employerIdForUser(userId: string): Promise<string> {
  const e = await db.query.employers.findFirst({ where: eq(employers.userId, userId) });
  if (!e) throw new AppError({ code: 'EMPLOYER_NOT_FOUND', message: 'Employer not found.', statusCode: 404 });
  return e.id;
}

async function workerIdForUser(userId: string): Promise<string> {
  const w = await db.query.workers.findFirst({ where: eq(workers.userId, userId) });
  if (!w) throw new AppError({ code: 'WORKER_NOT_FOUND', message: 'Worker not found.', statusCode: 404 });
  return w.id;
}

async function assertCanViewPlacement(req: FastifyRequest, placementId: string) {
  const userId = requireUserId(req);
  const role = getRole(req);
  const p = await getPlacementOrThrow(placementId);
  if (role === 'ADMIN' || role === 'AGENT') return p;
  if (role === 'WORKER') {
    const wid = await workerIdForUser(userId);
    if (p.workerId === wid) return p;
  }
  if (isEmployerRole(role)) {
    const eid = await employerIdForUser(userId);
    if (p.employerId === eid) return p;
  }
  throw new AppError({ code: 'FORBIDDEN', message: 'You cannot view this placement.', statusCode: 403 });
}

const idParam = z.object({ id: z.string().uuid() });
const placementIdParam = z.object({ placementId: z.string().uuid() });

export const placementRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /* Worker — own placements */
  app.get('/me', { preHandler: app.requireRole('WORKER') }, async (req) => {
    const userId = requireUserId(req);
    const wid = await workerIdForUser(userId);
    const rows = await listForWorker(wid);
    return { data: rows };
  });

  /* Interviews (PRD 6.5) */
  // Worker — my interviews + respond
  app.get('/interviews/me', { preHandler: app.requireRole('WORKER') }, async (req) => {
    const wid = await workerIdForUser(requireUserId(req));
    const rows = await interviewsService.listForWorker(wid);
    return { data: rows };
  });

  app.post('/interviews/:id/accept', { preHandler: app.requireRole('WORKER') }, async (req) => {
    const wid = await workerIdForUser(requireUserId(req));
    const { id } = idParam.parse(req.params);
    const { slot } = interviewConfirmSchema.parse(req.body);
    const row = await interviewsService.workerConfirm(wid, id, slot);
    return { data: row };
  });

  app.post('/interviews/:id/propose', { preHandler: app.requireRole('WORKER') }, async (req) => {
    const wid = await workerIdForUser(requireUserId(req));
    const { id } = idParam.parse(req.params);
    const { slots } = interviewProposeSchema.parse(req.body);
    const row = await interviewsService.workerPropose(wid, id, slots);
    return { data: row };
  });

  // Employer — request, list, confirm reschedule, log outcome, cancel
  app.get(
    '/interviews/employer/me',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const eid = await employerIdForUser(requireUserId(req));
      const rows = await interviewsService.listForEmployer(eid);
      return { data: rows };
    },
  );

  app.post(
    '/interviews',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const userId = requireUserId(req);
      const eid = await employerIdForUser(userId);
      const input = interviewRequestSchema.parse(req.body);
      const row = await interviewsService.requestInterview({
        employerId: eid,
        workerId: input.workerId,
        shortlistId: input.shortlistId,
        jobPostingId: input.jobPostingId,
        format: input.format,
        proposedSlots: input.proposedSlots,
        createdBy: userId,
      });
      return { data: row };
    },
  );

  app.post(
    '/interviews/:id/confirm',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const eid = await employerIdForUser(requireUserId(req));
      const { id } = idParam.parse(req.params);
      const { slot } = interviewConfirmSchema.parse(req.body);
      const row = await interviewsService.employerConfirm(eid, id, slot);
      return { data: row };
    },
  );

  app.post(
    '/interviews/:id/outcome',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const eid = await employerIdForUser(requireUserId(req));
      const { id } = idParam.parse(req.params);
      const { outcome, notes } = interviewOutcomeSchema.parse(req.body);
      const row = await interviewsService.logOutcome(eid, id, outcome, notes);
      return { data: row };
    },
  );

  app.post(
    '/interviews/:id/cancel',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const eid = await employerIdForUser(requireUserId(req));
      const { id } = idParam.parse(req.params);
      const row = await interviewsService.cancel(eid, id);
      return { data: row };
    },
  );

  // Admin/Agent — visibility into all interviews
  app.get(
    '/admin/interviews',
    { preHandler: app.requireRole('ADMIN', 'AGENT') },
    async (req) => {
      const q = z
        .object({
          page: z.coerce.number().int().min(1).default(1),
          limit: z.coerce.number().int().min(1).max(100).default(50),
        })
        .parse(req.query);
      const rows = await interviewsService.adminList(q);
      return { data: rows, meta: { page: q.page, limit: q.limit } };
    },
  );

  /* Employer — own placements + shortlists */
  app.get(
    '/employer/me',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const userId = requireUserId(req);
      const eid = await employerIdForUser(userId);
      const rows = await listForEmployer(eid);
      return { data: rows };
    },
  );

  app.get(
    '/employer/me/shortlists',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const userId = requireUserId(req);
      const eid = await employerIdForUser(userId);
      const rows = await listShortlistsForEmployer(eid);
      return { data: rows };
    },
  );

  app.get(
    '/employer/me/shortlists/:id',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const userId = requireUserId(req);
      const eid = await employerIdForUser(userId);
      const { id } = idParam.parse(req.params);
      const s = await getShortlist(id);
      if (s.employerId !== eid) {
        throw new AppError({ code: 'FORBIDDEN', message: 'Not your shortlist.', statusCode: 403 });
      }
      await markShortlistViewed(id);
      return { data: s };
    },
  );

  app.post(
    '/employer/me/shortlists/:id/select',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const userId = requireUserId(req);
      const eid = await employerIdForUser(userId);
      const { id } = idParam.parse(req.params);
      const s = await getShortlist(id);
      if (s.employerId !== eid) {
        throw new AppError({ code: 'FORBIDDEN', message: 'Not your shortlist.', statusCode: 403 });
      }
      const { workerId } = selectWorkerSchema.parse(req.body);
      const p = await selectWorker(id, workerId, userId);
      return { data: p };
    },
  );

  /* Placement detail + welfare/replacement (auth-scoped per row) */
  app.get('/:placementId', { preHandler: app.requireAuth }, async (req) => {
    const { placementId } = placementIdParam.parse(req.params);
    const p = await assertCanViewPlacement(req, placementId);
    const events = await listPlacementEvents(placementId);
    const welfare = await listWelfareChecks(placementId);
    return { data: { placement: p, events, welfareChecks: welfare } };
  });

  app.get('/:placementId/record.pdf', { preHandler: app.requireAuth }, async (req, reply) => {
    const { placementId } = placementIdParam.parse(req.params);
    const p = await assertCanViewPlacement(req, placementId);
    const employerRow = await db
      .select({ orgName: employers.orgName, email: users.email, fullName: users.fullName })
      .from(employers)
      .innerJoin(users, eq(users.id, employers.userId))
      .where(eq(employers.id, p.employerId))
      .limit(1);
    const workerRow = await db
      .select({ fullName: workerPersonalInfo.fullName, stateOfOrigin: workerPersonalInfo.stateOfOrigin })
      .from(workerPersonalInfo)
      .where(eq(workerPersonalInfo.workerId, p.workerId))
      .limit(1);
    const welfare = await listWelfareChecks(placementId);
    const data = normalisePlacementRecord(
      {
        id: p.id,
        pipelineType: p.pipelineType as 'INDIVIDUAL_EMPLOYER' | 'CORPORATE',
        status: p.status,
        placedAt: p.placedAt as unknown as Date | null,
        activatedAt: p.activatedAt as unknown as Date | null,
        guaranteeExpiresAt: p.guaranteeExpiresAt as unknown as Date | null,
        endedAt: p.endedAt as unknown as Date | null,
        endReason: p.endReason,
      },
      {
        orgName: employerRow[0]?.orgName ?? null,
        contactName: employerRow[0]?.fullName ?? null,
        email: employerRow[0]?.email ?? '—',
      },
      {
        fullName: workerRow[0]?.fullName ?? null,
        stateOfOrigin: workerRow[0]?.stateOfOrigin ?? null,
      },
      welfare.length,
    );
    const pdf = await renderPlacementRecord(data);
    return reply
      .header('Content-Type', 'application/pdf')
      .header(
        'Content-Disposition',
        `attachment; filename="placement_${placementId.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.pdf"`,
      )
      .send(pdf);
  });

  app.post(
    '/:placementId/welfare-checks',
    { preHandler: app.requireRole('AGENT', 'ADMIN') },
    async (req) => {
      const userId = requireUserId(req);
      const { placementId } = placementIdParam.parse(req.params);
      await getPlacementOrThrow(placementId);
      const input = welfareCheckLogSchema.parse(req.body);
      await logWelfareCheck(placementId, input, userId);
      return { data: { logged: true } };
    },
  );

  app.post(
    '/:placementId/request-replacement',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const userId = requireUserId(req);
      const eid = await employerIdForUser(userId);
      const { placementId } = placementIdParam.parse(req.params);
      const p = await getPlacementOrThrow(placementId);
      if (p.employerId !== eid) {
        throw new AppError({ code: 'FORBIDDEN', message: 'Not your placement.', statusCode: 403 });
      }
      const { reason } = replacementRequestSchema.parse(req.body);
      const row = await requestReplacement(placementId, userId, reason);
      return { data: row };
    },
  );

  /* Ratings (§14.2) — employer rates the worker on a placement they own */
  app.post(
    '/:placementId/rating',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const userId = requireUserId(req);
      const eid = await employerIdForUser(userId);
      const { placementId } = placementIdParam.parse(req.params);
      const input = ratingCreateSchema.parse(req.body);
      const row = await createRating(placementId, eid, userId, input);
      return { data: row };
    },
  );

  // Worker rating summary + reviews — visible to employers (browsing) and agents/admins.
  app.get(
    '/workers/:workerId/ratings',
    { preHandler: app.requireRole(...EMPLOYER_ROLES, 'AGENT', 'ADMIN') },
    async (req) => {
      const { workerId } = z.object({ workerId: z.string().uuid() }).parse(req.params);
      const [summary, reviews] = await Promise.all([
        getWorkerRatingSummary(workerId),
        listWorkerRatings(workerId),
      ]);
      return { data: { summary, reviews } };
    },
  );

  /* Admin endpoints */
  app.get('/admin', { preHandler: app.requireRole('AGENT', 'ADMIN') }, async (req) => {
    const filters = placementFiltersSchema.parse(req.query);
    const { rows, total } = await adminList(filters);
    return { data: rows, meta: { total, page: filters.page, limit: filters.limit } };
  });

  app.post(
    '/admin/:placementId/activate',
    { preHandler: app.requireRole('AGENT', 'ADMIN') },
    async (req) => {
      const userId = requireUserId(req);
      const { placementId } = placementIdParam.parse(req.params);
      // Business Rule #3 — never activate a placement whose placement fee is unpaid.
      if (!(await isPlacementFeePaid(placementId))) {
        throw new AppError({
          code: 'PAYMENT_REQUIRED',
          message: 'Placement fee invoice must be paid before the placement can be activated.',
          statusCode: 402,
        });
      }
      await activatePlacement(placementId, userId);
      return { data: { activated: true } };
    },
  );

  app.post(
    '/admin/:placementId/end',
    { preHandler: app.requireRole('AGENT', 'ADMIN') },
    async (req) => {
      const userId = requireUserId(req);
      const { placementId } = placementIdParam.parse(req.params);
      const input = endPlacementSchema.parse(req.body);
      await endPlacement(placementId, input.endReason, userId, input.notes);
      return { data: { ended: true } };
    },
  );

  app.get(
    '/admin/shortlists',
    { preHandler: app.requireRole('AGENT', 'ADMIN') },
    async (req) => {
      const filters = placementFiltersSchema.parse(req.query);
      const { rows, total } = await adminListShortlists({ page: filters.page, limit: filters.limit });
      return { data: rows, meta: { total, page: filters.page, limit: filters.limit } };
    },
  );

  app.get(
    '/admin/shortlists/:id',
    { preHandler: app.requireRole('AGENT', 'ADMIN') },
    async (req) => {
      const { id } = idParam.parse(req.params);
      const s = await getShortlist(id);
      return { data: s };
    },
  );

  app.post(
    '/admin/shortlists/generate',
    { preHandler: app.requireRole('AGENT', 'ADMIN') },
    async (req) => {
      const userId = requireUserId(req);
      const input = generateShortlistSchema.parse(req.body);
      const result = await generateShortlist({
        employerId: input.employerId,
        jobPostingId: input.jobPostingId ?? null,
        createdBy: userId,
      });
      return { data: result };
    },
  );

  app.post(
    '/admin/shortlists/:id/override',
    { preHandler: app.requireRole('AGENT', 'ADMIN') },
    async (req) => {
      const { id } = idParam.parse(req.params);
      const input = overrideShortlistSchema.parse(req.body);
      const matches = await overrideShortlist(id, input.workerIds);
      return { data: matches };
    },
  );

  app.get(
    '/admin/replacement-requests',
    { preHandler: app.requireRole('AGENT', 'ADMIN') },
    async () => {
      const rows = await listOpenReplacementRequests();
      return { data: rows };
    },
  );

  /* Welfare reports + escalations */
  app.get('/:placementId/welfare-reports', { preHandler: app.requireAuth }, async (req) => {
    const { placementId } = placementIdParam.parse(req.params);
    await assertCanViewPlacement(req, placementId);
    const rows = await db
      .select({
        id: welfareReports.id,
        welfareCheckId: welfareReports.welfareCheckId,
        deliveredToEmail: welfareReports.deliveredToEmail,
        deliveredAt: welfareReports.deliveredAt,
        createdAt: welfareReports.createdAt,
        hasStorage: welfareReports.storageKey,
      })
      .from(welfareReports)
      .where(eq(welfareReports.placementId, placementId))
      .orderBy(desc(welfareReports.createdAt));
    return {
      data: rows.map((r) => ({
        id: r.id,
        welfareCheckId: r.welfareCheckId,
        deliveredToEmail: r.deliveredToEmail,
        deliveredAt: r.deliveredAt,
        createdAt: r.createdAt,
      })),
    };
  });

  app.get(
    '/:placementId/welfare-reports/:reportId/download',
    { preHandler: app.requireAuth },
    async (req, reply) => {
      const params = z
        .object({ placementId: z.string().uuid(), reportId: z.string().uuid() })
        .parse(req.params);
      await assertCanViewPlacement(req, params.placementId);
      const report = await db.query.welfareReports.findFirst({
        where: and(
          eq(welfareReports.id, params.reportId),
          eq(welfareReports.placementId, params.placementId),
        ),
      });
      if (!report) {
        throw new AppError({
          code: 'WELFARE_REPORT_NOT_FOUND',
          message: 'Welfare report not found.',
          statusCode: 404,
        });
      }
      if (report.storageKey && storage.isConfigured()) {
        const url = await storage.getGetUrl(report.storageKey);
        return reply.redirect(url, 302);
      }
      if (!report.pdfBase64) {
        throw new AppError({
          code: 'WELFARE_REPORT_UNAVAILABLE',
          message: 'PDF artefact missing.',
          statusCode: 410,
        });
      }
      const pdf = Buffer.from(report.pdfBase64, 'base64');
      return reply
        .header('Content-Type', 'application/pdf')
        .header(
          'Content-Disposition',
          `attachment; filename="welfare_${params.placementId.slice(0, 8)}_${params.reportId.slice(0, 8)}.pdf"`,
        )
        .send(pdf);
    },
  );

  app.get(
    '/admin/welfare-escalations',
    { preHandler: app.requireRole('AGENT', 'ADMIN') },
    async () => {
      const rows = await listOpenEscalations();
      return { data: rows };
    },
  );

  app.get(
    '/:placementId/welfare-escalations',
    { preHandler: app.requireAuth },
    async (req) => {
      const { placementId } = placementIdParam.parse(req.params);
      await assertCanViewPlacement(req, placementId);
      const rows = await listEscalationsForPlacement(placementId);
      return { data: rows };
    },
  );

  app.post(
    '/welfare-escalations/:id/resolve',
    { preHandler: app.requireRole('AGENT', 'ADMIN') },
    async (req) => {
      const userId = requireUserId(req);
      const { id } = idParam.parse(req.params);
      const body = z.object({ notes: z.string().max(2000).optional() }).parse(req.body ?? {});
      await getEscalationOrThrow(id);
      const row = await resolveEscalation(id, userId, body.notes ?? null);
      return { data: row };
    },
  );

  app.post(
    '/admin/replacement-requests/:id/fulfil',
    { preHandler: app.requireRole('AGENT', 'ADMIN') },
    async (req) => {
      const userId = requireUserId(req);
      const { id } = idParam.parse(req.params);
      const input = fulfilReplacementSchema.parse(req.body);
      const p = await fulfilReplacement(id, input.newWorkerId, userId);
      return { data: p };
    },
  );
};
