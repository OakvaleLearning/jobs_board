import { Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import { employerDocuments, workerDocuments } from '@/shared/db/schema.js';
import { storage } from '@/shared/storage/r2.js';
import { blurredKeyFor } from '@/modules/workers/selfie.js';
import { loadEnv } from '@/shared/config/env.js';
import { logger } from '@/shared/logger/logger.js';

const env = loadEnv();

type ScanResult = 'CLEAN' | 'INFECTED';
type DocKind = 'worker' | 'employer';

async function scanDocument(filename: string): Promise<ScanResult> {
  // Deterministic stub. Real ClamAV integration lands in Phase 9.
  return filename.includes('__infected_test__') ? 'INFECTED' : 'CLEAN';
}

/**
 * Produce a downsized, heavily-blurred JPEG variant of a worker selfie and store
 * it alongside the original at `${storageKey}-blur`. Browse serves this variant to
 * employers who have not yet unlocked the worker, so the original bytes never leave
 * the server (CSS blur alone would be reversible). Best-effort: a failure here must
 * never fail the virus scan, so callers swallow the error.
 */
export async function generateSelfieBlur(storageKey: string): Promise<void> {
  if (!storage.isConfigured()) return;
  // Lazy import: selfie blur is non-critical, so a missing/broken native `sharp`
  // binary must never crash the API at boot — callers swallow the resulting error.
  const sharp = (await import('sharp')).default;
  const original = await storage.getObjectBuffer(storageKey);
  const blurred = await sharp(original)
    .rotate()
    .resize(400, 400, { fit: 'cover' })
    .blur(18)
    .jpeg({ quality: 60 })
    .toBuffer();
  await storage.putObject(blurredKeyFor(storageKey), blurred, 'image/jpeg');
}

export function startDocumentProcessingWorker(): Worker {
  return new Worker(
    'document-processing',
    async (job) => {
      const { documentId, kind = 'worker' } = job.data as { documentId: string; kind?: DocKind };
      const table = kind === 'employer' ? employerDocuments : workerDocuments;
      const doc =
        kind === 'employer'
          ? await db.query.employerDocuments.findFirst({ where: eq(employerDocuments.id, documentId) })
          : await db.query.workerDocuments.findFirst({ where: eq(workerDocuments.id, documentId) });
      if (!doc) {
        logger.warn({ documentId, kind }, 'document-processing: missing document row');
        return;
      }
      const result = await scanDocument(doc.originalFilename);
      if (result === 'INFECTED') {
        if (storage.isConfigured()) await storage.deleteObject(doc.storageKey).catch(() => null);
        await db
          .update(table)
          .set({ status: 'INFECTED', scannedAt: new Date(), rejectionReason: 'Malware signature detected' })
          .where(eq(table.id, documentId));
        logger.warn({ documentId, kind }, 'document-processing: INFECTED, object deleted');
        return;
      }
      await db
        .update(table)
        .set({ status: 'CLEAN', scannedAt: new Date() })
        .where(eq(table.id, documentId));
      logger.info({ documentId, kind }, 'document-processing: CLEAN');

      if (kind === 'worker' && doc.category === 'SELFIE') {
        try {
          await generateSelfieBlur(doc.storageKey);
          logger.info({ documentId }, 'document-processing: selfie blur generated');
        } catch (err) {
          logger.warn({ err, documentId }, 'document-processing: selfie blur failed');
        }
      }
    },
    { connection: { url: env.REDIS_URL }, concurrency: 2 },
  );
}
