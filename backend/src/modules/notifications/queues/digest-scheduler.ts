import { Worker } from 'bullmq';
import { and, eq, inArray } from 'drizzle-orm';
import { loadEnv } from '@/shared/config/env.js';
import { logger } from '@/shared/logger/logger.js';
import { queues } from '@/shared/queue/queues.js';
import { db } from '@/shared/db/client.js';
import { notificationLog, notificationPreferences, users } from '@/shared/db/schema.js';
import { sendEmail } from '../resend/client.js';
import { groupForDigest, renderDigestEmail, type DigestableRow } from '../digest.js';

export async function runDigestSweep(): Promise<{ usersProcessed: number; sent: number }> {
  // Find all users with at least one daily-email preference
  const dailyPrefs = await db
    .select({ userId: notificationPreferences.userId })
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.channel, 'EMAIL'),
        eq(notificationPreferences.digestMode, 'daily'),
      ),
    );
  const userIds = [...new Set(dailyPrefs.map((p) => p.userId))];
  let usersProcessed = 0;
  let sent = 0;

  for (const userId of userIds) {
    const pendingRows = await db
      .select({
        id: notificationLog.id,
        kind: notificationLog.kind,
        subject: notificationLog.subject,
        createdAt: notificationLog.createdAt,
      })
      .from(notificationLog)
      .where(
        and(
          eq(notificationLog.userId, userId),
          eq(notificationLog.channel, 'EMAIL'),
          eq(notificationLog.status, 'PENDING'),
        ),
      );
    if (pendingRows.length === 0) continue;

    // Filter to only rows whose (kind,EMAIL) is set to daily
    const dailyByKindRows = await db
      .select({ kind: notificationPreferences.kind })
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.userId, userId),
          eq(notificationPreferences.channel, 'EMAIL'),
          eq(notificationPreferences.digestMode, 'daily'),
        ),
      );
    const dailyKinds = new Set(dailyByKindRows.map((r) => r.kind));
    const eligible = pendingRows.filter((r) => dailyKinds.has(r.kind));
    if (eligible.length === 0) continue;

    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) continue;
    const groups = groupForDigest(eligible as DigestableRow[]);
    const tpl = renderDigestEmail(groups);
    try {
      const res = await sendEmail({
        to: user.email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
      });
      await db
        .update(notificationLog)
        .set({ status: 'SENT', sentAt: new Date(), providerMessageId: res.id })
        .where(inArray(notificationLog.id, eligible.map((r) => r.id)));
      sent += eligible.length;
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'digest send failed';
      await db
        .update(notificationLog)
        .set({ status: 'FAILED', failureReason: reason })
        .where(inArray(notificationLog.id, eligible.map((r) => r.id)));
      logger.warn({ err, userId }, 'digest send failed');
    }
    usersProcessed += 1;
  }
  return { usersProcessed, sent };
}

export async function registerDigestScheduler() {
  await queues.digest.upsertJobScheduler('digest-daily', { pattern: '0 7 * * *' }, {
    name: 'sweep',
    data: {},
  });
}

export function startDigestWorker() {
  const env = loadEnv();
  const worker = new Worker(
    'digest',
    async () => {
      const result = await runDigestSweep();
      logger.info(result, 'digest sweep complete');
    },
    { connection: { url: env.REDIS_URL }, concurrency: 1 },
  );
  worker.on('failed', (job, err) => {
    logger.warn({ jobId: job?.id, err }, 'digest worker failed');
  });
  return worker;
}
