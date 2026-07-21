import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import { agentAssignments, type AgentAssignment } from '@/shared/db/schema.js';
import { AppError } from '@/shared/errors/app-error.js';
import { recordAudit } from '@/shared/audit/record.js';
import type { CreateAssignmentInput } from '@oakvale/shared/schema/admin.js';
import { getAgentOrThrow } from './agents.service.js';

export async function createAssignment(
  agentId: string,
  input: CreateAssignmentInput,
  assignedBy: string,
): Promise<AgentAssignment> {
  await getAgentOrThrow(agentId);
  if (
    (!!input.placementId && !!input.workerId) ||
    (!input.placementId && !input.workerId)
  ) {
    throw new AppError({
      code: 'INVALID_ASSIGNMENT_TARGET',
      message: 'Provide exactly one of placementId or workerId.',
      statusCode: 400,
    });
  }
  const [row] = await db
    .insert(agentAssignments)
    .values({
      agentId,
      placementId: input.placementId ?? null,
      workerId: input.workerId ?? null,
      roleOnAssignment: input.roleOnAssignment,
      assignedBy,
      notes: input.notes ?? null,
    })
    .returning();
  if (!row) {
    throw new AppError({ code: 'INTERNAL_ERROR', message: 'Failed to create assignment.', statusCode: 500 });
  }
  void recordAudit({
    actorId: assignedBy,
    action: 'assignment.create',
    targetType: 'assignment',
    targetId: row.id,
    metadata: {
      agentId,
      placementId: input.placementId ?? null,
      workerId: input.workerId ?? null,
      role: input.roleOnAssignment,
    },
  });
  return row;
}

export async function removeAssignment(assignmentId: string, actorId?: string): Promise<void> {
  const existing = await db.query.agentAssignments.findFirst({
    where: eq(agentAssignments.id, assignmentId),
  });
  if (!existing) {
    throw new AppError({
      code: 'ASSIGNMENT_NOT_FOUND',
      message: 'Assignment not found.',
      statusCode: 404,
    });
  }
  await db
    .update(agentAssignments)
    .set({ removedAt: new Date() })
    .where(eq(agentAssignments.id, assignmentId));
  void recordAudit({
    actorId: actorId ?? null,
    action: 'assignment.remove',
    targetType: 'assignment',
    targetId: assignmentId,
  });
}

export async function listAssignmentsForAgent(agentId: string, activeOnly = true) {
  const conditions = [eq(agentAssignments.agentId, agentId)] as Array<ReturnType<typeof eq>>;
  if (activeOnly) conditions.push(isNull(agentAssignments.removedAt));
  return db
    .select()
    .from(agentAssignments)
    .where(and(...conditions))
    .orderBy(desc(agentAssignments.assignedAt));
}

export function isValidAssignmentTarget(input: {
  placementId?: string;
  workerId?: string;
}): boolean {
  return (!!input.placementId && !input.workerId) || (!input.placementId && !!input.workerId);
}
