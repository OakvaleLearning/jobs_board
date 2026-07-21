import { and, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import { adminAuditLog } from '@/shared/db/schema.js';

export interface AuditFilters {
  action?: string;
  actorId?: string;
  targetType?: string;
  targetId?: string;
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
}

export async function listAudit(filters: AuditFilters) {
  const conds: SQL[] = [];
  if (filters.action) conds.push(eq(adminAuditLog.action, filters.action));
  if (filters.actorId) conds.push(eq(adminAuditLog.actorId, filters.actorId));
  if (filters.targetType) conds.push(eq(adminAuditLog.targetType, filters.targetType));
  if (filters.targetId) conds.push(eq(adminAuditLog.targetId, filters.targetId));
  if (filters.from) conds.push(gte(adminAuditLog.occurredAt, filters.from));
  if (filters.to) conds.push(lte(adminAuditLog.occurredAt, filters.to));

  const where = conds.length ? and(...conds) : undefined;
  const offset = (filters.page - 1) * filters.limit;

  const rows = await db
    .select()
    .from(adminAuditLog)
    .where(where)
    .orderBy(desc(adminAuditLog.occurredAt))
    .limit(filters.limit)
    .offset(offset);

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(adminAuditLog)
    .where(where);

  return { rows, total: countRows[0]?.count ?? 0 };
}
