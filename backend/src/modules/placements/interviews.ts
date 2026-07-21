import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import { interviews, placements } from '@/shared/db/schema.js';
import { AppError } from '@/shared/errors/app-error.js';
import { events } from '@/shared/events/bus.js';
import type { InterviewFormat, InterviewOutcome } from '@oakvale/shared/enums/interview.js';
import { canTransition } from './state-machine.js';

async function getOrThrow(id: string) {
  const row = await db.query.interviews.findFirst({ where: eq(interviews.id, id) });
  if (!row) {
    throw new AppError({ code: 'INTERVIEW_NOT_FOUND', message: 'Interview not found.', statusCode: 404 });
  }
  return row;
}

export async function requestInterview(input: {
  employerId: string;
  workerId: string;
  shortlistId?: string;
  jobPostingId?: string;
  format: InterviewFormat;
  proposedSlots: string[];
  createdBy: string;
}) {
  const [row] = await db
    .insert(interviews)
    .values({
      employerId: input.employerId,
      workerId: input.workerId,
      shortlistId: input.shortlistId ?? null,
      jobPostingId: input.jobPostingId ?? null,
      format: input.format,
      proposedSlots: input.proposedSlots,
      createdBy: input.createdBy,
    })
    .returning();
  if (row) {
    events.emit('interview.requested', {
      interviewId: row.id,
      employerId: input.employerId,
      workerId: input.workerId,
    });
  }
  return row;
}

export async function listForWorker(workerId: string) {
  return db
    .select()
    .from(interviews)
    .where(eq(interviews.workerId, workerId))
    .orderBy(desc(interviews.createdAt));
}

export async function listForEmployer(employerId: string) {
  return db
    .select()
    .from(interviews)
    .where(eq(interviews.employerId, employerId))
    .orderBy(desc(interviews.createdAt));
}

export async function adminList(opts: { page: number; limit: number }) {
  return db
    .select()
    .from(interviews)
    .orderBy(desc(interviews.createdAt))
    .limit(opts.limit)
    .offset((opts.page - 1) * opts.limit);
}

/** Worker confirms one of the proposed slots. */
export async function workerConfirm(workerId: string, interviewId: string, slot: string) {
  const row = await getOrThrow(interviewId);
  if (row.workerId !== workerId) {
    throw new AppError({ code: 'FORBIDDEN', message: 'Not your interview.', statusCode: 403 });
  }
  if (row.status !== 'REQUESTED' && row.status !== 'RESCHEDULE_PROPOSED') {
    throw new AppError({
      code: 'INVALID_INTERVIEW_STATE',
      message: `Cannot confirm an interview in state ${row.status}.`,
      statusCode: 409,
    });
  }
  const [updated] = await db
    .update(interviews)
    .set({ status: 'CONFIRMED', confirmedSlot: new Date(slot) })
    .where(eq(interviews.id, interviewId))
    .returning();

  await advancePlacementToInterviewing(row.shortlistId, row.workerId);

  events.emit('interview.confirmed', {
    interviewId,
    employerId: row.employerId,
    workerId: row.workerId,
    slot,
  });
  return updated;
}

/** PRD: a confirmed interview moves the linked placement SHORTLISTED → INTERVIEWING. */
async function advancePlacementToInterviewing(
  shortlistId: string | null,
  workerId: string,
): Promise<void> {
  if (!shortlistId) return;
  const placement = await db.query.placements.findFirst({
    where: and(eq(placements.workerId, workerId), eq(placements.status, 'SHORTLISTED')),
  });
  if (placement && canTransition(placement.status, 'INTERVIEWING')) {
    await db
      .update(placements)
      .set({ status: 'INTERVIEWING' })
      .where(eq(placements.id, placement.id));
  }
}

/** Worker proposes alternative time slots. */
export async function workerPropose(workerId: string, interviewId: string, slots: string[]) {
  const row = await getOrThrow(interviewId);
  if (row.workerId !== workerId) {
    throw new AppError({ code: 'FORBIDDEN', message: 'Not your interview.', statusCode: 403 });
  }
  if (row.status !== 'REQUESTED') {
    throw new AppError({
      code: 'INVALID_INTERVIEW_STATE',
      message: `Cannot propose new times in state ${row.status}.`,
      statusCode: 409,
    });
  }
  const [updated] = await db
    .update(interviews)
    .set({ status: 'RESCHEDULE_PROPOSED', proposedSlots: slots })
    .where(eq(interviews.id, interviewId))
    .returning();
  return updated;
}

/** Employer accepts a reschedule proposal (confirms one of the worker's slots). */
export async function employerConfirm(employerId: string, interviewId: string, slot: string) {
  const row = await getOrThrow(interviewId);
  if (row.employerId !== employerId) {
    throw new AppError({ code: 'FORBIDDEN', message: 'Not your interview.', statusCode: 403 });
  }
  if (row.status !== 'RESCHEDULE_PROPOSED') {
    throw new AppError({
      code: 'INVALID_INTERVIEW_STATE',
      message: `Cannot confirm in state ${row.status}.`,
      statusCode: 409,
    });
  }
  const [updated] = await db
    .update(interviews)
    .set({ status: 'CONFIRMED', confirmedSlot: new Date(slot) })
    .where(eq(interviews.id, interviewId))
    .returning();

  await advancePlacementToInterviewing(row.shortlistId, row.workerId);

  events.emit('interview.confirmed', {
    interviewId,
    employerId: row.employerId,
    workerId: row.workerId,
    slot,
  });
  return updated;
}

/** Employer logs the post-interview outcome. */
export async function logOutcome(
  employerId: string,
  interviewId: string,
  outcome: InterviewOutcome,
  notes?: string,
) {
  const row = await getOrThrow(interviewId);
  if (row.employerId !== employerId) {
    throw new AppError({ code: 'FORBIDDEN', message: 'Not your interview.', statusCode: 403 });
  }
  if (row.status !== 'CONFIRMED') {
    throw new AppError({
      code: 'INVALID_INTERVIEW_STATE',
      message: `Outcome can only be logged for a confirmed interview (state ${row.status}).`,
      statusCode: 409,
    });
  }
  const [updated] = await db
    .update(interviews)
    .set({ status: 'COMPLETED', outcome, outcomeNotes: notes ?? null })
    .where(eq(interviews.id, interviewId))
    .returning();
  return updated;
}

export async function cancel(actorEmployerId: string, interviewId: string) {
  const row = await getOrThrow(interviewId);
  if (row.employerId !== actorEmployerId) {
    throw new AppError({ code: 'FORBIDDEN', message: 'Not your interview.', statusCode: 403 });
  }
  if (row.status === 'COMPLETED' || row.status === 'CANCELLED') {
    throw new AppError({
      code: 'INVALID_INTERVIEW_STATE',
      message: `Cannot cancel an interview in state ${row.status}.`,
      statusCode: 409,
    });
  }
  const [updated] = await db
    .update(interviews)
    .set({ status: 'CANCELLED' })
    .where(eq(interviews.id, interviewId))
    .returning();
  return updated;
}
