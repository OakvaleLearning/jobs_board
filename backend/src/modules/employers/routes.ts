import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import { EMPLOYER_ROLES } from '@oakvale/shared/roles.js';
import { z } from 'zod';
import {
  contactCreateSchema,
  contactUpdateSchema,
  corporateNeedsAssessmentSchema,
  individualEmployerNeedsAssessmentSchema,
  employerDocumentUploadSchema,
  employerProfileUpdateSchema,
  jobPostingCreateSchema,
  jobPostingUpdateSchema,
} from '@oakvale/shared/schema/employer.js';
import {
  confirmEmployerUpload,
  issueEmployerUploadUrl,
  listEmployerDocuments,
} from './documents.js';
import { AppError } from '@/shared/errors/app-error.js';
import {
  addContact,
  getByUserId,
  getOrCreateForUser,
  getProfile,
  markOnboardingComplete,
  recordNdpaConsent,
  removeContact,
  updateContact,
  updateProfile,
  upsertCorporateNeedsAssessment,
  upsertIndividualEmployerNeedsAssessment,
} from './service.js';
import {
  closeJobPosting,
  createJobPosting,
  getJobPosting,
  listApplicationsForJob,
  listJobPostings,
  setApplicationStatus,
  updateJobPosting,
} from './job-postings.js';
import { JOB_APPLICATION_STATUSES } from '@oakvale/shared/enums/employer.js';
import * as savedSearches from './saved-searches.js';
import { savedSearchCreateSchema } from '@oakvale/shared/schema/messaging.js';
import { deriveTypeFlags, getEmployerType, listEmployerTypes } from '@/modules/admin/employer-types.service.js';
import { listActiveCareTypes } from '@/modules/employers/care-types.service.js';

function requireUserId(req: FastifyRequest): string {
  const sub = (req.user as { sub?: string } | undefined)?.sub;
  if (!sub) throw new AppError({ code: 'UNAUTHORIZED', message: 'Auth required.', statusCode: 401 });
  return sub;
}

const idParam = z.object({ id: z.string().uuid() });

export const employerRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Public: active employer types for the signup picker (§5). No auth required.
  app.get('/types', async () => {
    const rows = await listEmployerTypes({ activeOnly: true });
    return {
      data: rows.map((t) => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        description: t.description,
        roleKey: t.roleKey,
      })),
    };
  });

  // Active care types for the job-posting picker (§5). Available to signed-in employers.
  app.get('/care-types', { preHandler: app.requireRole(...EMPLOYER_ROLES) }, async () => {
    return { data: await listActiveCareTypes() };
  });

  // GET /me — bootstraps the employer row if missing
  app.get(
    '/me',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const userId = requireUserId(req);
      const e = await getOrCreateForUser(userId);
      const profile = await getProfile(e.id);
      return { data: profile };
    },
  );

  app.patch(
    '/me',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const userId = requireUserId(req);
      const e = await getByUserId(userId);
      const input = employerProfileUpdateSchema.parse(req.body);
      const row = await updateProfile(e.id, input);
      return { data: row };
    },
  );

  app.post(
    '/me/contacts',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const userId = requireUserId(req);
      const e = await getByUserId(userId);
      const input = contactCreateSchema.parse(req.body);
      const row = await addContact(e.id, input);
      return { data: row };
    },
  );

  app.patch(
    '/me/contacts/:id',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const userId = requireUserId(req);
      const e = await getByUserId(userId);
      const { id } = idParam.parse(req.params);
      const input = contactUpdateSchema.parse(req.body);
      const row = await updateContact(e.id, id, input);
      return { data: row };
    },
  );

  app.delete(
    '/me/contacts/:id',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const userId = requireUserId(req);
      const e = await getByUserId(userId);
      const { id } = idParam.parse(req.params);
      await removeContact(e.id, id);
      return { data: { removed: true } };
    },
  );

  app.put(
    '/me/needs-assessment',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const userId = requireUserId(req);
      const e = await getByUserId(userId);
      const flags = deriveTypeFlags(await getEmployerType(e.employerTypeId));
      if (flags.usesIndividualEmployerNeeds) {
        const input = individualEmployerNeedsAssessmentSchema.parse(req.body);
        await upsertIndividualEmployerNeedsAssessment(e.id, input);
      } else {
        const input = corporateNeedsAssessmentSchema.parse(req.body);
        await upsertCorporateNeedsAssessment(e.id, input);
      }
      return { data: { saved: true } };
    },
  );

  app.post(
    '/me/ndpa-consent',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const userId = requireUserId(req);
      const e = await getByUserId(userId);
      await recordNdpaConsent(e.id, userId);
      return { data: { recorded: true } };
    },
  );

  app.post(
    '/me/onboarding/complete',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const userId = requireUserId(req);
      const e = await getByUserId(userId);
      await markOnboardingComplete(e.id);
      return { data: { completed: true } };
    },
  );

  // §6.2 — employer verification documents (proof-of-residence, ID, CAC).
  app.post(
    '/me/documents/upload-url',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const e = await getByUserId(requireUserId(req));
      const input = employerDocumentUploadSchema.parse(req.body);
      const result = await issueEmployerUploadUrl({ employerId: e.id, ...input });
      return { data: result };
    },
  );

  app.post(
    '/me/documents/confirm',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const e = await getByUserId(requireUserId(req));
      const { documentId } = z.object({ documentId: z.string().uuid() }).parse(req.body);
      const result = await confirmEmployerUpload(e.id, documentId);
      return { data: result };
    },
  );

  app.get(
    '/me/documents',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const e = await getByUserId(requireUserId(req));
      const rows = await listEmployerDocuments(e.id);
      return { data: rows };
    },
  );

  // Job postings (corporate-only — service enforces)
  app.get(
    '/me/job-postings',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const userId = requireUserId(req);
      const e = await getByUserId(userId);
      const rows = await listJobPostings(e.id);
      return { data: rows };
    },
  );

  app.post(
    '/me/job-postings',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const userId = requireUserId(req);
      const e = await getByUserId(userId);
      const input = jobPostingCreateSchema.parse(req.body);
      const row = await createJobPosting(e.id, input);
      return { data: row };
    },
  );

  app.get(
    '/me/job-postings/:id',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const userId = requireUserId(req);
      const e = await getByUserId(userId);
      const { id } = idParam.parse(req.params);
      const row = await getJobPosting(e.id, id);
      return { data: row };
    },
  );

  app.patch(
    '/me/job-postings/:id',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const userId = requireUserId(req);
      const e = await getByUserId(userId);
      const { id } = idParam.parse(req.params);
      const input = jobPostingUpdateSchema.parse(req.body);
      const row = await updateJobPosting(e.id, id, input);
      return { data: row };
    },
  );

  app.post(
    '/me/job-postings/:id/close',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const userId = requireUserId(req);
      const e = await getByUserId(userId);
      const { id } = idParam.parse(req.params);
      const row = await closeJobPosting(e.id, id);
      return { data: row };
    },
  );

  // Applicants for a corporate job posting (PRD 6.3 applicant list)
  app.get(
    '/me/job-postings/:id/applications',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const userId = requireUserId(req);
      const e = await getByUserId(userId);
      const { id } = idParam.parse(req.params);
      const rows = await listApplicationsForJob(e.id, id);
      return { data: rows };
    },
  );

  app.patch(
    '/me/job-postings/:id/applications/:appId',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const userId = requireUserId(req);
      const e = await getByUserId(userId);
      const { id, appId } = z
        .object({ id: z.string().uuid(), appId: z.string().uuid() })
        .parse(req.params);
      const { status } = z.object({ status: z.enum(JOB_APPLICATION_STATUSES) }).parse(req.body);
      const row = await setApplicationStatus(e.id, id, appId, status);
      return { data: row };
    },
  );

  // Phase 12 — saved searches (corporate + individual employer)
  app.get(
    '/me/saved-searches',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const e = await getByUserId(requireUserId(req));
      const rows = await savedSearches.listForEmployer(e.id);
      return { data: rows };
    },
  );

  app.post(
    '/me/saved-searches',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const e = await getByUserId(requireUserId(req));
      const input = savedSearchCreateSchema.parse(req.body);
      const row = await savedSearches.create(e.id, input);
      return { data: row };
    },
  );

  app.patch(
    '/me/saved-searches/:id',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const e = await getByUserId(requireUserId(req));
      const { id } = idParam.parse(req.params);
      const input = savedSearchCreateSchema.partial().parse(req.body);
      const row = await savedSearches.update(e.id, id, input);
      return { data: row };
    },
  );

  app.delete(
    '/me/saved-searches/:id',
    { preHandler: app.requireRole(...EMPLOYER_ROLES) },
    async (req) => {
      const e = await getByUserId(requireUserId(req));
      const { id } = idParam.parse(req.params);
      await savedSearches.remove(e.id, id);
      return { data: { ok: true } };
    },
  );
};
