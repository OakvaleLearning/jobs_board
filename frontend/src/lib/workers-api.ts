'use client';

import { api } from './api-client';
import type {
  DocumentCategory,
  DocumentStatus,
} from '@oakvale/shared/enums/worker';
import type { WorkerSection } from '@oakvale/shared/enums/worker';

export interface WorkerDocument {
  id: string;
  workerId: string;
  category: DocumentCategory;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  scannedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkerProfile {
  id: string;
  userId: string;
  visibilityStatus: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  profileCompletionPct: number;
  workforceCategoryId: string | null;
  submittedAt: string | null;
  sections: Record<WorkerSection, unknown>;
}

export const workersApi = {
  getProfile: () => api.get<{ data: WorkerProfile }>('/workers/me').then((r) => r.data),
  getCompletion: () =>
    api
      .get<{ data: { profileCompletionPct: number } }>('/workers/me/completion')
      .then((r) => r.data.profileCompletionPct),
  patchSection: (section: WorkerSection, body: unknown) =>
    api
      .patch<{ data: { profileCompletionPct: number } }>(
        `/workers/me/sections/${section}`,
        body as Record<string, unknown>,
      )
      .then((r) => r.data),
  submit: () => api.post<{ data: { submitted: true } }>('/workers/me/submit'),
  cancelSubmission: () => api.post<{ data: { cancelled: true } }>('/workers/me/cancel-submission'),
  requestEdit: () => api.post<{ data: { editUnlocked: true } }>('/workers/me/request-edit'),
  listDocuments: () => api.get<{ data: WorkerDocument[] }>('/workers/me/documents').then((r) => r.data),
  getDocumentUrl: (documentId: string) =>
    api
      .get<{ data: { downloadUrl: string; document: WorkerDocument } }>(
        `/workers/documents/${documentId}/download-url`,
      )
      .then((r) => r.data),
  issueUploadUrl: (input: {
    category: DocumentCategory;
    mimeType: string;
    sizeBytes: number;
    originalFilename: string;
  }) =>
    api
      .post<{
        data: { documentId: string; storageKey: string; uploadUrl: string; expiresIn: number };
      }>('/workers/me/documents/upload-url', input)
      .then((r) => r.data),
  deleteDocument: (documentId: string) =>
    api
      .del<{ data: { deleted: true; profileCompletionPct: number } }>(
        `/workers/me/documents/${documentId}`,
      )
      .then((r) => r.data),
  confirmUpload: (documentId: string) =>
    api
      .post<{ data: { documentId: string; status: DocumentStatus } }>(
        '/workers/me/documents/confirm',
        { documentId },
      )
      .then((r) => r.data),
};

export function uploadFileToR2(url: string, file: File, onProgress?: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable && onProgress) onProgress(Math.round((evt.loaded / evt.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`)));
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(file);
  });
}
