import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import { employerDocuments, employers, users } from '@/shared/db/schema.js';
import { AppError } from '@/shared/errors/app-error.js';
import { recordAudit } from '@/shared/audit/record.js';
import { events } from '@/shared/events/bus.js';
import type { EmployerVerificationReviewInput } from '@oakvale/shared/schema/employer.js';

/**
 * §6.2 — agent/admin reviews a PENDING employer registration and approves or rejects.
 * On approval an account manager is recorded (the supplied agent, else the reviewer).
 */
export async function reviewEmployer(
  employerId: string,
  reviewerUserId: string,
  input: EmployerVerificationReviewInput,
): Promise<void> {
  const employer = await db.query.employers.findFirst({ where: eq(employers.id, employerId) });
  if (!employer) {
    throw new AppError({ code: 'EMPLOYER_NOT_FOUND', message: 'Employer not found.', statusCode: 404 });
  }
  if (employer.verificationStatus !== 'PENDING') {
    throw new AppError({
      code: 'CONFLICT',
      message: 'Only employers pending verification can be reviewed.',
      statusCode: 409,
      details: { status: employer.verificationStatus },
    });
  }
  const approved = input.decision === 'APPROVED';
  await db
    .update(employers)
    .set({
      verificationStatus: input.decision,
      verificationReviewedAt: new Date(),
      verificationReviewedBy: reviewerUserId,
      verificationNotes: input.notes ?? null,
      accountManagerId: approved ? (input.accountManagerId ?? reviewerUserId) : null,
    })
    .where(eq(employers.id, employerId));

  events.emit(approved ? 'employer.verificationApproved' : 'employer.verificationRejected', {
    employerId,
  });
  void recordAudit({
    actorId: reviewerUserId,
    action: approved ? 'employer.verificationApproved' : 'employer.verificationRejected',
    targetType: 'employer',
    targetId: employerId,
    metadata: { notes: input.notes ?? null, accountManagerId: input.accountManagerId ?? null },
  });
}

export interface EmployerVerificationQueueRow {
  employerId: string;
  orgName: string | null;
  email: string;
  verificationStatus: string;
  verificationSubmittedAt: Date | null;
  documentCount: number;
  createdAt: Date;
}

/** §6.2 — agent queue of employers awaiting verification (PENDING, submitted first). */
export async function employerVerificationQueue(opts: {
  page: number;
  limit: number;
}): Promise<{ rows: EmployerVerificationQueueRow[]; total: number }> {
  const docCount = db
    .select({
      employerId: employerDocuments.employerId,
      count: sql<number>`count(*)::int`.as('doc_count'),
    })
    .from(employerDocuments)
    .groupBy(employerDocuments.employerId)
    .as('doc_count');

  const rows = await db
    .select({
      employerId: employers.id,
      orgName: employers.orgName,
      email: users.email,
      verificationStatus: employers.verificationStatus,
      verificationSubmittedAt: employers.verificationSubmittedAt,
      documentCount: sql<number>`coalesce(${docCount.count}, 0)`,
      createdAt: employers.createdAt,
    })
    .from(employers)
    .innerJoin(users, eq(users.id, employers.userId))
    .leftJoin(docCount, eq(docCount.employerId, employers.id))
    .where(eq(employers.verificationStatus, 'PENDING'))
    .orderBy(desc(employers.verificationSubmittedAt), desc(employers.createdAt))
    .limit(opts.limit)
    .offset((opts.page - 1) * opts.limit);

  const totalRows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(employers)
    .where(eq(employers.verificationStatus, 'PENDING'));

  return { rows, total: totalRows[0]?.total ?? 0 };
}

/** Staff-facing detail: employer + uploaded documents (for the review screen). */
export async function getEmployerForReview(employerId: string) {
  const employer = await db.query.employers.findFirst({ where: eq(employers.id, employerId) });
  if (!employer) {
    throw new AppError({ code: 'EMPLOYER_NOT_FOUND', message: 'Employer not found.', statusCode: 404 });
  }
  const docs = await db
    .select()
    .from(employerDocuments)
    .where(eq(employerDocuments.employerId, employerId));
  const owner = await db.query.users.findFirst({ where: eq(users.id, employer.userId) });
  return {
    employer,
    documents: docs,
    referral: {
      source: owner?.referralSource ?? null,
      referrerName: owner?.referrerName ?? null,
    },
  };
}
