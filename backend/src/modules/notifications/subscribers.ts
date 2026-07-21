import { and, eq } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import {
  employers,
  jobPostings,
  placements,
  shortlists,
  users,
  workerPersonalInfo,
  workers,
} from '@/shared/db/schema.js';
import { events } from '@/shared/events/bus.js';
import { logger } from '@/shared/logger/logger.js';
import * as notifications from './service.js';

async function workerUserId(workerId: string): Promise<string | null> {
  const row = await db.query.workers.findFirst({ where: eq(workers.id, workerId) });
  return row?.userId ?? null;
}

async function employerUserId(employerId: string): Promise<string | null> {
  const row = await db.query.employers.findFirst({ where: eq(employers.id, employerId) });
  return row?.userId ?? null;
}

async function placementContext(placementId: string) {
  const p = await db.query.placements.findFirst({ where: eq(placements.id, placementId) });
  if (!p) return null;
  return p;
}

export function registerNotificationSubscribers() {
  events.on('worker.identityApproved', async ({ workerId }) => {
    const userId = await workerUserId(workerId);
    if (!userId) return;
    await notifications.enqueue({
      userId,
      kind: 'identity_verified',
      channel: 'EMAIL',
      payload: {},
      idempotencyKey: `identity_verified:${workerId}`,
    });
    await notifications.enqueue({
      userId,
      kind: 'identity_verified',
      channel: 'IN_APP',
      payload: {},
      idempotencyKey: `identity_verified:in-app:${workerId}`,
    });
  });

  events.on('placement.activated', async ({ placementId, employerId, workerId }) => {
    const empUid = await employerUserId(employerId);
    const wrkUid = await workerUserId(workerId);
    if (empUid) {
      await notifications.enqueue({
        userId: empUid,
        kind: 'placement_activated',
        channel: 'EMAIL',
        payload: { placementId },
        idempotencyKey: `placement_activated:emp:${placementId}`,
      });
      await notifications.enqueue({
        userId: empUid,
        kind: 'placement_activated',
        channel: 'IN_APP',
        payload: { placementId },
        idempotencyKey: `placement_activated:emp:in-app:${placementId}`,
      });
    }
    if (wrkUid) {
      await notifications.enqueue({
        userId: wrkUid,
        kind: 'placement_activated',
        channel: 'IN_APP',
        payload: { placementId },
        idempotencyKey: `placement_activated:wrk:in-app:${placementId}`,
      });
    }
  });

  // §14.2 — when a placement completes, invite the employer to rate the worker.
  events.on('placement.completed', async ({ placementId, employerId, workerId }) => {
    const empUid = await employerUserId(employerId);
    if (!empUid) return;
    const personal = await db.query.workerPersonalInfo.findFirst({
      where: eq(workerPersonalInfo.workerId, workerId),
    });
    const payload = { placementId, workerName: personal?.fullName ?? 'your worker' };
    await notifications.enqueue({
      userId: empUid,
      kind: 'rate_worker',
      channel: 'EMAIL',
      payload,
      idempotencyKey: `rate_worker:${placementId}`,
    });
    await notifications.enqueue({
      userId: empUid,
      kind: 'rate_worker',
      channel: 'IN_APP',
      payload,
      idempotencyKey: `rate_worker:in-app:${placementId}`,
    });
  });

  events.on('placement.suspended', async ({ placementId, workerId, reason }) => {
    const ctx = await placementContext(placementId);
    if (!ctx) return;
    const wrkUid = await workerUserId(workerId);
    const empUid = await employerUserId(ctx.employerId);
    for (const [uid, scope] of [
      [wrkUid, 'wrk'],
      [empUid, 'emp'],
    ] as const) {
      if (!uid) continue;
      await notifications.enqueue({
        userId: uid,
        kind: 'placement_suspended',
        channel: 'IN_APP',
        payload: { placementId, reason },
        idempotencyKey: `placement_suspended:${scope}:in-app:${placementId}`,
      });
    }
  });

  events.on('replacement.slaWarning', async ({ requestId, slaDeadline }) => {
    const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, 'ADMIN'));
    const hoursLeft = Math.max(
      0,
      Math.floor((new Date(slaDeadline).getTime() - Date.now()) / (1000 * 60 * 60)),
    );
    for (const a of admins) {
      await notifications.enqueue({
        userId: a.id,
        kind: 'replacement_sla_warning',
        channel: 'IN_APP',
        payload: { hoursLeft },
        idempotencyKey: `sla_warning:${requestId}:${hoursLeft}`,
      });
    }
  });

  events.on('invoice.paid', async ({ employerId, invoiceId }) => {
    const empUid = await employerUserId(employerId);
    if (!empUid) return;
    await notifications.enqueue({
      userId: empUid,
      kind: 'placement_activated',
      channel: 'IN_APP',
      payload: { invoiceId },
      idempotencyKey: `invoice_paid:${invoiceId}`,
    });
  });

  events.on('shortlist.generated', async ({ shortlistId }) => {
    const row = await db.query.shortlists.findFirst({ where: eq(shortlists.id, shortlistId) });
    if (!row) return;
    const workerIds = (row.workerIds as string[] | null) ?? [];
    for (const workerId of workerIds) {
      const uid = await workerUserId(workerId);
      if (!uid) continue;
      for (const channel of ['IN_APP', 'EMAIL'] as const) {
        await notifications.enqueue({
          userId: uid,
          kind: 'worker_shortlisted',
          channel,
          payload: { shortlistId },
          idempotencyKey: `worker_shortlisted:${channel}:${shortlistId}:${workerId}`,
        });
      }
    }
  });

  events.on('worker.profileResubmitted', async ({ workerId }) => {
    const worker = await db.query.workers.findFirst({ where: eq(workers.id, workerId) });
    if (!worker) return;
    await notifications.enqueueForRole('ADMIN', {
      kind: 'profile_resubmitted',
      channel: 'IN_APP',
      payload: { workerId },
      idempotencyKey: `profile_resubmitted:${workerId}:${worker.submittedAt?.getTime() ?? Date.now()}`,
    });
  });

  // §6.1 — an admin reviewed the worker's uploaded background documents. A FLAGGED
  // outcome notifies the worker (advisory — it no longer changes their visibility).
  events.on('worker.backgroundReviewed', async ({ workerId, status }) => {
    if (status !== 'FLAGGED') return;
    const uid = await workerUserId(workerId);
    if (!uid) return;
    for (const channel of ['IN_APP', 'EMAIL'] as const) {
      await notifications.enqueue({
        userId: uid,
        kind: 'background_check_attention',
        channel,
        payload: { status },
        idempotencyKey: `background_check_attention:${channel}:${workerId}:${status}`,
      });
    }
  });

  events.on('subscription.cancelled', async ({ employerId, subscriptionId }) => {
    const empUid = await employerUserId(employerId);
    if (!empUid) return;
    await notifications.enqueue({
      userId: empUid,
      kind: 'subscription_cancelled',
      channel: 'EMAIL',
      payload: {},
      idempotencyKey: `subscription_cancelled:${subscriptionId}`,
    });
  });

  // PRD 6.3 — employer notified when a job post is approved or sent back for revision.
  events.on('jobPosting.reviewed', async ({ jobPostingId, employerId, approved, notes }) => {
    const empUid = await employerUserId(employerId);
    if (!empUid) return;
    const job = await db.query.jobPostings.findFirst({ where: eq(jobPostings.id, jobPostingId) });
    const jobTitle = job?.title ?? 'Your job posting';
    const kind = approved ? 'job_post_approved' : 'job_post_revision_requested';
    for (const channel of ['IN_APP', 'EMAIL'] as const) {
      await notifications.enqueue({
        userId: empUid,
        kind,
        channel,
        payload: { jobTitle, notes: notes ?? undefined },
        idempotencyKey: `${kind}:${channel}:${jobPostingId}`,
      });
    }
  });

  // PRD 6.3 — employer notified when a worker applies to their posting.
  events.on('job.applicationReceived', async ({ applicationId, jobPostingId, employerId, workerId }) => {
    const empUid = await employerUserId(employerId);
    if (!empUid) return;
    const job = await db.query.jobPostings.findFirst({ where: eq(jobPostings.id, jobPostingId) });
    const personal = await db.query.workerPersonalInfo.findFirst({
      where: eq(workerPersonalInfo.workerId, workerId),
    });
    for (const channel of ['IN_APP', 'EMAIL'] as const) {
      await notifications.enqueue({
        userId: empUid,
        kind: 'job_application_received',
        channel,
        payload: {
          jobTitle: job?.title ?? 'your job posting',
          workerName: personal?.fullName ?? 'A verified worker',
        },
        idempotencyKey: `job_application_received:${channel}:${applicationId}`,
      });
    }
  });

  // §6.2 — employer verification lifecycle notifications.
  events.on('employer.submittedForVerification', async ({ employerId }) => {
    const employer = await db.query.employers.findFirst({ where: eq(employers.id, employerId) });
    await notifications.enqueueForRole('ADMIN', {
      kind: 'employer_verification_pending',
      channel: 'IN_APP',
      payload: { orgName: employer?.orgName ?? 'An employer' },
      idempotencyKey: `employer_verification_pending:${employerId}`,
    });
  });

  events.on('employer.verificationApproved', async ({ employerId }) => {
    const employer = await db.query.employers.findFirst({ where: eq(employers.id, employerId) });
    const uid = await employerUserId(employerId);
    if (!uid) return;
    for (const channel of ['IN_APP', 'EMAIL'] as const) {
      await notifications.enqueue({
        userId: uid,
        kind: 'employer_verification_approved',
        channel,
        payload: { orgName: employer?.orgName ?? 'Your organisation' },
        idempotencyKey: `employer_verification_approved:${channel}:${employerId}`,
      });
    }
  });

  events.on('employer.verificationRejected', async ({ employerId }) => {
    const employer = await db.query.employers.findFirst({ where: eq(employers.id, employerId) });
    const uid = await employerUserId(employerId);
    if (!uid) return;
    for (const channel of ['IN_APP', 'EMAIL'] as const) {
      await notifications.enqueue({
        userId: uid,
        kind: 'employer_verification_rejected',
        channel,
        payload: { notes: employer?.verificationNotes ?? undefined },
        idempotencyKey: `employer_verification_rejected:${channel}:${employerId}`,
      });
    }
  });

  // §6.3 — a RESTRICTED posting went live: notify category-matched, APPROVED workers
  // (they don't see restricted jobs in public browse). PUBLIC postings need no push —
  // they surface through normal worker browse/search.
  events.on('jobPosting.published', async ({ jobPostingId, employerId, visibility, workforceCategoryId }) => {
    if (visibility !== 'RESTRICTED' || !workforceCategoryId) return;
    const job = await db.query.jobPostings.findFirst({ where: eq(jobPostings.id, jobPostingId) });
    const employer = await db.query.employers.findFirst({ where: eq(employers.id, employerId) });
    const matched = await db
      .select({ userId: workers.userId })
      .from(workers)
      .where(
        and(
          eq(workers.workforceCategoryId, workforceCategoryId),
          eq(workers.visibilityStatus, 'APPROVED'),
        ),
      );
    for (const m of matched) {
      if (!m.userId) continue;
      for (const channel of ['IN_APP', 'SMS'] as const) {
        await notifications.enqueue({
          userId: m.userId,
          kind: 'worker_job_match',
          channel,
          payload: { jobTitle: job?.title ?? 'A new role', orgName: employer?.orgName ?? 'An employer' },
          idempotencyKey: `worker_job_match:${channel}:${jobPostingId}:${m.userId}`,
        });
      }
    }
  });

  // PRD 6.5 — worker notified (SMS + in-app) when an employer requests an interview.
  events.on('interview.requested', async ({ interviewId, employerId, workerId }) => {
    const wrkUid = await workerUserId(workerId);
    if (!wrkUid) return;
    const employer = await db.query.employers.findFirst({ where: eq(employers.id, employerId) });
    for (const channel of ['IN_APP', 'SMS'] as const) {
      await notifications.enqueue({
        userId: wrkUid,
        kind: 'interview_requested',
        channel,
        payload: { employerName: employer?.orgName ?? 'An employer' },
        idempotencyKey: `interview_requested:${channel}:${interviewId}`,
      });
    }
  });

  // PRD 6.5 — confirmed interview lands on both parties' dashboards.
  events.on('interview.confirmed', async ({ interviewId, employerId, workerId, slot }) => {
    const wrkUid = await workerUserId(workerId);
    const empUid = await employerUserId(employerId);
    if (wrkUid) {
      for (const channel of ['IN_APP', 'SMS'] as const) {
        await notifications.enqueue({
          userId: wrkUid,
          kind: 'interview_confirmed',
          channel,
          payload: { slot },
          idempotencyKey: `interview_confirmed:wrk:${channel}:${interviewId}`,
        });
      }
    }
    if (empUid) {
      await notifications.enqueue({
        userId: empUid,
        kind: 'interview_confirmed',
        channel: 'IN_APP',
        payload: { slot },
        idempotencyKey: `interview_confirmed:emp:in-app:${interviewId}`,
      });
    }
  });

  logger.info('notification subscribers registered');
}
