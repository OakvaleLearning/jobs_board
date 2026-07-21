import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import { employerDocuments } from '@/shared/db/schema.js';
import { storage } from '@/shared/storage/r2.js';
import { queues } from '@/shared/queue/queues.js';
import { AppError } from '@/shared/errors/app-error.js';
import {
  EMPLOYER_ACCEPTED_MIMES_BY_CATEGORY,
  type EmployerDocumentCategory,
} from '@oakvale/shared/enums/employer.js';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export interface IssueEmployerUploadInput {
  employerId: string;
  category: EmployerDocumentCategory;
  mimeType: string;
  sizeBytes: number;
  originalFilename: string;
}

export async function issueEmployerUploadUrl(input: IssueEmployerUploadInput) {
  const accepted = EMPLOYER_ACCEPTED_MIMES_BY_CATEGORY[input.category];
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
  const storageKey = `employers/${input.employerId}/${input.category.toLowerCase()}/${documentId}`;

  await db.insert(employerDocuments).values({
    id: documentId,
    employerId: input.employerId,
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

export async function confirmEmployerUpload(employerId: string, documentId: string) {
  const doc = await db.query.employerDocuments.findFirst({
    where: and(eq(employerDocuments.id, documentId), eq(employerDocuments.employerId, employerId)),
  });
  if (!doc) {
    throw new AppError({ code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.', statusCode: 404 });
  }
  await db.update(employerDocuments).set({ status: 'SCANNING' }).where(eq(employerDocuments.id, documentId));
  await queues.documentProcessing.add(
    'scan',
    { documentId, kind: 'employer' },
    { jobId: `scan-employer-${documentId}` },
  );
  return { documentId, status: 'SCANNING' as const };
}

export async function listEmployerDocuments(employerId: string) {
  return db.select().from(employerDocuments).where(eq(employerDocuments.employerId, employerId));
}

/** Staff-facing: document + a signed download URL (used by the admin review screen). */
export async function getEmployerDocumentForStaff(documentId: string) {
  const doc = await db.query.employerDocuments.findFirst({
    where: eq(employerDocuments.id, documentId),
  });
  if (!doc) throw new AppError({ code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.', statusCode: 404 });
  const downloadUrl = await storage.getGetUrl(doc.storageKey);
  return { document: doc, downloadUrl };
}
