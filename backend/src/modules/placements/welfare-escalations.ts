import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import { welfareEscalations, placements } from '@/shared/db/schema.js';
import { AppError } from '@/shared/errors/app-error.js';
import { events } from '@/shared/events/bus.js';

const ESCALATION_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function openEscalation(opts: {
  welfareCheckId: string;
  placementId: string;
  severity: 'FAIR' | 'POOR';
}) {
  const dueAt = new Date(Date.now() + ESCALATION_WINDOW_MS);
  const [row] = await db
    .insert(welfareEscalations)
    .values({
      welfareCheckId: opts.welfareCheckId,
      placementId: opts.placementId,
      severity: opts.severity,
      dueAt,
    })
    .returning();
  if (!row) {
    throw new AppError({
      code: 'INTERNAL_ERROR',
      message: 'Failed to create welfare escalation.',
      statusCode: 500,
    });
  }
  events.emit('welfare.escalationOpened', {
    escalationId: row.id,
    placementId: row.placementId,
    welfareCheckId: row.welfareCheckId,
    severity: row.severity,
    dueAt: row.dueAt.toISOString(),
  });
  return row;
}

export async function getEscalationOrThrow(id: string) {
  const row = await db.query.welfareEscalations.findFirst({
    where: eq(welfareEscalations.id, id),
  });
  if (!row) {
    throw new AppError({
      code: 'WELFARE_ESCALATION_NOT_FOUND',
      message: 'Welfare escalation not found.',
      statusCode: 404,
    });
  }
  return row;
}

export async function listOpen() {
  return db
    .select({
      escalation: welfareEscalations,
      placement: placements,
    })
    .from(welfareEscalations)
    .innerJoin(placements, eq(placements.id, welfareEscalations.placementId))
    .where(isNull(welfareEscalations.resolvedAt))
    .orderBy(welfareEscalations.dueAt);
}

export async function listForPlacement(placementId: string) {
  return db
    .select()
    .from(welfareEscalations)
    .where(eq(welfareEscalations.placementId, placementId))
    .orderBy(desc(welfareEscalations.createdAt));
}

export async function resolve(id: string, resolvedBy: string, notes: string | null) {
  const row = await getEscalationOrThrow(id);
  if (row.resolvedAt) return row;
  const [updated] = await db
    .update(welfareEscalations)
    .set({ resolvedAt: new Date(), resolvedBy, resolutionNotes: notes })
    .where(eq(welfareEscalations.id, id))
    .returning();
  if (updated) {
    events.emit('welfare.escalationResolved', {
      escalationId: updated.id,
      placementId: updated.placementId,
    });
  }
  return updated ?? row;
}

export async function markOverdueNotified(id: string) {
  await db
    .update(welfareEscalations)
    .set({ overdueNotifiedAt: new Date() })
    .where(and(eq(welfareEscalations.id, id), isNull(welfareEscalations.overdueNotifiedAt)));
}
