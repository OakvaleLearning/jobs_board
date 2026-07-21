import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import { placementOffers, shortlists, workers } from '@/shared/db/schema.js';
import { AppError } from '@/shared/errors/app-error.js';
import { events } from '@/shared/events/bus.js';
import { recordAudit } from '@/shared/audit/record.js';
import type { OfferStatus } from '@oakvale/shared/enums/offer.js';
import type {
  OfferCounterInput,
  OfferCreateInput,
  OfferFiltersInput,
} from '@oakvale/shared/schema/offer.js';
import { assertOfferTransition } from './state-machine.js';

async function getOrThrow(offerId: string) {
  const row = await db.query.placementOffers.findFirst({
    where: eq(placementOffers.id, offerId),
  });
  if (!row) {
    throw new AppError({ code: 'OFFER_NOT_FOUND', message: 'Offer not found', statusCode: 404 });
  }
  return row;
}

export async function createOffer(input: OfferCreateInput, createdBy: string, employerId: string) {
  const sl = await db.query.shortlists.findFirst({
    where: eq(shortlists.id, input.shortlistId),
  });
  if (!sl) {
    throw new AppError({
      code: 'SHORTLIST_NOT_FOUND',
      message: 'Shortlist not found',
      statusCode: 404,
    });
  }
  if (sl.employerId !== employerId) {
    throw new AppError({
      code: 'FORBIDDEN',
      message: 'Shortlist belongs to another employer',
      statusCode: 403,
    });
  }
  // duplicate-live guard (DB UNIQUE is the source of truth; this gives a nicer error)
  const dup = await db.query.placementOffers.findFirst({
    where: and(
      eq(placementOffers.shortlistId, input.shortlistId),
      eq(placementOffers.workerId, input.workerId),
      sql`status NOT IN ('WITHDRAWN','DECLINED')`,
    ),
  });
  if (dup) {
    throw new AppError({
      code: 'OFFER_DUPLICATE',
      message: 'A live offer already exists for this shortlist/worker',
      statusCode: 409,
    });
  }

  const [row] = await db
    .insert(placementOffers)
    .values({
      shortlistId: input.shortlistId,
      employerId,
      workerId: input.workerId,
      createdBy,
      status: 'AGENT_REVIEW', // employer submission goes straight to review
      pipelineType: sl.requestType,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      salaryAmountMinor: input.salaryAmountMinor,
      salaryCurrency: input.salaryCurrency,
      accommodationType: input.accommodationType ?? null,
      schedule: input.schedule ?? null,
      notes: input.notes ?? null,
    })
    .returning();
  if (!row) {
    throw new AppError({ code: 'INTERNAL_ERROR', message: 'Failed to create offer.', statusCode: 500 });
  }

  events.emit('offer.created', {
    offerId: row.id,
    employerId,
    workerId: row.workerId,
    shortlistId: row.shortlistId,
  });
  events.emit('offer.submittedForReview', { offerId: row.id });
  await recordAudit({
    actorId: createdBy,
    action: 'offer.created',
    targetType: 'offer',
    targetId: row.id,
    metadata: { shortlistId: row.shortlistId, workerId: row.workerId },
  });
  return row;
}

export async function agentApprove(offerId: string, agentUserId: string) {
  const offer = await getOrThrow(offerId);
  assertOfferTransition(offer.status, 'SENT_TO_WORKER');
  const [row] = await db
    .update(placementOffers)
    .set({
      status: 'SENT_TO_WORKER',
      agentReviewedBy: agentUserId,
      agentReviewedAt: new Date(),
    })
    .where(eq(placementOffers.id, offerId))
    .returning();
  events.emit('offer.approved', { offerId, reviewedBy: agentUserId });
  events.emit('offer.sent', { offerId });
  await recordAudit({
    actorId: agentUserId,
    action: 'offer.approved',
    targetType: 'offer',
    targetId: offerId,
  });
  return row;
}

export async function workerAccept(
  offerId: string,
  workerUserId: string,
  createPlacementFromOffer: (
    offerId: string,
  ) => Promise<{ id: string }>,
) {
  const offer = await getOrThrow(offerId);
  // Ensure caller is the offer's worker user
  const worker = await db.query.workers.findFirst({ where: eq(workers.id, offer.workerId) });
  if (!worker || worker.userId !== workerUserId) {
    throw new AppError({ code: 'FORBIDDEN', message: 'Not your offer', statusCode: 403 });
  }
  assertOfferTransition(offer.status, 'ACCEPTED');
  const placement = await createPlacementFromOffer(offer.id);
  const [row] = await db
    .update(placementOffers)
    .set({
      status: 'ACCEPTED',
      workerRespondedAt: new Date(),
      acceptedAt: new Date(),
      placementId: placement.id,
    })
    .where(eq(placementOffers.id, offerId))
    .returning();
  events.emit('offer.accepted', { offerId, placementId: placement.id });
  await recordAudit({
    actorId: workerUserId,
    action: 'offer.accepted',
    targetType: 'offer',
    targetId: offerId,
    metadata: { placementId: placement.id },
  });
  return row;
}

export async function workerDecline(offerId: string, workerUserId: string, reason: string) {
  const offer = await getOrThrow(offerId);
  const worker = await db.query.workers.findFirst({ where: eq(workers.id, offer.workerId) });
  if (!worker || worker.userId !== workerUserId) {
    throw new AppError({ code: 'FORBIDDEN', message: 'Not your offer', statusCode: 403 });
  }
  assertOfferTransition(offer.status, 'DECLINED');
  const [row] = await db
    .update(placementOffers)
    .set({
      status: 'DECLINED',
      workerRespondedAt: new Date(),
      declinedReason: reason,
    })
    .where(eq(placementOffers.id, offerId))
    .returning();
  events.emit('offer.declined', { offerId, reason });
  return row;
}

export async function workerCounter(
  offerId: string,
  workerUserId: string,
  input: OfferCounterInput,
) {
  const offer = await getOrThrow(offerId);
  const worker = await db.query.workers.findFirst({ where: eq(workers.id, offer.workerId) });
  if (!worker || worker.userId !== workerUserId) {
    throw new AppError({ code: 'FORBIDDEN', message: 'Not your offer', statusCode: 403 });
  }
  assertOfferTransition(offer.status, 'COUNTERED');

  // Create a new offer row representing the counter, then return both
  const [counter] = await db
    .insert(placementOffers)
    .values({
      shortlistId: offer.shortlistId,
      employerId: offer.employerId,
      workerId: offer.workerId,
      createdBy: workerUserId,
      status: 'AGENT_REVIEW',
      pipelineType: offer.pipelineType,
      startDate: input.startDate ?? offer.startDate,
      endDate: input.endDate ?? offer.endDate,
      salaryAmountMinor: input.salaryAmountMinor ?? offer.salaryAmountMinor,
      salaryCurrency: input.salaryCurrency ?? offer.salaryCurrency,
      accommodationType: input.accommodationType ?? offer.accommodationType,
      schedule: input.schedule ?? offer.schedule,
      notes: input.notes,
    })
    .returning();
  if (!counter) {
    throw new AppError({ code: 'INTERNAL_ERROR', message: 'Failed to create counter-offer.', statusCode: 500 });
  }

  await db
    .update(placementOffers)
    .set({
      status: 'COUNTERED',
      workerRespondedAt: new Date(),
      counterOfferId: counter.id,
    })
    .where(eq(placementOffers.id, offerId));

  events.emit('offer.countered', { offerId, counterOfferId: counter.id });
  return counter;
}

export async function withdraw(offerId: string, actorUserId: string) {
  const offer = await getOrThrow(offerId);
  assertOfferTransition(offer.status, 'WITHDRAWN');
  const [row] = await db
    .update(placementOffers)
    .set({ status: 'WITHDRAWN' })
    .where(eq(placementOffers.id, offerId))
    .returning();
  events.emit('offer.withdrawn', { offerId });
  await recordAudit({
    actorId: actorUserId,
    action: 'offer.withdrawn',
    targetType: 'offer',
    targetId: offerId,
  });
  return row;
}

export async function listForEmployer(employerId: string, filters: OfferFiltersInput) {
  const where = [eq(placementOffers.employerId, employerId)];
  if (filters.status) where.push(eq(placementOffers.status, filters.status));
  const offset = (filters.page - 1) * filters.limit;
  const rows = await db
    .select()
    .from(placementOffers)
    .where(and(...where))
    .orderBy(desc(placementOffers.updatedAt))
    .limit(filters.limit)
    .offset(offset);
  return { data: rows };
}

export async function listForWorker(workerId: string, filters: OfferFiltersInput) {
  const where = [eq(placementOffers.workerId, workerId)];
  if (filters.status) where.push(eq(placementOffers.status, filters.status));
  const offset = (filters.page - 1) * filters.limit;
  const rows = await db
    .select()
    .from(placementOffers)
    .where(and(...where))
    .orderBy(desc(placementOffers.updatedAt))
    .limit(filters.limit)
    .offset(offset);
  return { data: rows };
}

export async function listForAgentReview(opts: { page: number; limit: number }) {
  const offset = (opts.page - 1) * opts.limit;
  const rows = await db
    .select()
    .from(placementOffers)
    .where(eq(placementOffers.status, 'AGENT_REVIEW'))
    .orderBy(desc(placementOffers.createdAt))
    .limit(opts.limit)
    .offset(offset);
  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(placementOffers)
    .where(eq(placementOffers.status, 'AGENT_REVIEW'));
  return {
    data: rows,
    meta: { total: countRows[0]?.count ?? 0, page: opts.page, limit: opts.limit },
  };
}

export async function detail(offerId: string) {
  const offer = await getOrThrow(offerId);
  return offer;
}

export async function getOfferOrNull(offerId: string) {
  return db.query.placementOffers.findFirst({ where: eq(placementOffers.id, offerId) });
}

export type { OfferStatus };
