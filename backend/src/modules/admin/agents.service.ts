import { and, desc, eq } from 'drizzle-orm';
import { hash as argonHash } from '@node-rs/argon2';
import { db } from '@/shared/db/client.js';
import {
  agentAssignments,
  agentProfiles,
  users,
  type AgentProfile,
  type User,
} from '@/shared/db/schema.js';
import { AppError } from '@/shared/errors/app-error.js';
import { recordAudit } from '@/shared/audit/record.js';
import { revokeAllSessions } from '@/modules/auth/service.js';
import type {
  CreateAgentInput,
  UpdateAgentInput,
} from '@oakvale/shared/schema/admin.js';
import type { AgentSpecialty } from '@oakvale/shared/enums/admin.js';

export interface AgentRow {
  user: User;
  profile: AgentProfile;
}

export async function createAgent(input: CreateAgentInput, actorId?: string): Promise<AgentRow> {
  const existing = await db.query.users.findFirst({ where: eq(users.email, input.email) });
  if (existing) {
    throw new AppError({
      code: 'EMAIL_IN_USE',
      message: 'An account with this email already exists.',
      statusCode: 409,
    });
  }
  const passwordHash = await argonHash(input.password);
  const [user] = await db
    .insert(users)
    .values({
      email: input.email,
      fullName: input.fullName,
      phone: input.phone ?? null,
      role: 'AGENT',
      passwordHash,
      emailVerifiedAt: new Date(),
    })
    .returning();
  if (!user) {
    throw new AppError({ code: 'INTERNAL_ERROR', message: 'Failed to create agent.', statusCode: 500 });
  }
  const [profile] = await db
    .insert(agentProfiles)
    .values({
      id: user.id,
      specialty: input.specialty,
      region: input.region ?? null,
      bio: input.bio ?? null,
    })
    .returning();
  if (!profile) {
    throw new AppError({ code: 'INTERNAL_ERROR', message: 'Failed to create agent profile.', statusCode: 500 });
  }
  void recordAudit({
    actorId: actorId ?? null,
    action: 'agent.create',
    targetType: 'user',
    targetId: user.id,
    metadata: { specialty: input.specialty, region: input.region ?? null },
  });
  return { user, profile };
}

export async function updateAgent(
  agentId: string,
  patch: UpdateAgentInput,
  actorId?: string,
): Promise<AgentRow> {
  await getAgentOrThrow(agentId);
  const profilePatch: Partial<AgentProfile> = {};
  if (patch.specialty !== undefined) profilePatch.specialty = patch.specialty;
  if (patch.region !== undefined) profilePatch.region = patch.region ?? null;
  if (patch.bio !== undefined) profilePatch.bio = patch.bio ?? null;
  if (Object.keys(profilePatch).length) {
    await db.update(agentProfiles).set(profilePatch).where(eq(agentProfiles.id, agentId));
  }
  if (typeof patch.isActive === 'boolean') {
    await db.update(users).set({ isActive: patch.isActive }).where(eq(users.id, agentId));
    if (!patch.isActive) await revokeAllSessions(agentId);
  }
  void recordAudit({
    actorId: actorId ?? null,
    action: 'agent.update',
    targetType: 'user',
    targetId: agentId,
    metadata: patch as Record<string, unknown>,
  });
  return getAgentOrThrow(agentId);
}

export async function deactivateAgent(agentId: string, actorId?: string): Promise<void> {
  await getAgentOrThrow(agentId);
  await db.update(users).set({ isActive: false }).where(eq(users.id, agentId));
  await revokeAllSessions(agentId);
  void recordAudit({
    actorId: actorId ?? null,
    action: 'agent.deactivate',
    targetType: 'user',
    targetId: agentId,
  });
}

export async function listAgents(filters: {
  specialty?: AgentSpecialty;
  active?: boolean;
  page: number;
  limit: number;
}): Promise<AgentRow[]> {
  const conditions = [eq(users.role, 'AGENT')] as Array<ReturnType<typeof eq>>;
  if (filters.specialty) conditions.push(eq(agentProfiles.specialty, filters.specialty));
  if (typeof filters.active === 'boolean') conditions.push(eq(users.isActive, filters.active));
  const offset = (filters.page - 1) * filters.limit;
  const rows = await db
    .select({ user: users, profile: agentProfiles })
    .from(users)
    .innerJoin(agentProfiles, eq(agentProfiles.id, users.id))
    .where(and(...conditions))
    .orderBy(desc(users.createdAt))
    .limit(filters.limit)
    .offset(offset);
  return rows;
}

export async function getAgentOrThrow(agentId: string): Promise<AgentRow> {
  const rows = await db
    .select({ user: users, profile: agentProfiles })
    .from(users)
    .innerJoin(agentProfiles, eq(agentProfiles.id, users.id))
    .where(and(eq(users.id, agentId), eq(users.role, 'AGENT')))
    .limit(1);
  if (!rows[0]) {
    throw new AppError({ code: 'AGENT_NOT_FOUND', message: 'Agent not found.', statusCode: 404 });
  }
  return rows[0];
}

export async function getAgentDetail(agentId: string) {
  const row = await getAgentOrThrow(agentId);
  const assignments = await db
    .select()
    .from(agentAssignments)
    .where(eq(agentAssignments.agentId, agentId))
    .orderBy(desc(agentAssignments.assignedAt));
  return { ...row, assignments };
}

/**
 * Self-serve profile fetch for staff. Unlike getAgentOrThrow this tolerates a
 * missing agent_profiles row: pure ADMIN users are seeded straight into `users`
 * with no profile, so `profile` comes back null for them.
 */
export async function getSelf(userId: string): Promise<{ user: User; profile: AgentProfile | null }> {
  const rows = await db
    .select({ user: users, profile: agentProfiles })
    .from(users)
    .leftJoin(agentProfiles, eq(agentProfiles.id, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  if (!rows[0]) {
    throw new AppError({ code: 'USER_NOT_FOUND', message: 'User not found.', statusCode: 404 });
  }
  return rows[0];
}
