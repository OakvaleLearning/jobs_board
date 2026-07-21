import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import { complaintEvents, complaints, users } from '@/shared/db/schema.js';
import { AppError } from '@/shared/errors/app-error.js';
import { events } from '@/shared/events/bus.js';
import { recordAudit } from '@/shared/audit/record.js';
import { addBusinessDays } from '@/shared/utils/business-days.js';
import {
  COMPLAINT_SLA_BUSINESS_DAYS,
  type ComplaintEventKind,
  type ComplaintOutcome,
  type ComplaintStatus,
  type ComplaintUrgency,
} from '@oakvale/shared/enums/complaints.js';
import type {
  ComplaintFiltersInput,
  ComplaintRaiseInput,
  ComplaintResolveInput,
} from '@oakvale/shared/schema/complaints.js';

function buildCaseRef(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 1e5)
    .toString()
    .padStart(5, '0');
  return `CMP-${year}-${rand}`;
}

function computeSlaDeadline(urgency: ComplaintUrgency, raisedAt: Date): Date {
  const businessDays = COMPLAINT_SLA_BUSINESS_DAYS[urgency];
  // CRITICAL = same day → +4 hours rather than business-day math
  if (urgency === 'CRITICAL') {
    return new Date(raisedAt.getTime() + 4 * 60 * 60 * 1000);
  }
  return addBusinessDays(raisedAt, businessDays);
}

async function logEvent(
  complaintId: string,
  kind: ComplaintEventKind,
  actorId: string | null,
  notes: string | null,
  metadata: Record<string, unknown> = {},
) {
  await db.insert(complaintEvents).values({
    complaintId,
    actorId,
    kind,
    notes,
    metadata,
  });
}

export async function raiseComplaint(input: ComplaintRaiseInput, raisedByUserId: string) {
  const now = new Date();
  const caseRef = buildCaseRef();
  const slaDeadline = computeSlaDeadline(input.urgency, now);

  const [row] = await db
    .insert(complaints)
    .values({
      caseRef,
      category: input.category,
      urgency: input.urgency,
      status: 'SUBMITTED',
      subject: input.subject,
      narrative: input.narrative,
      raisedByUserId,
      againstUserId: input.againstUserId ?? null,
      placementId: input.placementId ?? null,
      slaDeadline,
    })
    .returning();
  if (!row) {
    throw new AppError({ code: 'INTERNAL_ERROR', message: 'Failed to raise complaint.', statusCode: 500 });
  }

  await logEvent(row.id, 'SUBMITTED', raisedByUserId, null, { caseRef });
  await recordAudit({
    actorId: raisedByUserId,
    action: 'complaint.raised',
    targetType: 'complaint',
    targetId: row.id,
    metadata: { caseRef, category: row.category, urgency: row.urgency },
  });

  events.emit('complaint.raised', {
    complaintId: row.id,
    caseRef,
    category: row.category,
    urgency: row.urgency,
    raisedByUserId,
    againstUserId: row.againstUserId,
    placementId: row.placementId,
  });

  if (input.category === 'SAFEGUARDING') {
    events.emit('complaint.safeguardingRaised', {
      complaintId: row.id,
      placementId: row.placementId,
      againstUserId: row.againstUserId,
    });
  }

  return row;
}

export async function getOrThrow(complaintId: string) {
  const row = await db.query.complaints.findFirst({ where: eq(complaints.id, complaintId) });
  if (!row) {
    throw new AppError({
      code: 'COMPLAINT_NOT_FOUND',
      message: 'Complaint not found',
      statusCode: 404,
    });
  }
  return row;
}

export async function detail(complaintId: string) {
  const complaint = await getOrThrow(complaintId);
  const log = await db
    .select()
    .from(complaintEvents)
    .where(eq(complaintEvents.complaintId, complaintId))
    .orderBy(desc(complaintEvents.occurredAt));
  return { complaint, events: log };
}

export async function acknowledge(complaintId: string, actorId: string) {
  const complaint = await getOrThrow(complaintId);
  if (complaint.status !== 'SUBMITTED') return complaint;
  const [row] = await db
    .update(complaints)
    .set({ status: 'ACKNOWLEDGED', acknowledgedAt: new Date() })
    .where(eq(complaints.id, complaintId))
    .returning();
  await logEvent(complaintId, 'ACKNOWLEDGED', actorId, null);
  return row;
}

export async function assign(complaintId: string, agentId: string, actorId: string) {
  const complaint = await getOrThrow(complaintId);
  if (complaint.status === 'RESOLVED' || complaint.status === 'CLOSED') {
    throw new AppError({
      code: 'COMPLAINT_NOT_ASSIGNABLE',
      message: 'Complaint is closed',
      statusCode: 409,
    });
  }
  // Verify agent is an AGENT or ADMIN
  const agent = await db.query.users.findFirst({ where: eq(users.id, agentId) });
  if (!agent || (agent.role !== 'AGENT' && agent.role !== 'ADMIN')) {
    throw new AppError({
      code: 'COMPLAINT_NOT_ASSIGNABLE',
      message: 'Target user is not an agent',
      statusCode: 400,
    });
  }
  const [row] = await db
    .update(complaints)
    .set({
      assignedToAgentId: agentId,
      status: complaint.status === 'SUBMITTED' ? 'ACKNOWLEDGED' : complaint.status,
      acknowledgedAt: complaint.acknowledgedAt ?? new Date(),
    })
    .where(eq(complaints.id, complaintId))
    .returning();
  await logEvent(complaintId, 'ASSIGNED', actorId, null, { agentId });
  await recordAudit({
    actorId,
    action: 'complaint.assigned',
    targetType: 'complaint',
    targetId: complaintId,
    metadata: { agentId },
  });
  return row;
}

export async function setStatus(complaintId: string, status: ComplaintStatus, actorId: string) {
  await getOrThrow(complaintId);
  const [row] = await db
    .update(complaints)
    .set({ status })
    .where(eq(complaints.id, complaintId))
    .returning();
  await logEvent(complaintId, 'STATUS_CHANGED', actorId, null, { status });
  return row;
}

export async function addNote(complaintId: string, note: string, actorId: string) {
  await getOrThrow(complaintId);
  await logEvent(complaintId, 'NOTE', actorId, note);
}

export async function resolve(
  complaintId: string,
  input: ComplaintResolveInput,
  actorId: string,
) {
  const complaint = await getOrThrow(complaintId);
  if (complaint.status === 'RESOLVED' || complaint.status === 'CLOSED') {
    throw new AppError({
      code: 'COMPLAINT_ALREADY_RESOLVED',
      message: 'Complaint already resolved',
      statusCode: 409,
    });
  }
  const [row] = await db
    .update(complaints)
    .set({
      status: 'RESOLVED',
      resolvedAt: new Date(),
      outcome: input.outcome,
      resolutionNote: input.resolutionNote,
    })
    .where(eq(complaints.id, complaintId))
    .returning();
  await logEvent(complaintId, 'RESOLVED', actorId, input.resolutionNote, {
    outcome: input.outcome,
  });
  events.emit('complaint.resolved', { complaintId, outcome: input.outcome });
  await recordAudit({
    actorId,
    action: 'complaint.resolved',
    targetType: 'complaint',
    targetId: complaintId,
    metadata: { outcome: input.outcome },
  });
  return row;
}

export async function listForUser(userId: string) {
  return db
    .select()
    .from(complaints)
    .where(sql`${complaints.raisedByUserId} = ${userId} OR ${complaints.againstUserId} = ${userId}`)
    .orderBy(desc(complaints.createdAt));
}

export async function adminList(filters: ComplaintFiltersInput, currentUserId: string) {
  const offset = (filters.page - 1) * filters.limit;
  const whereClauses = [];
  if (filters.category) whereClauses.push(eq(complaints.category, filters.category));
  if (filters.urgency) whereClauses.push(eq(complaints.urgency, filters.urgency));
  if (filters.status) whereClauses.push(eq(complaints.status, filters.status));
  if (filters.assignedToMe) whereClauses.push(eq(complaints.assignedToAgentId, currentUserId));
  const rows = await db
    .select()
    .from(complaints)
    .where(whereClauses.length ? and(...whereClauses) : undefined)
    .orderBy(desc(complaints.createdAt))
    .limit(filters.limit)
    .offset(offset);
  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(complaints)
    .where(whereClauses.length ? and(...whereClauses) : undefined);
  return {
    data: rows,
    meta: { total: countRows[0]?.count ?? 0, page: filters.page, limit: filters.limit },
  };
}

export type { ComplaintOutcome };
