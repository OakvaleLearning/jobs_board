'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ACCEPTED_MIMES_BY_CATEGORY,
  MAX_FILE_BYTES,
  type DocumentCategory,
} from '@oakvale/shared/enums/worker';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ApiError } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { uploadFileToR2, workersApi, type WorkerDocument } from '@/lib/workers-api';
import { cn } from '@/lib/cn';

interface Props {
  category: DocumentCategory;
  label: string;
  description?: string;
  /**
   * Controlled mode: bind to one specific document (e.g. a row in an array
   * section with multiple docs of the same category). When provided, the picker
   * shows that document and emits the new id via `onUploaded` instead of picking
   * the latest-by-category.
   */
  documentId?: string | null;
  onUploaded?: (doc: WorkerDocument) => void;
  onDeleted?: () => void;
}

export function DocumentUpload({
  category,
  label,
  description,
  documentId,
  onUploaded,
  onDeleted,
}: Props) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const reactId = useId();
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const controlled = documentId !== undefined;
  const accept = ACCEPTED_MIMES_BY_CATEGORY[category].join(',');

  const docsQuery = useQuery({
    queryKey: ['workerDocuments'],
    queryFn: workersApi.listDocuments,
    refetchInterval: (q) => {
      const docs = q.state.data as WorkerDocument[] | undefined;
      if (docs?.some((d) => d.category === category && d.status === 'SCANNING')) return 2000;
      return false;
    },
  });

  const current = controlled
    ? docsQuery.data?.find((d) => d.id === documentId)
    : docsQuery.data
        ?.filter((d) => d.category === category)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];

  useEffect(() => {
    // Uncontrolled (singleton) mode auto-emits the latest clean doc. Controlled
    // mode emits explicitly on upload (below) so it binds to the right row.
    if (!controlled && current && current.status === 'CLEAN' && onUploaded) onUploaded(current);
  }, [controlled, current?.id, current?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const upload = useCallback(
    async (file: File) => {
      if (!ACCEPTED_MIMES_BY_CATEGORY[category].includes(file.type)) {
        toast.error(`Unsupported file type. Allowed: ${accept}`);
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        toast.error('Max file size is 10MB.');
        return;
      }
      try {
        setProgress(0);
        const { uploadUrl, documentId } = await workersApi.issueUploadUrl({
          category,
          mimeType: file.type,
          sizeBytes: file.size,
          originalFilename: file.name,
        });
        await uploadFileToR2(uploadUrl, file, setProgress);
        await workersApi.confirmUpload(documentId);
        await queryClient.invalidateQueries({ queryKey: ['workerDocuments'] });
        await queryClient.invalidateQueries({ queryKey: ['workerProfile'] });
        // Controlled mode: bind the new document id to this row immediately.
        if (controlled && onUploaded) onUploaded({ id: documentId } as WorkerDocument);
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Upload failed.');
      } finally {
        setProgress(null);
      }
    },
    [category, accept, queryClient, controlled, onUploaded],
  );

  async function handleDelete(e: React.MouseEvent<HTMLButtonElement>) {
    // inside the dropzone <label> — stop the click from opening the file picker
    e.preventDefault();
    e.stopPropagation();
    if (!current || deleting || progress !== null) return;
    if (!window.confirm(`Delete "${current.originalFilename}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await workersApi.deleteDocument(current.id);
      await queryClient.invalidateQueries({ queryKey: ['workerDocuments'] });
      await queryClient.invalidateQueries({ queryKey: ['workerProfile'] });
      await queryClient.invalidateQueries({ queryKey: ['workerCompletion'] });
      onDeleted?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  }

  function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  }

  return (
    <div className="space-y-2">
      <label
        htmlFor={`doc-${category}-${reactId}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          'block cursor-pointer rounded-2xl border border-dashed border-ink/15 px-5 py-6 transition',
          'hover:border-ink/30 bg-cream-50/50',
          dragOver && 'border-terracotta-500 bg-terracotta-500/5',
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-ink">{label}</p>
            {description ? <p className="text-xs text-muted mt-0.5">{description}</p> : null}
          </div>
          {current ? (
            <div className="flex items-center gap-2">
              <StatusPill status={current.status} />
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={handleDelete}
                disabled={deleting || progress !== null}
              >
                {deleting ? 'Removing…' : 'Remove'}
              </Button>
            </div>
          ) : null}
        </div>
        {current ? (
          <p className="text-xs text-muted mt-3 truncate">{current.originalFilename}</p>
        ) : (
          <p className="text-xs text-muted mt-3">Drag a file here or click to choose · max 10MB</p>
        )}
        {progress !== null ? (
          <div className="mt-3 h-1 rounded-full bg-ink/8 overflow-hidden">
            <div
              className="h-full bg-terracotta-500 transition-[width] duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
        ) : null}
        <input
          ref={inputRef}
          id={`doc-${category}-${reactId}`}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = '';
          }}
        />
      </label>
      {current?.status === 'INFECTED' ? (
        <div className="flex items-center justify-between text-xs text-terracotta-700">
          <span>This file failed our scan. Please upload a different one.</span>
          <Button size="sm" variant="outline" type="button" onClick={() => inputRef.current?.click()}>
            Re-upload
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function StatusPill({ status }: { status: WorkerDocument['status'] }) {
  switch (status) {
    case 'CLEAN':
      return <Badge tone="sage">Clean</Badge>;
    case 'SCANNING':
      return <Badge tone="neutral">Scanning…</Badge>;
    case 'INFECTED':
      return <Badge tone="terracotta">Infected</Badge>;
    case 'REJECTED':
      return <Badge tone="terracotta">Rejected</Badge>;
    default:
      return <Badge tone="neutral">Uploading</Badge>;
  }
}
