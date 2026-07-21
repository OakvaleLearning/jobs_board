import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import {
  conversations,
  employers,
  messages,
  shortlists,
  workers,
} from '@/shared/db/schema.js';
import { AppError } from '@/shared/errors/app-error.js';
import { events } from '@/shared/events/bus.js';
import { recordAudit } from '@/shared/audit/record.js';
import { checkContactLeaks } from './contact-leak-filter.js';

async function getOrThrow(conversationId: string) {
  const row = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
  });
  if (!row) {
    throw new AppError({
      code: 'CONVERSATION_NOT_FOUND',
      message: 'Conversation not found',
      statusCode: 404,
    });
  }
  return row;
}

async function resolveEmployerAndWorker(userId: string, role: string) {
  if (role.startsWith('EMPLOYER')) {
    const employer = await db.query.employers.findFirst({ where: eq(employers.userId, userId) });
    return { employer, worker: null as null };
  }
  if (role === 'WORKER') {
    const worker = await db.query.workers.findFirst({ where: eq(workers.userId, userId) });
    return { employer: null, worker };
  }
  return { employer: null, worker: null };
}

export async function openOrGetConversation(
  shortlistId: string,
  workerId: string,
  initiatorUserId: string,
) {
  const sl = await db.query.shortlists.findFirst({ where: eq(shortlists.id, shortlistId) });
  if (!sl) {
    throw new AppError({
      code: 'SHORTLIST_NOT_FOUND',
      message: 'Shortlist not found',
      statusCode: 404,
    });
  }
  const existing = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.shortlistId, shortlistId),
      eq(conversations.workerId, workerId),
    ),
  });
  if (existing) return existing;
  const [row] = await db
    .insert(conversations)
    .values({
      shortlistId,
      employerId: sl.employerId,
      workerId,
    })
    .returning();
  if (!row) {
    throw new AppError({ code: 'INTERNAL_ERROR', message: 'Failed to open conversation.', statusCode: 500 });
  }
  await recordAudit({
    actorId: initiatorUserId,
    action: 'conversation.opened',
    targetType: 'conversation',
    targetId: row.id,
    metadata: { shortlistId, workerId },
  });
  return row;
}

export async function sendMessage(conversationId: string, senderUserId: string, body: string) {
  const conv = await getOrThrow(conversationId);
  if (conv.status === 'LOCKED') {
    throw new AppError({
      code: 'MESSAGE_NOT_VIEWABLE',
      message: 'Conversation is locked',
      statusCode: 409,
    });
  }
  const filter = checkContactLeaks(body);

  // Hard block: a message containing contact details is rejected and never delivered. The attempt is
  // still persisted (blocked, agent-visible via the flagged queue) and audited, then the send is refused.
  if (filter.flagged) {
    const [blocked] = await db
      .insert(messages)
      .values({
        conversationId,
        senderUserId,
        body,
        flaggedForReview: true,
        flaggedReasons: filter.reasons,
        redactedBody: filter.redacted,
        blockedAt: new Date(),
      })
      .returning();
    if (blocked) {
      events.emit('message.flagged', {
        messageId: blocked.id,
        conversationId,
        senderUserId,
        reasons: filter.reasons,
      });
    }
    await recordAudit({
      actorId: senderUserId,
      action: 'message.contact_blocked',
      targetType: 'conversation',
      targetId: conversationId,
      metadata: { reasons: filter.reasons },
    });
    throw new AppError({
      code: 'CONTACT_DETAILS_BLOCKED',
      message:
        "Your message wasn't sent because it contains contact details. Remove them and try again — " +
        'all contact stays on the platform until a contract is signed.',
      statusCode: 422,
      details: { reasons: filter.reasons },
    });
  }

  const [row] = await db
    .insert(messages)
    .values({
      conversationId,
      senderUserId,
      body,
    })
    .returning();
  if (!row) {
    throw new AppError({ code: 'INTERNAL_ERROR', message: 'Failed to send message.', statusCode: 500 });
  }

  await db
    .update(conversations)
    .set({ lastMessageAt: new Date() })
    .where(eq(conversations.id, conversationId));

  events.emit('message.sent', { messageId: row.id, conversationId, senderUserId });
  return row;
}

export async function listMessages(conversationId: string, viewerUserId: string) {
  const rows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), isNull(messages.blockedAt)))
    .orderBy(messages.createdAt);
  // Mask flagged messages for non-senders until reviewed
  return rows.map((m) => {
    if (
      m.flaggedForReview &&
      !m.reviewedAt &&
      m.senderUserId !== viewerUserId
    ) {
      return { ...m, body: m.redactedBody ?? '[redacted]' };
    }
    return m;
  });
}

export async function listForUser(userId: string, role: string) {
  const { employer, worker } = await resolveEmployerAndWorker(userId, role);
  if (employer) {
    return db
      .select()
      .from(conversations)
      .where(eq(conversations.employerId, employer.id))
      .orderBy(desc(conversations.lastMessageAt));
  }
  if (worker) {
    return db
      .select()
      .from(conversations)
      .where(eq(conversations.workerId, worker.id))
      .orderBy(desc(conversations.lastMessageAt));
  }
  return [];
}

export async function listFlagged(opts: { page: number; limit: number }) {
  const offset = (opts.page - 1) * opts.limit;
  const rows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.flaggedForReview, true), sql`${messages.reviewedAt} IS NULL`))
    .orderBy(desc(messages.createdAt))
    .limit(opts.limit)
    .offset(offset);
  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messages)
    .where(and(eq(messages.flaggedForReview, true), sql`${messages.reviewedAt} IS NULL`));
  return { data: rows, meta: { total: countRows[0]?.count ?? 0, page: opts.page, limit: opts.limit } };
}

export async function releaseMessage(messageId: string, agentId: string) {
  const [row] = await db
    .update(messages)
    .set({ reviewedByAgentId: agentId, reviewedAt: new Date() })
    .where(eq(messages.id, messageId))
    .returning();
  await recordAudit({
    actorId: agentId,
    action: 'message.released',
    targetType: 'message',
    targetId: messageId,
  });
  return row;
}

export async function lockConversation(conversationId: string, agentId: string) {
  const [row] = await db
    .update(conversations)
    .set({ status: 'LOCKED' })
    .where(eq(conversations.id, conversationId))
    .returning();
  await recordAudit({
    actorId: agentId,
    action: 'conversation.locked',
    targetType: 'conversation',
    targetId: conversationId,
  });
  return row;
}
