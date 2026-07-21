import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AppError } from '@/shared/errors/app-error.js';
import {
  agentFiltersSchema,
  createAgentSchema,
  createAssignmentSchema,
  employerRosterFiltersSchema,
  updateAgentSchema,
  workerRosterFiltersSchema,
} from '@oakvale/shared/schema/admin.js';
import { PLACEMENT_STATUSES } from '@oakvale/shared/enums/placement.js';
import * as agentsService from './agents.service.js';
import * as assignmentsService from './assignments.service.js';
import * as rostersService from './rosters.service.js';
import * as kpisService from './kpis.service.js';
import * as analyticsService from './analytics.service.js';
import * as activityService from './activity.service.js';
import * as kpisTimeseriesService from './kpis-timeseries.service.js';
import * as navCountsService from './nav-counts.service.js';
import * as exportsService from './exports.service.js';
import * as auditService from './audit.service.js';
import * as complianceService from '@/modules/compliance/service.js';
import { adminListJobPostings, reviewJobPosting } from '@/modules/employers/job-postings.js';
import { setWorkerSuspended } from '@/modules/workers/service.js';
import {
  employerVerificationQueue,
  getEmployerForReview,
  reviewEmployer,
} from '@/modules/employers/verification.service.js';
import { getEmployerDocumentForStaff } from '@/modules/employers/documents.js';
import { employerVerificationReviewSchema } from '@oakvale/shared/schema/employer.js';
import { certificationReviewSchema } from '@oakvale/shared/schema/verification.js';
import * as employerTypesService from './employer-types.service.js';
import {
  employerTypeCreateSchema,
  employerTypeUpdateSchema,
} from '@oakvale/shared/schema/employer-type.js';
import { recordAudit } from '@/shared/audit/record.js';

function requireUserId(req: FastifyRequest): string {
  const sub = (req.user as { sub?: string } | undefined)?.sub;
  if (!sub) throw new AppError({ code: 'UNAUTHORIZED', message: 'Auth required.', statusCode: 401 });
  return sub;
}

const idParam = z.object({ id: z.string().uuid() });
const assignmentIdParam = z.object({ assignmentId: z.string().uuid() });

export const adminRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /* Employer types (§5 — configurable employer taxonomy) */
  app.get('/employer-types', { preHandler: app.requireRole('ADMIN', 'AGENT') }, async () => {
    const rows = await employerTypesService.listEmployerTypes();
    return { data: rows };
  });

  app.post('/employer-types', { preHandler: app.requireRole('ADMIN') }, async (req, reply) => {
    const input = employerTypeCreateSchema.parse(req.body);
    const row = await employerTypesService.createEmployerType(input, requireUserId(req));
    reply.code(201);
    return { data: row };
  });

  app.patch('/employer-types/:id', { preHandler: app.requireRole('ADMIN') }, async (req) => {
    const { id } = idParam.parse(req.params);
    const patch = employerTypeUpdateSchema.parse(req.body);
    const row = await employerTypesService.updateEmployerType(id, patch, requireUserId(req));
    return { data: row };
  });

  /* Sidebar "new since last visit" count bubbles */
  app.get('/nav-counts', { preHandler: app.requireRole('ADMIN', 'AGENT') }, async (req) => {
    const counts = await navCountsService.getNavCounts(requireUserId(req));
    return { data: counts };
  });

  app.post('/nav-counts/:key/seen', { preHandler: app.requireRole('ADMIN', 'AGENT') }, async (req) => {
    const { key } = z.object({ key: z.string() }).parse(req.params);
    await navCountsService.markNavSeen(requireUserId(req), key);
    return { data: { ok: true } };
  });

  /* Agents */
  app.get('/agents', { preHandler: app.requireRole('ADMIN') }, async (req) => {
    const filters = agentFiltersSchema.parse(req.query);
    const rows = await agentsService.listAgents(filters);
    return {
      data: rows,
      meta: { page: filters.page, limit: filters.limit, total: rows.length },
    };
  });

  app.post('/agents', { preHandler: app.requireRole('ADMIN') }, async (req) => {
    const input = createAgentSchema.parse(req.body);
    const row = await agentsService.createAgent(input, requireUserId(req));
    return { data: row };
  });

  app.get('/agents/:id', { preHandler: app.requireRole('ADMIN', 'AGENT') }, async (req) => {
    const { id } = idParam.parse(req.params);
    const detail = await agentsService.getAgentDetail(id);
    return { data: detail };
  });

  app.patch('/agents/:id', { preHandler: app.requireRole('ADMIN') }, async (req) => {
    const { id } = idParam.parse(req.params);
    const patch = updateAgentSchema.parse(req.body);
    const row = await agentsService.updateAgent(id, patch, requireUserId(req));
    return { data: row };
  });

  app.delete('/agents/:id', { preHandler: app.requireRole('ADMIN') }, async (req) => {
    const { id } = idParam.parse(req.params);
    await agentsService.deactivateAgent(id, requireUserId(req));
    return { data: { ok: true } };
  });

  /* Assignments */
  app.post(
    '/agents/:id/assignments',
    { preHandler: app.requireRole('ADMIN') },
    async (req) => {
      const { id } = idParam.parse(req.params);
      const input = createAssignmentSchema.parse(req.body);
      const row = await assignmentsService.createAssignment(id, input, requireUserId(req));
      return { data: row };
    },
  );

  app.delete(
    '/assignments/:assignmentId',
    { preHandler: app.requireRole('ADMIN') },
    async (req) => {
      const { assignmentId } = assignmentIdParam.parse(req.params);
      await assignmentsService.removeAssignment(assignmentId, requireUserId(req));
      return { data: { ok: true } };
    },
  );

  /* Rosters */
  app.get('/workers', { preHandler: app.requireRole('ADMIN', 'AGENT') }, async (req) => {
    const filters = workerRosterFiltersSchema.parse(req.query);
    const { rows, total } = await rostersService.listWorkersAdmin(filters);
    return { data: rows, meta: { page: filters.page, limit: filters.limit, total } };
  });

  app.get('/employers', { preHandler: app.requireRole('ADMIN', 'AGENT') }, async (req) => {
    const filters = employerRosterFiltersSchema.parse(req.query);
    const { rows, total } = await rostersService.listEmployersAdmin(filters);
    return { data: rows, meta: { page: filters.page, limit: filters.limit, total } };
  });

  // §6.2 — employer verification queue + review.
  app.get(
    '/employers/verification-queue',
    { preHandler: app.requireRole('ADMIN', 'AGENT') },
    async (req) => {
      const q = z
        .object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) })
        .parse(req.query);
      const { rows, total } = await employerVerificationQueue(q);
      return { data: rows, meta: { page: q.page, limit: q.limit, total } };
    },
  );

  app.get(
    '/employers/:employerId/verification',
    { preHandler: app.requireRole('ADMIN', 'AGENT') },
    async (req) => {
      const { employerId } = z.object({ employerId: z.string().uuid() }).parse(req.params);
      const result = await getEmployerForReview(employerId);
      return { data: result };
    },
  );

  app.get(
    '/employer-documents/:documentId',
    { preHandler: app.requireRole('ADMIN', 'AGENT') },
    async (req) => {
      const { documentId } = z.object({ documentId: z.string().uuid() }).parse(req.params);
      const result = await getEmployerDocumentForStaff(documentId);
      return { data: result };
    },
  );

  app.post(
    '/employers/:employerId/verification/review',
    // Approve/reject is an ADMIN decision; AGENTs retain read-only queue/detail access for triage.
    { preHandler: app.requireRole('ADMIN') },
    async (req) => {
      const { employerId } = z.object({ employerId: z.string().uuid() }).parse(req.params);
      const input = employerVerificationReviewSchema.parse(req.body);
      const reviewerId = (req.user as { sub?: string } | undefined)?.sub;
      await reviewEmployer(employerId, reviewerId as string, input);
      return { data: { reviewed: true } };
    },
  );

  // TC-AUTH-007 — suspend/reactivate a worker account (revokes portal access + hides from search).
  app.post(
    '/workers/:workerId/suspension',
    { preHandler: app.requireRole('ADMIN', 'AGENT') },
    async (req) => {
      const { workerId } = z.object({ workerId: z.string().uuid() }).parse(req.params);
      const { suspended } = z.object({ suspended: z.boolean() }).parse(req.body);
      const actorId = (req.user as { sub?: string } | undefined)?.sub;
      const result = await setWorkerSuspended(workerId, suspended, actorId);
      return { data: result };
    },
  );

  /* KPIs */
  app.get('/kpis', { preHandler: app.requireRole('ADMIN', 'AGENT') }, async () => {
    const snapshot = await kpisService.getKpis();
    return { data: snapshot };
  });

  /* KPI timeseries */
  app.get('/kpis/timeseries', { preHandler: app.requireRole('ADMIN', 'AGENT') }, async (req) => {
    const q = z.object({ window: z.enum(['30d', '90d']).default('30d') }).parse(req.query);
    const series = await kpisTimeseriesService.getTimeseries(q.window);
    return { data: series };
  });

  /* Advanced analytics (§14.2) — funnel, time-to-placement, success rates */
  app.get('/analytics', { preHandler: app.requireRole('ADMIN', 'AGENT') }, async () => {
    const snapshot = await analyticsService.getAnalytics();
    return { data: snapshot };
  });

  /* Agent activity feed */
  app.get(
    '/agents/:id/activity',
    { preHandler: app.requireRole('ADMIN', 'AGENT') },
    async (req) => {
      const { id } = idParam.parse(req.params);
      const q = z
        .object({
          from: z.string().datetime().optional(),
          to: z.string().datetime().optional(),
          page: z.coerce.number().int().min(1).default(1),
          limit: z.coerce.number().int().min(1).max(200).default(50),
        })
        .parse(req.query);
      const { rows, total } = await activityService.listForAgent(id, {
        from: q.from ? new Date(q.from) : undefined,
        to: q.to ? new Date(q.to) : undefined,
        page: q.page,
        limit: q.limit,
      });
      return { data: rows, meta: { page: q.page, limit: q.limit, total } };
    },
  );

  /* Audit log */
  app.get('/audit-log', { preHandler: app.requireRole('ADMIN', 'AGENT') }, async (req) => {
    const q = z
      .object({
        action: z.string().optional(),
        actorId: z.string().uuid().optional(),
        targetType: z.string().optional(),
        targetId: z.string().optional(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(200).default(50),
      })
      .parse(req.query);
    const { rows, total } = await auditService.listAudit({
      ...q,
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
    });
    return { data: rows, meta: { page: q.page, limit: q.limit, total } };
  });

  /* Job-post review (PRD 6.3) */
  app.get('/job-postings', { preHandler: app.requireRole('ADMIN', 'AGENT') }, async (req) => {
    const q = z
      .object({
        status: z.enum(['DRAFT', 'PENDING_REVIEW', 'OPEN', 'FILLED', 'CLOSED']).optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(50),
      })
      .parse(req.query);
    const rows = await adminListJobPostings(q);
    return { data: rows, meta: { page: q.page, limit: q.limit } };
  });

  app.post(
    '/job-postings/:id/review',
    { preHandler: app.requireRole('ADMIN', 'AGENT') },
    async (req) => {
      const { id } = idParam.parse(req.params);
      const input = z
        .object({ approved: z.boolean(), notes: z.string().max(2000).optional() })
        .parse(req.body);
      const row = await reviewJobPosting(id, input);
      void recordAudit({
        actorId: requireUserId(req),
        action: input.approved ? 'jobPosting.approve' : 'jobPosting.requestRevision',
        targetType: 'job_posting',
        targetId: id,
        metadata: { notes: input.notes ?? null },
      });
      return { data: row };
    },
  );

  /* CSV exports */
  app.get('/exports/invoices.csv', { preHandler: app.requireRole('ADMIN') }, async (req, reply) => {
    const q = z
      .object({
        status: z.enum(['OPEN', 'PAID', 'VOID', 'REFUNDED', 'FAILED']).optional(),
        pipeline: z.enum(['INDIVIDUAL_EMPLOYER', 'CORPORATE']).optional(),
        provider: z.enum(['STRIPE', 'PAYSTACK']).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(req.query);
    const csv = await exportsService.exportInvoicesCsv(q);
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="invoices_${Date.now()}.csv"`)
      .send(csv);
  });

  app.get(
    '/exports/placements.csv',
    { preHandler: app.requireRole('ADMIN') },
    async (req, reply) => {
      const q = z
        .object({
          status: z.enum(PLACEMENT_STATUSES).optional(),
          pipeline: z.enum(['INDIVIDUAL_EMPLOYER', 'CORPORATE']).optional(),
        })
        .parse(req.query);
      const csv = await exportsService.exportPlacementsCsv(q);
      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="placements_${Date.now()}.csv"`)
        .send(csv);
    },
  );

  /* Certificate cross-check (brief §3) — queryable submissions list + bulk CSV. */
  app.get('/certifications', { preHandler: app.requireRole('ADMIN') }, async (req) => {
    const q = z
      .object({
        q: z.string().optional(),
        oakvaleOnly: z.coerce.boolean().optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(200).default(50),
      })
      .parse(req.query);
    const rows = await complianceService.adminListCertSubmissions(q);
    return { data: rows, meta: { page: q.page, limit: q.limit } };
  });

  app.post(
    '/certifications/:certificationId/review',
    { preHandler: app.requireRole('ADMIN') },
    async (req) => {
      const { certificationId } = z
        .object({ certificationId: z.string().uuid() })
        .parse(req.params);
      const body = certificationReviewSchema.parse(req.body);
      await complianceService.reviewCertification(certificationId, {
        ...body,
        reviewerUserId: requireUserId(req),
      });
      return { data: { ok: true } };
    },
  );

  app.get('/certifications.csv', { preHandler: app.requireRole('ADMIN') }, async (req, reply) => {
    const q = z
      .object({ q: z.string().optional(), oakvaleOnly: z.coerce.boolean().optional() })
      .parse(req.query);
    const csv = await exportsService.exportCertificationsCsv(q);
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="certifications_${Date.now()}.csv"`)
      .send(csv);
  });

  app.get('/exports/workers.csv', { preHandler: app.requireRole('ADMIN') }, async (req, reply) => {
    const q = z
      .object({
        visibility: z
          .enum(['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'])
          .optional(),
        q: z.string().optional(),
      })
      .parse(req.query);
    const csv = await exportsService.exportWorkersCsv(q);
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="workers_${Date.now()}.csv"`)
      .send(csv);
  });
};
