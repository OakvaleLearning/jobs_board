import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import { notificationLog, users, type NotificationLog } from '@/shared/db/schema.js';
import { AppError } from '@/shared/errors/app-error.js';
import { queues } from '@/shared/queue/queues.js';
import { logger } from '@/shared/logger/logger.js';
import type {
  NotificationChannel,
  NotificationKind,
} from '@oakvale/shared/enums/notifications.js';
import type { TemplatePayload } from './templates.js';
import { loadDigestMode, loadDisabledMap, shouldEnqueue } from './preferences.js';

export interface EnqueueInput {
  userId: string;
  kind: NotificationKind;
  channel: NotificationChannel;
  payload: TemplatePayload;
  idempotencyKey?: string;
  attachments?: { filename: string; contentBase64: string }[];
}

export const ATTACHMENTS_PAYLOAD_KEY = '__attachments';

export async function enqueue(input: EnqueueInput): Promise<NotificationLog | null> {
  const disabled = await loadDisabledMap(input.userId);
  if (!shouldEnqueue(input.kind, input.channel, disabled)) {
    logger.debug(
      { userId: input.userId, kind: input.kind, channel: input.channel },
      'notification skipped by user preference',
    );
    return null;
  }
  if (input.idempotencyKey) {
    const existing = await db.query.notificationLog.findFirst({
      where: and(
        eq(notificationLog.userId, input.userId),
        eq(notificationLog.idempotencyKey, input.idempotencyKey),
      ),
    });
    if (existing) {
      logger.debug({ id: existing.id, idempotencyKey: input.idempotencyKey }, 'notification skipped (idempotent)');
      return null;
    }
  }
  const persistedPayload: Record<string, unknown> = {
    ...(input.payload as Record<string, unknown>),
  };
  if (input.attachments && input.attachments.length > 0) {
    persistedPayload[ATTACHMENTS_PAYLOAD_KEY] = input.attachments;
  }
  const [row] = await db
    .insert(notificationLog)
    .values({
      userId: input.userId,
      kind: input.kind,
      channel: input.channel,
      payload: persistedPayload,
      idempotencyKey: input.idempotencyKey ?? null,
    })
    .returning();
  if (!row) {
    throw new AppError({ code: 'INTERNAL_ERROR', message: 'Failed to write notification.', statusCode: 500 });
  }
  // Digest path: EMAIL + daily → leave PENDING for the digest scheduler
  if (input.channel === 'EMAIL') {
    const digest = await loadDigestMode(input.userId, input.kind, input.channel);
    if (digest === 'daily') {
      return row;
    }
  }
  await queues.notifications.add(input.kind, { notificationId: row.id });
  return row;
}

export async function enqueueForRole(
  role: 'ADMIN' | 'AGENT',
  input: Omit<EnqueueInput, 'userId'>,
): Promise<void> {
  const recipients = await db.select({ id: users.id }).from(users).where(eq(users.role, role));
  for (const r of recipients) {
    await enqueue({ ...input, userId: r.id });
  }
}

export async function listForUser(
  userId: string,
  opts: { unreadOnly?: boolean; page: number; limit: number },
) {
  const conds = [eq(notificationLog.userId, userId)] as Array<ReturnType<typeof eq>>;
  if (opts.unreadOnly) {
    conds.push(sql`status <> 'READ'` as unknown as ReturnType<typeof eq>);
  }
  const offset = (opts.page - 1) * opts.limit;
  const rows = await db
    .select()
    .from(notificationLog)
    .where(and(...conds))
    .orderBy(desc(notificationLog.createdAt))
    .limit(opts.limit)
    .offset(offset);
  const countRows = await db
    .select({ count: count() })
    .from(notificationLog)
    .where(and(...conds));
  return { rows, total: Number(countRows[0]?.count ?? 0) };
}

export async function unreadCount(userId: string): Promise<number> {
  const rows = await db
    .select({ count: count() })
    .from(notificationLog)
    .where(
      and(
        eq(notificationLog.userId, userId),
        sql`status IN ('SENT','PENDING')`,
        sql`read_at IS NULL`,
      ),
    );
  return Number(rows[0]?.count ?? 0);
}

export async function markRead(ids: string[], viewerUserId: string): Promise<void> {
  await db
    .update(notificationLog)
    .set({ readAt: new Date(), status: 'READ' })
    .where(and(inArray(notificationLog.id, ids), eq(notificationLog.userId, viewerUserId)));
}

export async function markAllRead(viewerUserId: string): Promise<void> {
  await db
    .update(notificationLog)
    .set({ readAt: new Date(), status: 'READ' })
    .where(and(eq(notificationLog.userId, viewerUserId), sql`read_at IS NULL`));
}

export async function getByIdOrThrow(id: string): Promise<NotificationLog> {
  const row = await db.query.notificationLog.findFirst({ where: eq(notificationLog.id, id) });
  if (!row) {
    throw new AppError({ code: 'NOTIFICATION_NOT_FOUND', message: 'Notification not found.', statusCode: 404 });
  }
  return row;
}

export async function markSent(id: string, providerMessageId: string): Promise<void> {
  await db
    .update(notificationLog)
    .set({ status: 'SENT', sentAt: new Date(), providerMessageId })
    .where(eq(notificationLog.id, id));
}

export async function markFailed(id: string, reason: string): Promise<void> {
  await db
    .update(notificationLog)
    .set({ status: 'FAILED', failureReason: reason })
    .where(eq(notificationLog.id, id));
}
