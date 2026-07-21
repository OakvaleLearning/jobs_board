import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import {
  employers,
  employerTypes,
  subscriptions,
  users,
} from '@/shared/db/schema.js';
import * as workersService from '@/modules/workers/service.js';
import type { VisibilityStatus } from '@oakvale/shared/enums/worker.js';

export async function listWorkersAdmin(filters: {
  visibility?: VisibilityStatus;
  q?: string;
  page: number;
  limit: number;
}) {
  return workersService.search({
    q: filters.q,
    status: filters.visibility,
    page: filters.page,
    limit: filters.limit,
    applyVisibilityGate: false,
  });
}

export async function listEmployersAdmin(filters: {
  employerTypeId?: string;
  hasSubscription?: boolean;
  onboarded?: boolean;
  page: number;
  limit: number;
}) {
  const conds = [] as Array<ReturnType<typeof eq>>;
  if (filters.employerTypeId) conds.push(eq(employers.employerTypeId, filters.employerTypeId));
  const offset = (filters.page - 1) * filters.limit;

  const rows = await db
    .select({
      id: employers.id,
      employerTypeId: employers.employerTypeId,
      employerType: employerTypes.slug,
      employerTypeName: employerTypes.name,
      orgName: employers.orgName,
      onboardingCompletedAt: employers.onboardingCompletedAt,
      ndpaConsentGiven: employers.ndpaConsentGiven,
      createdAt: employers.createdAt,
      email: users.email,
      fullName: users.fullName,
      activeSubscriptionId: sql<string | null>`(
        SELECT s.id FROM subscriptions s
        WHERE s.employer_id = ${employers.id} AND s.status = 'ACTIVE'
        ORDER BY s.created_at DESC LIMIT 1
      )`,
    })
    .from(employers)
    .innerJoin(users, eq(users.id, employers.userId))
    .innerJoin(employerTypes, eq(employerTypes.id, employers.employerTypeId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(employers.createdAt))
    .limit(filters.limit)
    .offset(offset);

  let filtered = rows;
  if (typeof filters.hasSubscription === 'boolean') {
    filtered = filtered.filter((r) =>
      filters.hasSubscription ? !!r.activeSubscriptionId : !r.activeSubscriptionId,
    );
  }
  if (typeof filters.onboarded === 'boolean') {
    filtered = filtered.filter((r) =>
      filters.onboarded ? !!r.onboardingCompletedAt : !r.onboardingCompletedAt,
    );
  }

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(employers)
    .where(conds.length ? and(...conds) : undefined);

  return { rows: filtered, total: countRows[0]?.count ?? 0 };
}

// re-export for convenience
export { subscriptions };
