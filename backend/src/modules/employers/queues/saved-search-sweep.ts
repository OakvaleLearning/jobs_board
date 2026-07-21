import { Worker } from 'bullmq';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import { employers, savedSearchMatches } from '@/shared/db/schema.js';
import { queues } from '@/shared/queue/queues.js';
import { loadEnv } from '@/shared/config/env.js';
import { logger } from '@/shared/logger/logger.js';
import { events } from '@/shared/events/bus.js';
import * as notifications from '@/modules/notifications/service.js';
import * as workersService from '@/modules/workers/service.js';
import * as savedSearchesService from '../saved-searches.js';

const env = loadEnv();
const SCHEDULER_ID = 'saved-search-sweep';
const DAILY_CRON = '0 9 * * *';
const PAGE_SIZE = 100;
const MAX_HIGHLIGHTED_PER_EMAIL = 25;

export async function registerSavedSearchSweepScheduler(): Promise<void> {
  await queues.savedSearchSweep.upsertJobScheduler(
    SCHEDULER_ID,
    { pattern: DAILY_CRON },
    { name: 'saved-search-sweep', data: {} },
  );
  logger.info({ schedulerId: SCHEDULER_ID }, 'saved-search sweep scheduler registered');
}

interface SweepStats {
  searchesScanned: number;
  newMatchesTotal: number;
  emailsSent: number;
}

export async function runSavedSearchSweep(): Promise<SweepStats> {
  const alerting = await savedSearchesService.listAlerting();
  let newMatchesTotal = 0;
  let emailsSent = 0;

  for (const search of alerting) {
    const filters = (search.filters as Record<string, unknown>) ?? {};
    const result = await workersService.search({
      ...(filters as Record<string, unknown>),
      page: 1,
      limit: PAGE_SIZE,
      applyVisibilityGate: true,
    } as Parameters<typeof workersService.search>[0]);

    const matchedIds = result.rows.map((r) => r.id);
    if (matchedIds.length === 0) continue;

    const already = await db
      .select({ workerId: savedSearchMatches.workerId })
      .from(savedSearchMatches)
      .where(
        and(
          eq(savedSearchMatches.savedSearchId, search.id),
          inArray(savedSearchMatches.workerId, matchedIds),
        ),
      );
    const alreadySet = new Set(already.map((r) => r.workerId));
    const newWorkerIds = matchedIds.filter((id) => !alreadySet.has(id));
    if (newWorkerIds.length === 0) continue;

    await db
      .insert(savedSearchMatches)
      .values(newWorkerIds.map((id) => ({ savedSearchId: search.id, workerId: id })))
      .onConflictDoNothing();

    const employer = await db.query.employers.findFirst({
      where: eq(employers.id, search.employerId),
    });
    if (!employer) continue;

    await notifications.enqueue({
      userId: employer.userId,
      kind: 'saved_search_new_matches',
      channel: 'EMAIL',
      payload: {
        savedSearchId: search.id,
        savedSearchName: search.name,
        totalNew: newWorkerIds.length,
        highlighted: Math.min(newWorkerIds.length, MAX_HIGHLIGHTED_PER_EMAIL),
      },
      idempotencyKey: `saved-search-${search.id}-${new Date().toISOString().slice(0, 10)}`,
    });
    await db
      .update(savedSearchMatches)
      .set({ notifiedAt: new Date() })
      .where(
        and(
          eq(savedSearchMatches.savedSearchId, search.id),
          inArray(savedSearchMatches.workerId, newWorkerIds),
        ),
      );

    events.emit('savedSearch.matchesFound', {
      savedSearchId: search.id,
      employerId: search.employerId,
      newWorkerIds,
    });

    newMatchesTotal += newWorkerIds.length;
    emailsSent += 1;
  }

  return { searchesScanned: alerting.length, newMatchesTotal, emailsSent };
}

export function startSavedSearchSweepWorker(): Worker {
  return new Worker(
    'saved-search-sweep',
    async () => {
      const stats = await runSavedSearchSweep();
      logger.info(stats, 'saved-search sweep complete');
    },
    { connection: { url: env.REDIS_URL }, concurrency: 1 },
  );
}
