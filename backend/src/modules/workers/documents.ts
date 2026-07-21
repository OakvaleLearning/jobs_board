import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import {
  certifications,
  cpdRecords,
  workerDocuments,
  workerEducation,
  workerExperience,
  workerIdentityDocs,
  workerProfileExtras,
  workerReferences,
} from '@/shared/db/schema.js';
import { recomputeCompletion } from './service.js';
import { storage } from '@/shared/storage/r2.js';
import { queues } from '@/shared/queue/queues.js';
import { AppError } from '@/shared/errors/app-error.js';
import {
  ACCEPTED_MIMES_BY_CATEGORY,
  MAX_FILE_BYTES,
  type DocumentCategory,
} from '@oakvale/shared/enums/worker.js';

export interface IssueUploadInput {
  workerId: string;
  category: DocumentCategory;
  mimeType: string;
  sizeBytes: number;
  originalFilename: string;
}

export async function issueUploadUrl(input: IssueUploadInput) {
  const accepted = ACCEPTED_MIMES_BY_CATEGORY[input.category];
  if (!accepted.includes(input.mimeType)) {
    throw new AppError({
      code: 'UNSUPPORTED_MEDIA_TYPE',
      message: `Mime type ${input.mimeType} is not allowed for ${input.category}.`,
      statusCode: 415,
      details: { accepted },
    });
  }
  if (input.sizeBytes <= 0 || input.sizeBytes > MAX_FILE_BYTES) {
    throw new AppError({
      code: 'VALIDATION_ERROR',
      message: `File size must be between 1 byte and ${MAX_FILE_BYTES} bytes.`,
      statusCode: 400,
    });
  }

  const documentId = randomUUID();
  const storageKey = `workers/${input.workerId}/${input.category.toLowerCase()}/${documentId}`;

  await db.insert(workerDocuments).values({
    id: documentId,
    workerId: input.workerId,
    category: input.category,
    storageKey,
    originalFilename: input.originalFilename,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    status: 'UPLOADING',
  });

  const uploadUrl = await storage.getPutUrl(storageKey, input.mimeType, input.sizeBytes);
  return { documentId, storageKey, uploadUrl, expiresIn: 900 };
}

export async function confirmUpload(workerId: string, documentId: string) {
  const doc = await db.query.workerDocuments.findFirst({
    where: and(eq(workerDocuments.id, documentId), eq(workerDocuments.workerId, workerId)),
  });
  if (!doc) {
    throw new AppError({ code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.', statusCode: 404 });
  }
  await db.update(workerDocuments).set({ status: 'SCANNING' }).where(eq(workerDocuments.id, documentId));
  await queues.documentProcessing.add('scan', { documentId }, { jobId: `scan-${documentId}` });
  return { documentId, status: 'SCANNING' as const };
}

export async function getDocumentForOwnerOrStaff(documentId: string, opts: { workerId?: string; staff?: boolean }) {
  const doc = await db.query.workerDocuments.findFirst({
    where: eq(workerDocuments.id, documentId),
  });
  if (!doc) throw new AppError({ code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.', statusCode: 404 });
  if (!opts.staff && doc.workerId !== opts.workerId) {
    throw new AppError({ code: 'FORBIDDEN', message: 'You do not own this document.', statusCode: 403 });
  }
  const url = await storage.getGetUrl(doc.storageKey);
  return { document: doc, downloadUrl: url };
}

export async function listDocuments(workerId: string) {
  return db.select().from(workerDocuments).where(eq(workerDocuments.workerId, workerId));
}

export async function deleteDocument(workerId: string, documentId: string) {
  const doc = await db.query.workerDocuments.findFirst({
    where: and(eq(workerDocuments.id, documentId), eq(workerDocuments.workerId, workerId)),
  });
  if (!doc) {
    throw new AppError({ code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.', statusCode: 404 });
  }

  if (storage.isConfigured()) await storage.deleteObject(doc.storageKey).catch(() => null);

  // No FK constraints point at worker_documents — null out the references by hand
  await db
    .update(workerIdentityDocs)
    .set({ idDocumentId: null })
    .where(eq(workerIdentityDocs.idDocumentId, documentId));
  await db
    .update(workerIdentityDocs)
    .set({ selfieId: null })
    .where(eq(workerIdentityDocs.selfieId, documentId));
  await db
    .update(workerIdentityDocs)
    .set({ proofOfAddressId: null })
    .where(eq(workerIdentityDocs.proofOfAddressId, documentId));
  await db
    .update(workerProfileExtras)
    .set({ videoIntroDocumentId: null })
    .where(eq(workerProfileExtras.videoIntroDocumentId, documentId));
  await db
    .update(workerEducation)
    .set({ certificateDocumentId: null })
    .where(eq(workerEducation.certificateDocumentId, documentId));
  await db
    .update(workerExperience)
    .set({ letterDocumentId: null })
    .where(eq(workerExperience.letterDocumentId, documentId));
  await db
    .update(workerReferences)
    .set({ letterDocumentId: null })
    .where(eq(workerReferences.letterDocumentId, documentId));
  await db
    .update(cpdRecords)
    .set({ certificateDocumentId: null })
    .where(eq(cpdRecords.certificateDocumentId, documentId));
  await db
    .update(certifications)
    .set({ certificateDocumentId: null })
    .where(eq(certifications.certificateDocumentId, documentId));

  await db.delete(workerDocuments).where(eq(workerDocuments.id, documentId));

  const profileCompletionPct = await recomputeCompletion(workerId);
  return { deleted: true as const, profileCompletionPct };
}
