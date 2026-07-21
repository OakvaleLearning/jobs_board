import { Worker } from 'bullmq';
import { loadEnv } from '@/shared/config/env.js';
import { logger } from '@/shared/logger/logger.js';
import { events } from '@/shared/events/bus.js';
import { db } from '@/shared/db/client.js';
import { notificationLog, users } from '@/shared/db/schema.js';
import { eq } from 'drizzle-orm';
import { type TemplatePayload } from '../templates.js';
import { renderForDispatch } from '../template-store.js';
import { sendEmail } from '../resend/client.js';
import { sendSms } from '../termii/client.js';
import * as notifications from '../service.js';
import { ATTACHMENTS_PAYLOAD_KEY } from '../service.js';
import type { NotificationKind } from '@oakvale/shared/enums/notifications.js';

function extractAttachments(
  payload: Record<string, unknown> | null | undefined,
): { filename: string; content: Buffer }[] | undefined {
  const raw = payload?.[ATTACHMENTS_PAYLOAD_KEY];
  if (!Array.isArray(raw)) return undefined;
  const out: { filename: string; content: Buffer }[] = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === 'object' &&
      typeof (item as { filename?: unknown }).filename === 'string' &&
      typeof (item as { contentBase64?: unknown }).contentBase64 === 'string'
    ) {
      const att = item as { filename: string; contentBase64: string };
      out.push({ filename: att.filename, content: Buffer.from(att.contentBase64, 'base64') });
    }
  }
  return out.length > 0 ? out : undefined;
}

export function startNotificationsWorker() {
  const env = loadEnv();
  const worker = new Worker(
    'notifications',
    async (job) => {
      const { notificationId } = job.data as { notificationId: string };
      if (!notificationId) {
        logger.warn({ data: job.data }, 'notifications-worker: missing notificationId');
        return;
      }
      const row = await db.query.notificationLog.findFirst({
        where: eq(notificationLog.id, notificationId),
      });
      if (!row) {
        logger.warn({ notificationId }, 'notifications-worker: row not found');
        return;
      }
      const user = await db.query.users.findFirst({ where: eq(users.id, row.userId) });
      if (!user) {
        await notifications.markFailed(row.id, 'recipient not found');
        return;
      }
      const tpl = await renderForDispatch(row.kind as NotificationKind, (row.payload as TemplatePayload) ?? {});
      await db
        .update(notificationLog)
        .set({ subject: tpl.subject, body: row.channel === 'SMS' ? tpl.sms : tpl.text })
        .where(eq(notificationLog.id, row.id));
      try {
        let providerId = `in-app-${row.id}`;
        if (row.channel === 'EMAIL') {
          const attachments = extractAttachments(row.payload as Record<string, unknown> | null);
          const res = await sendEmail({
            to: user.email,
            subject: tpl.subject,
            html: tpl.html,
            text: tpl.text,
            attachments,
          });
          providerId = res.id;
        } else if (row.channel === 'SMS') {
          const phone = user.phone;
          if (!phone) {
            await notifications.markFailed(row.id, 'recipient has no phone');
            events.emit('notification.failed', { notificationId: row.id, userId: row.userId, kind: row.kind, reason: 'no phone' });
            return;
          }
          const res = await sendSms({ to: phone, body: tpl.sms });
          providerId = res.id;
        }
        await notifications.markSent(row.id, providerId);
        events.emit('notification.sent', { notificationId: row.id, userId: row.userId, kind: row.kind });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'send failed';
        await notifications.markFailed(row.id, msg);
        events.emit('notification.failed', { notificationId: row.id, userId: row.userId, kind: row.kind, reason: msg });
        throw err;
      }
    },
    { connection: { url: env.REDIS_URL }, concurrency: 2 },
  );
  worker.on('failed', (job, err) => {
    logger.warn({ jobId: job?.id, err }, 'notifications worker failed');
  });
  return worker;
}
