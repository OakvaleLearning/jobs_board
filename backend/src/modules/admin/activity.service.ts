import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import {
  agentAssignments,
  notificationLog,
  placementEvents,
} from '@/shared/db/schema.js';

export interface ActivityItem {
  occurredAt: string;
  kind: string;
  summary: string;
  refType: 'placement' | 'assignment' | 'notification';
  refId: string;
}

export function unionByOccurredAt(items: ActivityItem[]): ActivityItem[] {
  return [...items].sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
}

export async function listForAgent(
  agentId: string,
  opts: { from?: Date; to?: Date; page: number; limit: number },
): Promise<{ rows: ActivityItem[]; total: number }> {
  const out: ActivityItem[] = [];

  // 1. Assignments
  const aConds = [eq(agentAssignments.agentId, agentId)] as Array<ReturnType<typeof eq>>;
  if (opts.from) aConds.push(gte(agentAssignments.assignedAt, opts.from));
  if (opts.to) aConds.push(lte(agentAssignments.assignedAt, opts.to));
  const assignments = await db
    .select()
    .from(agentAssignments)
    .where(and(...aConds))
    .orderBy(desc(agentAssignments.assignedAt))
    .limit(200);
  for (const a of assignments) {
    out.push({
      occurredAt: a.assignedAt.toISOString(),
      kind: `assigned_${a.placementId ? 'placement' : 'worker'}`,
      summary: `Assigned as ${a.roleOnAssignment} to ${
        a.placementId ? `placement ${a.placementId.slice(0, 8)}` : `worker ${a.workerId?.slice(0, 8)}`
      }`,
      refType: 'assignment',
      refId: a.id,
    });
  }

  // 2. Placement events authored by the agent
  const peConds = [eq(placementEvents.actorId, agentId)] as Array<ReturnType<typeof eq>>;
  if (opts.from) peConds.push(gte(placementEvents.occurredAt, opts.from));
  if (opts.to) peConds.push(lte(placementEvents.occurredAt, opts.to));
  const events = await db
    .select()
    .from(placementEvents)
    .where(and(...peConds))
    .orderBy(desc(placementEvents.occurredAt))
    .limit(200);
  for (const e of events) {
    out.push({
      occurredAt: e.occurredAt.toISOString(),
      kind: `placement_${e.eventType.toLowerCase()}`,
      summary: `Placement ${e.placementId.slice(0, 8)} · ${e.eventType}`,
      refType: 'placement',
      refId: e.placementId,
    });
  }

  // 3. Notifications received by the agent
  const nConds = [eq(notificationLog.userId, agentId)] as Array<ReturnType<typeof eq>>;
  if (opts.from) nConds.push(gte(notificationLog.createdAt, opts.from));
  if (opts.to) nConds.push(lte(notificationLog.createdAt, opts.to));
  const notes = await db
    .select()
    .from(notificationLog)
    .where(and(...nConds))
    .orderBy(desc(notificationLog.createdAt))
    .limit(200);
  for (const n of notes) {
    out.push({
      occurredAt: n.createdAt.toISOString(),
      kind: n.kind,
      summary: n.subject ?? n.kind,
      refType: 'notification',
      refId: n.id,
    });
  }

  const merged = unionByOccurredAt(out);
  const offset = (opts.page - 1) * opts.limit;
  return { rows: merged.slice(offset, offset + opts.limit), total: merged.length };
}
