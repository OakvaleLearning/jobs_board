import { and, eq } from 'drizzle-orm';
import { db } from '../shared/db/client.js';
import { workerDocuments } from '../shared/db/schema.js';
import { storage } from '../shared/storage/r2.js';
import { blurredKeyFor } from '../modules/workers/selfie.js';
import { generateSelfieBlur } from '../modules/workers/queues/document-processing.js';
import { loadEnv } from '../shared/config/env.js';
import { logger } from '../shared/logger/logger.js';

/**
 * One-off backfill: generate the `-blur` variant for every CLEAN worker SELFIE
 * uploaded before server-side blur existed. Idempotent — skips selfies whose blur
 * object is already present. Run inside the backend container (see memory:
 * run-migrations-in-container): `npm run backfill:selfie-blur`.
 */
async function main(): Promise<void> {
  loadEnv();
  if (!storage.isConfigured()) {
    logger.error('R2/S3 not configured; cannot backfill selfie blurs.');
    process.exit(1);
  }

  const selfies = await db
    .select({ id: workerDocuments.id, storageKey: workerDocuments.storageKey })
    .from(workerDocuments)
    .where(and(eq(workerDocuments.category, 'SELFIE'), eq(workerDocuments.status, 'CLEAN')));

  let generated = 0;
  let skipped = 0;
  let failed = 0;
  for (const doc of selfies) {
    try {
      const exists = await storage.headObject(blurredKeyFor(doc.storageKey));
      if (exists) {
        skipped += 1;
        continue;
      }
      await generateSelfieBlur(doc.storageKey);
      generated += 1;
      logger.info({ documentId: doc.id }, 'backfill: selfie blur generated');
    } catch (err) {
      failed += 1;
      logger.warn({ err, documentId: doc.id }, 'backfill: selfie blur failed');
    }
  }

  logger.info({ total: selfies.length, generated, skipped, failed }, 'selfie blur backfill complete');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error: unknown) => {
  logger.error({ err: error }, 'Failed to backfill selfie blurs');
  process.exit(1);
});
