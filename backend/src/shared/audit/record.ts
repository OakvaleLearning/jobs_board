import { db } from '@/shared/db/client.js';
import { adminAuditLog } from '@/shared/db/schema.js';
import { logger } from '@/shared/logger/logger.js';

export interface AuditEntry {
  actorId: string | null;
  actorRole?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Best-effort audit log writer. Never throws — a failed audit write must not
 * abort the caller's mutation. The caller's normal flow is the source of
 * truth; the audit log is a defense-in-depth record.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(adminAuditLog).values({
      actorId: entry.actorId,
      actorRole: entry.actorRole ?? null,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      metadata: (entry.metadata ?? null) as Record<string, unknown> | null,
    });
  } catch (err) {
    logger.warn({ err, action: entry.action }, 'audit log write failed');
  }
}
