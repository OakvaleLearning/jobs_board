import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import { EMPLOYER_ROLES } from '@oakvale/shared/roles.js';
import { z } from 'zod';
import {
  confirmUploadRequestSchema,
  searchWorkersQuerySchema,
  uploadUrlRequestSchema,
} from '@oakvale/shared/schema/worker.js';
import { WORKER_SECTIONS, type WorkerSection } from '@oakvale/shared/enums/worker.js';
import { db } from '@/shared/db/client.js';
import { workers } from '@/shared/db/schema.js';
import { eq } from 'drizzle-orm';
import { AppError } from '@/shared/errors/app-error.js';
import {
  cancelSubmission,
  getCompletion,
  getProfile,
  getProfileByUserId,
  requestEdit,
  search,
  submitForReview,
  updateSection,
} from './service.js';
import { diffProfileSections } from './profile-diff.js';
import { getEmployerType } from '@/modules/admin/employer-types.service.js';
import {
  confirmUpload,
  deleteDocument,
  getDocumentForOwnerOrStaff,
  issueUploadUrl,
  listDocuments,
} from './documents.js';
import { buildPublicProfile } from './public.js';
import { getUnlockedWorkerIds } from './service.js';
import { blurredKeyFor } from './selfie.js';
import { storage } from '@/shared/storage/r2.js';
import { workerBrowseQuerySchema } from '@oakvale/shared/schema/employer.js';
import { workerSearchFiltersSchema } from '@oakvale/shared/schema/messaging.js';
import { getByUserId } from '@/modules/employers/service.js';
import { assertEmployerApproved, assertNdpaConsentForCorporate } from '@/modules/employers/gates.js';
import { employerHasUnlockedContact } from './service.js';
import {
  applyToJob,
  browseOpenJobs,
  listMyApplications,
} from '@/modules/employers/job-postings.js';
import {
  workforceCategoryCreateSchema,
  workforceCategoryUpdateSchema,
} from '@oakvale/shared/schema/workforce-category.js';
import {
  createCategory,
  listCategories,
  updateCategory,
} from './categories.service.js';

const sectionParamsSchema = z.object({
  section: z.enum(WORKER_SECTIONS),
});

async function workerIdForUser(userId: string): Promise<string | null> {
  const row = await db.query.workers.findFirst({ where: eq(workers.userId, userId) });
  return row?.id ?? null;
}

function requireUserId(req: FastifyRequest): string {
  const sub = (req.user as { sub?: string } | undefined)?.sub;
  if (!sub) throw new AppError({ code: 'UNAUTHORIZED', message: 'Auth required.', statusCode: 401 });
  return sub;
}

function isStaff(req: FastifyRequest): boolean {
  const role = (req.user as { role?: string } | undefined)?.role;
  return role === 'AGENT' || role === 'ADMIN';
}

export const workerRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Worker-self routes
  app.get('/me', { preHandler: app.requireRole('WORKER', 'AGENT', 'ADMIN') }, async (req) => {
    const userId = requireUserId(req);
    const profile = await getProfileByUserId(userId);
    return { data: profile };
  });

  app.get('/me/completion', { preHandler: app.requireRole('WORKER') }, async (req) => {
    const userId = requireUserId(req);
    const wid = await workerIdForUser(userId);
    if (!wid) {
      throw new AppError({ code: 'WORKER_NOT_FOUND', message: 'Worker not found.', statusCode: 404 });
    }
    const pct = await getCompletion(wid);
    return { data: { profileCompletionPct: pct } };
  });

  app.patch(
    '/me/sections/:section',
    { preHandler: app.requireRole('WORKER') },
    async (req) => {
      const userId = requireUserId(req);
      const { section } = sectionParamsSchema.parse(req.params);
      const wid = await workerIdForUser(userId);
      if (!wid) {
        throw new AppError({ code: 'WORKER_NOT_FOUND', message: 'Worker not found.', statusCode: 404 });
      }
      await updateSection(wid, section satisfies WorkerSection, req.body);
      const pct = await getCompletion(wid);
      return { data: { profileCompletionPct: pct } };
    },
  );

  app.post('/me/submit', { preHandler: app.requireRole('WORKER') }, async (req) => {
    const userId = requireUserId(req);
    const wid = await workerIdForUser(userId);
    if (!wid) {
      throw new AppError({ code: 'WORKER_NOT_FOUND', message: 'Worker not found.', statusCode: 404 });
    }
    await submitForReview(wid);
    return { data: { submitted: true } };
  });

  app.post('/me/request-edit', { preHandler: app.requireRole('WORKER') }, async (req) => {
    const userId = requireUserId(req);
    const wid = await workerIdForUser(userId);
    if (!wid) {
      throw new AppError({ code: 'WORKER_NOT_FOUND', message: 'Worker not found.', statusCode: 404 });
    }
    await requestEdit(wid);
    return { data: { editUnlocked: true } };
  });

  app.post('/me/cancel-submission', { preHandler: app.requireRole('WORKER') }, async (req) => {
    const userId = requireUserId(req);
    const wid = await workerIdForUser(userId);
    if (!wid) {
      throw new AppError({ code: 'WORKER_NOT_FOUND', message: 'Worker not found.', statusCode: 404 });
    }
    await cancelSubmission(wid);
    return { data: { cancelled: true } };
  });

  // Worker-facing job board (PRD 6.4 / 14.1) — browse OPEN postings + apply
  app.get('/jobs', { preHandler: app.requireRole('WORKER') }, async (req) => {
    const { q, page, limit } = z
      .object({
        q: z.string().optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(20),
      })
      .parse(req.query);
    const rows = await browseOpenJobs({ q, page, limit });
    return { data: rows, meta: { page, limit } };
  });

  app.get('/jobs/applications/me', { preHandler: app.requireRole('WORKER') }, async (req) => {
    const userId = requireUserId(req);
    const wid = await workerIdForUser(userId);
    if (!wid) return { data: [] };
    const rows = await listMyApplications(wid);
    return { data: rows };
  });

  app.post('/jobs/:id/apply', { preHandler: app.requireRole('WORKER') }, async (req) => {
    const userId = requireUserId(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { note } = z.object({ note: z.string().max(2000).optional() }).parse(req.body ?? {});
    const wid = await workerIdForUser(userId);
    if (!wid) {
      throw new AppError({ code: 'WORKER_NOT_FOUND', message: 'Worker not found.', statusCode: 404 });
    }
    const row = await applyToJob(wid, id, note);
    return { data: row };
  });

  // Documents
  app.post(
    '/me/documents/upload-url',
    { preHandler: app.requireRole('WORKER') },
    async (req) => {
      const userId = requireUserId(req);
      const wid = await workerIdForUser(userId);
      if (!wid) {
        throw new AppError({ code: 'WORKER_NOT_FOUND', message: 'Worker not found.', statusCode: 404 });
      }
      const input = uploadUrlRequestSchema.parse(req.body);
      const result = await issueUploadUrl({ ...input, workerId: wid });
      return { data: result };
    },
  );

  app.post(
    '/me/documents/confirm',
    { preHandler: app.requireRole('WORKER') },
    async (req) => {
      const userId = requireUserId(req);
      const wid = await workerIdForUser(userId);
      if (!wid) {
        throw new AppError({ code: 'WORKER_NOT_FOUND', message: 'Worker not found.', statusCode: 404 });
      }
      const { documentId } = confirmUploadRequestSchema.parse(req.body);
      const result = await confirmUpload(wid, documentId);
      return { data: result };
    },
  );

  app.get('/me/documents', { preHandler: app.requireRole('WORKER') }, async (req) => {
    const userId = requireUserId(req);
    const wid = await workerIdForUser(userId);
    if (!wid) return { data: [] };
    const items = await listDocuments(wid);
    return { data: items };
  });

  app.delete(
    '/me/documents/:id',
    { preHandler: app.requireRole('WORKER') },
    async (req) => {
      const userId = requireUserId(req);
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
      const wid = await workerIdForUser(userId);
      if (!wid) {
        throw new AppError({ code: 'WORKER_NOT_FOUND', message: 'Worker not found.', statusCode: 404 });
      }
      const result = await deleteDocument(wid, id);
      return { data: result };
    },
  );

  app.get(
    '/documents/:id/download-url',
    { preHandler: app.requireRole('WORKER', 'AGENT', 'ADMIN') },
    async (req) => {
      const userId = requireUserId(req);
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
      const wid = await workerIdForUser(userId);
      const result = await getDocumentForOwnerOrStaff(id, {
        workerId: wid ?? undefined,
        staff: isStaff(req),
      });
      return { data: { downloadUrl: result.downloadUrl, document: result.document } };
    },
  );

  // Admin/Agent — search + per-worker fetch
  app.get('/', { preHandler: app.requireRole('AGENT', 'ADMIN') }, async (req) => {
    const filters = searchWorkersQuerySchema.parse(req.query);
    const { rows, total } = await search(filters);
    return {
      data: rows,
      meta: { total, page: filters.page, limit: filters.limit },
    };
  });

  app.get('/:id', { preHandler: app.requireRole('AGENT', 'ADMIN') }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const profile = await getProfile(id);
    return { data: profile };
  });

  app.get(
    '/:id/pending-changes',
    { preHandler: app.requireRole('AGENT', 'ADMIN') },
    async (req) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
      const worker = await db.query.workers.findFirst({ where: eq(workers.id, id) });
      if (!worker) {
        throw new AppError({ code: 'WORKER_NOT_FOUND', message: 'Worker not found.', statusCode: 404 });
      }
      if (!worker.preEditSnapshot) {
        return { data: { changes: [], editRequestedAt: null } };
      }
      const profile = await getProfile(id);
      const changes = diffProfileSections(
        worker.preEditSnapshot as Record<string, unknown>,
        profile.sections as unknown as Record<string, unknown>,
      );
      return { data: { changes, editRequestedAt: worker.editRequestedAt } };
    },
  );

  // Employer-facing browse — applies the Phase 2 visibility gate + NDPA check
  app.get(
    '/browse',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const userId = requireUserId(req);
      const employer = await getByUserId(userId);
      await assertEmployerApproved(employer.id);
      await assertNdpaConsentForCorporate(employer.id);

      // §5: an employer type may restrict which worker categories it can browse.
      const employerType = employer.employerTypeId
        ? await getEmployerType(employer.employerTypeId)
        : null;
      const allowedWorkerCategoryIds = employerType?.allowedWorkerCategoryIds ?? undefined;

      // Phase 12: accept faceted filters but stay backward-compatible
      const legacy = workerBrowseQuerySchema.safeParse(req.query);
      const v12 = workerSearchFiltersSchema.safeParse(req.query);
      const filters = v12.success ? v12.data : null;
      const fallback = legacy.success ? legacy.data : { page: 1, limit: 20, q: undefined };
      const page = filters?.page ?? fallback.page;
      const limit = filters?.limit ?? fallback.limit;
      const { rows, total } = await search({
        q: filters?.q ?? fallback.q,
        page,
        limit,
        applyVisibilityGate: true,
        certStatus: filters?.certStatus,
        bgCheckStatus: filters?.bgCheckStatus,
        state: filters?.state,
        workforceCategoryId: filters?.workforceCategoryId,
        allowedWorkerCategoryIds: allowedWorkerCategoryIds ?? undefined,
        employmentType: filters?.employmentType,
        skills: filters?.skills,
        languages: filters?.languages,
        availableFrom: filters?.availableFrom,
        minExperienceYears: filters?.minExperienceYears,
        cpdHoursMin: filters?.cpdHoursMin,
      });

      // Presign selfie photos per-request (never cached): blurred variant by
      // default, clear only for workers this employer has contract-unlocked.
      const unlocked = await getUnlockedWorkerIds(employer.id);
      const data = await Promise.all(
        rows.map(async ({ selfieStorageKey, ...row }) => {
          const photoUnlocked = unlocked.has(row.id);
          let photoUrl: string | null = null;
          if (selfieStorageKey && storage.isConfigured()) {
            const key = photoUnlocked ? selfieStorageKey : blurredKeyFor(selfieStorageKey);
            photoUrl = await storage.getGetUrl(key).catch(() => null);
          }
          return { ...row, photoUrl, photoUnlocked };
        }),
      );
      return { data, meta: { total, page, limit } };
    },
  );

  app.get(
    '/browse/:id',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const userId = requireUserId(req);
      const employer = await getByUserId(userId);
      await assertEmployerApproved(employer.id);
      await assertNdpaConsentForCorporate(employer.id);

      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
      // Phase 12 — only reveal contact fields once a placement contract is FULLY_EXECUTED
      const unlocked = await employerHasUnlockedContact(employer.id, id);
      const profile = await buildPublicProfile(id, { includeContact: unlocked });
      return { data: { ...profile, contactUnlocked: unlocked } };
    },
  );

  /* ---------------------- workforce categories (taxonomy) --------------------- */

  // Active categories — for worker profile & employer needs selects.
  app.get(
    '/categories',
    { preHandler: app.requireRole('WORKER', ...EMPLOYER_ROLES, 'AGENT', 'ADMIN') },
    async () => {
      const rows = await listCategories({ activeOnly: true });
      return { data: rows };
    },
  );

  // Admin: full list including inactive.
  app.get('/admin/categories', { preHandler: app.requireRole('ADMIN', 'AGENT') }, async () => {
    const rows = await listCategories();
    return { data: rows };
  });

  app.post('/admin/categories', { preHandler: app.requireRole('ADMIN') }, async (req, reply) => {
    const input = workforceCategoryCreateSchema.parse(req.body);
    const row = await createCategory(input, requireUserId(req));
    reply.code(201);
    return { data: row };
  });

  app.patch('/admin/categories/:id', { preHandler: app.requireRole('ADMIN') }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const patch = workforceCategoryUpdateSchema.parse(req.body);
    const row = await updateCategory(id, patch, requireUserId(req));
    return { data: row };
  });
};
