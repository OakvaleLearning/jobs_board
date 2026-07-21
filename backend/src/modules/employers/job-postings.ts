import { and, desc, eq, ilike, or, isNull, gte, sql } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import {
  careTypes,
  employers,
  jobApplications,
  jobPostings,
  workerPersonalInfo,
  workers,
} from '@/shared/db/schema.js';
import { AppError } from '@/shared/errors/app-error.js';
import { events } from '@/shared/events/bus.js';
import type { JobApplicationStatus } from '@oakvale/shared/enums/employer.js';
import type {
  JobPostingCreateInput,
  JobPostingUpdateInput,
} from '@oakvale/shared/schema/employer.js';
import { getEmployerType } from '@/modules/admin/employer-types.service.js';
import { assertEmployerApproved } from '@/modules/employers/gates.js';
import { workerVisibilityGate } from '@/modules/compliance/visibility.js';

/**
 * Job posting is gated by the configurable employer type's `jobPostingEnabled`
 * flag (§5).
 */
async function assertJobPostingEnabled(employerId: string): Promise<void> {
  const e = await db.query.employers.findFirst({ where: eq(employers.id, employerId) });
  if (!e) {
    throw new AppError({ code: 'EMPLOYER_NOT_FOUND', message: 'Employer not found.', statusCode: 404 });
  }
  const enabled = (await getEmployerType(e.employerTypeId)).jobPostingEnabled;
  if (!enabled) {
    throw new AppError({
      code: 'WRONG_EMPLOYER_TYPE',
      message: 'Job postings are not enabled for this employer type.',
      statusCode: 403,
    });
  }
}

export async function listJobPostings(employerId: string) {
  await assertJobPostingEnabled(employerId);
  return db
    .select()
    .from(jobPostings)
    .where(eq(jobPostings.employerId, employerId))
    .orderBy(desc(jobPostings.createdAt));
}

export async function getJobPosting(employerId: string, jobId: string) {
  await assertJobPostingEnabled(employerId);
  const row = await db.query.jobPostings.findFirst({
    where: and(eq(jobPostings.id, jobId), eq(jobPostings.employerId, employerId)),
  });
  if (!row) {
    throw new AppError({ code: 'JOB_POSTING_NOT_FOUND', message: 'Job posting not found.', statusCode: 404 });
  }
  return row;
}

export async function createJobPosting(employerId: string, input: JobPostingCreateInput) {
  await assertJobPostingEnabled(employerId);
  await assertEmployerApproved(employerId);
  // PRD 6.3: every post is agent-reviewed before going live — employers cannot self-publish.
  const status = input.status === 'DRAFT' ? 'DRAFT' : 'PENDING_REVIEW';
  const [row] = await db
    .insert(jobPostings)
    .values({ ...input, status, employerId, deadline: input.deadline ?? null })
    .returning();
  return row;
}

export async function updateJobPosting(
  employerId: string,
  jobId: string,
  patch: JobPostingUpdateInput,
) {
  await assertJobPostingEnabled(employerId);
  // Publishing always routes through agent review.
  const safePatch = patch.status === 'OPEN' ? { ...patch, status: 'PENDING_REVIEW' as const } : patch;
  const [row] = await db
    .update(jobPostings)
    .set(safePatch)
    .where(and(eq(jobPostings.id, jobId), eq(jobPostings.employerId, employerId)))
    .returning();
  if (!row) {
    throw new AppError({ code: 'JOB_POSTING_NOT_FOUND', message: 'Job posting not found.', statusCode: 404 });
  }
  return row;
}

export async function adminListJobPostings(opts: { status?: string; page: number; limit: number }) {
  const conds = opts.status ? [eq(jobPostings.status, opts.status as 'PENDING_REVIEW')] : [];
  const rows = await db
    .select({ posting: jobPostings, orgName: employers.orgName })
    .from(jobPostings)
    .innerJoin(employers, eq(employers.id, jobPostings.employerId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(jobPostings.createdAt))
    .limit(opts.limit)
    .offset((opts.page - 1) * opts.limit);
  return rows.map((r) => ({ ...r.posting, orgName: r.orgName }));
}

export async function reviewJobPosting(
  jobId: string,
  input: { approved: boolean; notes?: string },
) {
  const existing = await db.query.jobPostings.findFirst({ where: eq(jobPostings.id, jobId) });
  if (!existing) {
    throw new AppError({ code: 'JOB_POSTING_NOT_FOUND', message: 'Job posting not found.', statusCode: 404 });
  }
  if (existing.status !== 'PENDING_REVIEW') {
    throw new AppError({
      code: 'JOB_POSTING_NOT_REVIEWABLE',
      message: 'Only postings pending review can be reviewed.',
      statusCode: 409,
      details: { status: existing.status },
    });
  }
  const [row] = await db
    .update(jobPostings)
    .set({ status: input.approved ? 'OPEN' : 'DRAFT' })
    .where(eq(jobPostings.id, jobId))
    .returning();
  events.emit('jobPosting.reviewed', {
    jobPostingId: jobId,
    employerId: existing.employerId,
    approved: input.approved,
    notes: input.notes,
  });
  // §6.3: when the post goes live, RESTRICTED postings notify matched workers.
  if (input.approved && row) {
    events.emit('jobPosting.published', {
      jobPostingId: jobId,
      employerId: existing.employerId,
      visibility: row.visibility,
      workforceCategoryId: row.workforceCategoryId,
    });
  }
  return row;
}

// ---- Worker-facing browse + applications ----

export async function browseOpenJobs(opts: { q?: string; page: number; limit: number }) {
  const conds = [
    eq(jobPostings.status, 'OPEN'),
    // §6.3: RESTRICTED postings never appear in public browse — matched workers
    // reach them via the worker_job_match notification's deep link.
    eq(jobPostings.visibility, 'PUBLIC'),
    or(isNull(jobPostings.deadline), gte(jobPostings.deadline, sql`CURRENT_DATE`)),
  ];
  if (opts.q) {
    conds.push(
      or(
        ilike(jobPostings.title, `%${opts.q}%`),
        ilike(jobPostings.description, `%${opts.q}%`),
        ilike(jobPostings.workLocation, `%${opts.q}%`),
      ),
    );
  }
  const rows = await db
    .select({
      posting: jobPostings,
      orgName: employers.orgName,
      careTypeName: careTypes.name,
    })
    .from(jobPostings)
    .innerJoin(employers, eq(employers.id, jobPostings.employerId))
    .leftJoin(careTypes, eq(careTypes.id, jobPostings.careTypeId))
    .where(and(...conds))
    .orderBy(desc(jobPostings.createdAt))
    .limit(opts.limit)
    .offset((opts.page - 1) * opts.limit);
  return rows.map((r) => ({ ...r.posting, orgName: r.orgName, careTypeName: r.careTypeName }));
}

/** The four boolean fragments of the worker visibility gate (brief §6.1). */
type ApplyGate = {
  identityVerified: boolean;
  oakvaleCertified: boolean;
  completionOk: boolean;
  noSafeguarding: boolean;
};

/**
 * Turn an unmet visibility gate into a single, specific, actionable reason the
 * worker can act on — checked in the order they'd resolve them. Replaces the old
 * generic "profile must be approved" message that read as "something is missing"
 * in the demo (brief §7).
 */
export function applyEligibilityMessage(gate: ApplyGate): string {
  if (!gate.identityVerified) {
    return 'Your identity verification is still pending admin approval — you can apply once it is verified.';
  }
  if (!gate.oakvaleCertified) {
    return 'Upload your Oakvale/CPD certificate and wait for admin approval before applying to roles.';
  }
  if (!gate.completionOk) {
    return 'Complete at least 70% of your profile before you can apply to roles.';
  }
  if (!gate.noSafeguarding) {
    return 'Your profile has an open safeguarding review and cannot apply to roles right now.';
  }
  return 'Your profile must be approved and live before you can apply for roles.';
}

export async function applyToJob(workerId: string, jobPostingId: string, note?: string) {
  const job = await db.query.jobPostings.findFirst({ where: eq(jobPostings.id, jobPostingId) });
  if (!job || job.status !== 'OPEN') {
    throw new AppError({ code: 'JOB_NOT_OPEN', message: 'This job is not open for applications.', statusCode: 409 });
  }
  // PRD access rule: only verified, live workers can submit applications.
  const worker = await db.query.workers.findFirst({ where: eq(workers.id, workerId) });
  if (!worker) {
    throw new AppError({ code: 'WORKER_NOT_FOUND', message: 'Worker not found.', statusCode: 404 });
  }
  if (worker.visibilityStatus !== 'APPROVED') {
    // Explain exactly which requirement is unmet instead of a single generic
    // "something is missing" message (the gate is identity + Oakvale cert +
    // ≥70% completion + no safeguarding flag — brief §3, §6.1).
    const gate = await workerVisibilityGate(workerId);
    throw new AppError({
      code: 'WORKER_NOT_ELIGIBLE',
      message: applyEligibilityMessage(gate),
      statusCode: 403,
      details: {
        identityVerified: gate.identityVerified,
        oakvaleCertified: gate.oakvaleCertified,
        completionOk: gate.completionOk,
        noSafeguarding: gate.noSafeguarding,
      },
    });
  }
  const existing = await db.query.jobApplications.findFirst({
    where: and(eq(jobApplications.jobPostingId, jobPostingId), eq(jobApplications.workerId, workerId)),
  });
  if (existing) {
    throw new AppError({ code: 'ALREADY_APPLIED', message: 'You have already applied to this job.', statusCode: 409 });
  }
  const [row] = await db
    .insert(jobApplications)
    .values({ jobPostingId, workerId, note: note ?? null })
    .returning();
  if (row) {
    events.emit('job.applicationReceived', {
      applicationId: row.id,
      jobPostingId,
      employerId: job.employerId,
      workerId,
    });
  }
  return row;
}

export async function listMyApplications(workerId: string) {
  const rows = await db
    .select({ application: jobApplications, title: jobPostings.title, orgName: employers.orgName })
    .from(jobApplications)
    .innerJoin(jobPostings, eq(jobPostings.id, jobApplications.jobPostingId))
    .innerJoin(employers, eq(employers.id, jobPostings.employerId))
    .where(eq(jobApplications.workerId, workerId))
    .orderBy(desc(jobApplications.createdAt));
  return rows.map((r) => ({ ...r.application, jobTitle: r.title, orgName: r.orgName }));
}

export async function listApplicationsForJob(employerId: string, jobId: string) {
  await getJobPosting(employerId, jobId);
  const rows = await db
    .select({ application: jobApplications, fullName: workerPersonalInfo.fullName })
    .from(jobApplications)
    .leftJoin(workerPersonalInfo, eq(workerPersonalInfo.workerId, jobApplications.workerId))
    .where(eq(jobApplications.jobPostingId, jobId))
    .orderBy(desc(jobApplications.createdAt));
  return rows.map((r) => ({ ...r.application, workerName: r.fullName }));
}

export async function setApplicationStatus(
  employerId: string,
  jobId: string,
  applicationId: string,
  status: JobApplicationStatus,
) {
  await getJobPosting(employerId, jobId);
  const [row] = await db
    .update(jobApplications)
    .set({ status })
    .where(and(eq(jobApplications.id, applicationId), eq(jobApplications.jobPostingId, jobId)))
    .returning();
  if (!row) {
    throw new AppError({ code: 'APPLICATION_NOT_FOUND', message: 'Application not found.', statusCode: 404 });
  }
  return row;
}

export async function closeJobPosting(employerId: string, jobId: string) {
  return updateJobPosting(employerId, jobId, { status: 'CLOSED' });
}
