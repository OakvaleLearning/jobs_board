'use client';

import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { employersApi, type EmployerDocument, type EmployerProfile } from '@/lib/employers-api';
import { uploadFileToR2 } from '@/lib/workers-api';
import { ApiError } from '@/lib/api-client';
import { toast } from '@/lib/toast';

const ACCEPT = 'application/pdf,image/jpeg,image/png';

type Slot = { category: EmployerDocument['category']; label: string; description: string };

const INDIVIDUAL_EMPLOYER_SLOTS: Slot[] = [
  { category: 'PROOF_OF_RESIDENCE', label: 'Proof of UK/US residence', description: 'Utility bill or council tax (PDF/JPG/PNG, max 10MB)' },
  { category: 'EMPLOYER_ID', label: 'Photo ID', description: 'Passport or driving licence' },
];
const CORPORATE_SLOTS: Slot[] = [
  { category: 'CAC_CERTIFICATE', label: 'CAC certificate', description: 'Corporate Affairs Commission registration certificate' },
];

export function DocumentsStep({ profile, onNext }: { profile: EmployerProfile; onNext: () => void }) {
  const isFamily = profile.employerType === 'INDIVIDUAL_EMPLOYER';
  const slots = isFamily ? INDIVIDUAL_EMPLOYER_SLOTS : CORPORATE_SLOTS;
  const docs = useQuery({
    queryKey: ['employerDocuments'],
    queryFn: employersApi.listDocuments,
    refetchInterval: (q) => {
      const rows = q.state.data as EmployerDocument[] | undefined;
      return rows?.some((d) => d.status === 'SCANNING') ? 2000 : false;
    },
  });

  return (
    <Card className="space-y-5">
      {isFamily ? (
        <Badge tone="neutral">Optional</Badge>
      ) : (
        <Badge tone="terracotta">Required for verification</Badge>
      )}
      <p className="text-sm text-ink-600">
        {isFamily
          ? 'Optionally upload your ID and proof of residence now — or skip and add them later from your dashboard. An Oakvale agent will follow up before your account is verified.'
          : 'Upload the documents below. An Oakvale agent reviews them before approving your account — you can finish onboarding now and we’ll email you once you’re verified.'}
      </p>
      <div className="space-y-4">
        {slots.map((s) => (
          <DocSlot key={s.category} slot={s} docs={docs.data ?? []} />
        ))}
      </div>
      <div className="flex justify-end gap-3">
        {isFamily ? (
          <Button variant="ghost" onClick={onNext}>
            Skip for now
          </Button>
        ) : null}
        <Button onClick={onNext}>Continue</Button>
      </div>
    </Card>
  );
}

function DocSlot({ slot, docs }: { slot: Slot; docs: EmployerDocument[] }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const current = docs
    .filter((d) => d.category === slot.category)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];

  async function upload(file: File) {
    if (!ACCEPT.split(',').includes(file.type)) return toast.error('Allowed: PDF, JPG, PNG.');
    if (file.size > 10 * 1024 * 1024) return toast.error('Max file size is 10MB.');
    try {
      setProgress(0);
      const { uploadUrl, documentId } = await employersApi.issueDocumentUploadUrl({
        category: slot.category,
        mimeType: file.type,
        sizeBytes: file.size,
        originalFilename: file.name,
      });
      await uploadFileToR2(uploadUrl, file, setProgress);
      await employersApi.confirmDocument(documentId);
      await queryClient.invalidateQueries({ queryKey: ['employerDocuments'] });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="rounded-2xl border border-dashed border-ink/15 bg-cream-50/50 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink">{slot.label}</p>
          <p className="text-xs text-muted mt-0.5">{slot.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {current ? <StatusPill status={current.status} /> : null}
          <Button size="sm" variant="outline" type="button" onClick={() => inputRef.current?.click()} disabled={progress !== null}>
            {progress !== null ? 'Uploading…' : current ? 'Replace' : 'Upload'}
          </Button>
        </div>
      </div>
      {current ? <p className="text-xs text-muted mt-3 truncate">{current.originalFilename}</p> : null}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function StatusPill({ status }: { status: EmployerDocument['status'] }) {
  switch (status) {
    case 'CLEAN':
      return <Badge tone="sage">Clean</Badge>;
    case 'SCANNING':
      return <Badge tone="neutral">Scanning…</Badge>;
    case 'INFECTED':
    case 'REJECTED':
      return <Badge tone="terracotta">Rejected</Badge>;
    default:
      return <Badge tone="neutral">Uploading</Badge>;
  }
}
