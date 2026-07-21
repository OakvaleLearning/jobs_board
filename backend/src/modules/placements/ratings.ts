import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import { placementRatings, placements } from '@/shared/db/schema.js';
import { AppError } from '@/shared/errors/app-error.js';
import { recordAudit } from '@/shared/audit/record.js';
import type { RatingCreateInput } from '@oakvale/shared/schema/placement.js';

export interface RatingSummary {
  /** Mean stars on a 0–5 scale; 0 when there are no ratings. */
  average: number;
  count: number;
}

export interface WorkerRating {
  id: string;
  placementId: string;
  stars: number;
  review: string | null;
  createdAt: Date;
}

/**
 * Employer rates the worker for a placement. One rating per placement; only the
 * owning employer, and only once the engagement is underway (ACTIVE) or finished
 * (COMPLETED). Feeds the matcher's rating weight (see matching.ts scoreRating).
 */
export async function createRating(
  placementId: string,
  employerId: string,
  ratedByUserId: string,
  input: RatingCreateInput,
): Promise<{ id: string; stars: number }> {
  const placement = await db.query.placements.findFirst({ where: eq(placements.id, placementId) });
  if (!placement) {
    throw new AppError({ code: 'PLACEMENT_NOT_FOUND', message: 'Placement not found.', statusCode: 404 });
  }
  if (placement.employerId !== employerId) {
    throw new AppError({ code: 'FORBIDDEN', message: 'Not your placement.', statusCode: 403 });
  }
  if (placement.status !== 'ACTIVE' && placement.status !== 'COMPLETED') {
    throw new AppError({
      code: 'INVALID_PLACEMENT_TRANSITION',
      message: 'A worker can only be rated for an active or completed placement.',
      statusCode: 409,
    });
  }
  const existing = await db.query.placementRatings.findFirst({
    where: and(eq(placementRatings.placementId, placementId), isNull(placementRatings.deletedAt)),
  });
  if (existing) {
    throw new AppError({
      code: 'CONFLICT',
      message: 'This placement has already been rated.',
      statusCode: 409,
    });
  }
  const [row] = await db
    .insert(placementRatings)
    .values({
      placementId,
      workerId: placement.workerId,
      employerId,
      ratedBy: ratedByUserId,
      stars: input.stars,
      review: input.review ?? null,
    })
    .returning({ id: placementRatings.id, stars: placementRatings.stars });
  if (!row) throw new AppError({ code: 'INTERNAL_ERROR', message: 'Failed to save rating.', statusCode: 500 });

  void recordAudit({
    actorId: ratedByUserId,
    action: 'placement.rated',
    targetType: 'placement',
    targetId: placementId,
    metadata: { stars: input.stars, workerId: placement.workerId },
  });
  return row;
}

/** Average + count for a single worker. */
export async function getWorkerRatingSummary(workerId: string): Promise<RatingSummary> {
  const map = await getWorkerRatingSummaries([workerId]);
  return map.get(workerId) ?? { average: 0, count: 0 };
}

/** Batched averages keyed by workerId — used when scoring a candidate pool. */
export async function getWorkerRatingSummaries(workerIds: string[]): Promise<Map<string, RatingSummary>> {
  const out = new Map<string, RatingSummary>();
  if (workerIds.length === 0) return out;
  const rows = await db
    .select({
      workerId: placementRatings.workerId,
      avg: sql<number>`avg(${placementRatings.stars})`,
      count: sql<number>`count(*)`,
    })
    .from(placementRatings)
    .where(and(inArray(placementRatings.workerId, workerIds), isNull(placementRatings.deletedAt)))
    .groupBy(placementRatings.workerId);
  for (const r of rows) {
    out.set(r.workerId, { average: Math.round(Number(r.avg) * 10) / 10, count: Number(r.count) });
  }
  return out;
}

/** Full review list for a worker profile view (most recent first). */
export async function listWorkerRatings(workerId: string): Promise<WorkerRating[]> {
  const rows = await db
    .select({
      id: placementRatings.id,
      placementId: placementRatings.placementId,
      stars: placementRatings.stars,
      review: placementRatings.review,
      createdAt: placementRatings.createdAt,
    })
    .from(placementRatings)
    .where(and(eq(placementRatings.workerId, workerId), isNull(placementRatings.deletedAt)))
    .orderBy(desc(placementRatings.createdAt));
  return rows;
}
