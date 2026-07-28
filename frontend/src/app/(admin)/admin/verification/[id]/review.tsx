'use client';

import Link from 'next/link';
import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminShell } from '@/components/dashboard/AdminShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/app/(worker)/worker/profile/SectionFrame';
import { api } from '@/lib/api-client';
import { toast, toastApiError } from '@/lib/toast';
import { verificationApi } from '@/lib/verification-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

interface AdminWorkerProfile {
  id: string;
  visibilityStatus: string;
  profileCompletionPct: number;
  sections: Record<string, unknown>;
}

interface PendingChange {
  section: string;
  field: string;
  before: unknown;
  after: unknown;
}

interface WorkerDocumentSummary {
  id: string;
  category: string;
  originalFilename: string;
  status: string;
  createdAt: string;
}

export function ReviewWorker({ workerId }: { workerId: string }) {
  const queryClient = useQueryClient();
  const hydrated = useHydratedTokens();
  const [notes, setNotes] = useState('');
  const [bgNotes, setBgNotes] = useState('');

  const profile = useQuery({
    queryKey: ['adminWorker', workerId],
    queryFn: () => api.get<{ data: AdminWorkerProfile }>(`/workers/${workerId}`).then((r) => r.data),
    enabled: hydrated,
  });
  const status = useQuery({
    queryKey: ['adminVerificationStatus', workerId],
    queryFn: () => verificationApi.worker(workerId),
    enabled: hydrated,
    refetchInterval: (q) => {
      const data = q.state.data as ReturnType<typeof verificationApi.worker> extends Promise<infer R> ? R : never;
      if (data?.background.status === 'IN_PROGRESS' || data?.background.status === 'PENDING') return 2000;
      return false;
    },
  });

  const pendingChanges = useQuery({
    queryKey: ['adminPendingChanges', workerId],
    queryFn: () =>
      api
        .get<{ data: { changes: PendingChange[]; editRequestedAt: string | null } }>(
          `/workers/${workerId}/pending-changes`,
        )
        .then((r) => r.data),
    enabled: hydrated,
  });

  const review = useMutation({
    mutationFn: (decision: 'VERIFIED' | 'REJECTED') =>
      verificationApi.review(workerId, { decision, notes: notes || undefined }),
    onSuccess: (_data, decision) => {
      toast.success(decision === 'VERIFIED' ? 'Identity approved.' : 'Identity rejected.');
      queryClient.invalidateQueries({ queryKey: ['adminVerificationStatus', workerId] });
      queryClient.invalidateQueries({ queryKey: ['adminVerificationQueue'] });
    },
    onError: (e) => toastApiError(e, 'Review failed.'),
  });

  const reviewBg = useMutation({
    mutationFn: (decision: 'CLEAR' | 'FLAGGED') =>
      verificationApi.reviewBackground(workerId, { decision, notes: bgNotes || undefined }),
    onSuccess: (_data, decision) => {
      toast.success(decision === 'CLEAR' ? 'Background marked clear.' : 'Background flagged.');
      queryClient.invalidateQueries({ queryKey: ['adminVerificationStatus', workerId] });
      queryClient.invalidateQueries({ queryKey: ['adminBackgroundChecks'] });
    },
    onError: (e) => toastApiError(e, 'Background review failed.'),
  });

  const sectionA = (profile.data?.sections.A ?? null) as { fullName?: string } | null;
  const sectionB = (profile.data?.sections.B ?? null) as
    | { idType?: string; idNumber?: string; idDocumentId?: string | null; selfieId?: string | null; proofOfAddressId?: string | null }
    | null;
  const sectionC = (profile.data?.sections.C ?? null) as
    | {
        policeCertificateDocumentId?: string | null;
        guarantorLetterDocumentId?: string | null;
        affidavitDocumentId?: string | null;
      }
    | null;

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin · review"
        title="Worker review."
        description="Open each document and confirm the worker’s identity, then review their background documents."
        actions={
          <Link href="/admin/verification" className="text-sm text-muted hover:text-ink underline underline-offset-4">
            Back to queue
          </Link>
        }
      />

      <div className="flex items-center gap-4 mb-6">
        <WorkerPhoto selfieId={sectionB?.selfieId ?? null} name={sectionA?.fullName ?? null} />
        <div>
          <p className="text-lg font-medium text-ink">{sectionA?.fullName ?? 'Unnamed worker'}</p>
          <p className="text-xs text-muted">
            {profile.data?.profileCompletionPct ?? 0}% complete · {profile.data?.visibilityStatus ?? '—'}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <Card>
          <CardEyebrow>Documents</CardEyebrow>
          <CardTitle>Identity bundle</CardTitle>
          <div className="grid md:grid-cols-3 gap-3 mt-5">
            <DocSlot label="ID document" id={sectionB?.idDocumentId ?? null} />
            <DocSlot label="Selfie" id={sectionB?.selfieId ?? null} />
            <DocSlot label="Proof of address" id={sectionB?.proofOfAddressId ?? null} />
          </div>
          {sectionB?.idNumber ? (
            <p className="text-sm text-muted mt-5">
              {sectionB.idType} · {sectionB.idNumber}
            </p>
          ) : null}

          {(pendingChanges.data?.changes.length ?? 0) > 0 ? (
            <div className="mt-8">
              <CardEyebrow>Changes since approval</CardEyebrow>
              <p className="text-xs text-muted mt-1">
                This verified worker edited their profile
                {pendingChanges.data?.editRequestedAt
                  ? ` on ${new Date(pendingChanges.data.editRequestedAt).toLocaleString()}`
                  : ''}
                . Review the changes. Re-approving runs revalidation (a fresh background check).
              </p>
              <div className="mt-3 divide-y divide-ink/8 rounded-xl border border-ink/8 bg-cream-50">
                {pendingChanges.data?.changes.map((c) => (
                  <div key={`${c.section}.${c.field}`} className="px-4 py-2.5 text-sm flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-xs font-medium text-muted w-28 shrink-0">
                      {c.section} · {c.field}
                    </span>
                    <span className="text-terracotta-700 line-through decoration-terracotta-700/40">
                      {formatValue(c.before)}
                    </span>
                    <span className="text-muted">→</span>
                    <span className="text-sage-600 font-medium">{formatValue(c.after)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Card>

        <Card>
          <CardEyebrow>Status</CardEyebrow>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              Identity
              <Badge tone={status.data?.identity.status === 'VERIFIED' ? 'sage' : status.data?.identity.status === 'REJECTED' ? 'terracotta' : 'neutral'}>
                {status.data?.identity.status ?? '—'}
              </Badge>
            </span>
          </CardTitle>
          <p className="text-sm text-muted mt-3">
            Background (advisory):{' '}
            <Badge
              tone={
                status.data?.background.status === 'CLEAR'
                  ? 'sage'
                  : status.data?.background.status === 'FLAGGED'
                    ? 'terracotta'
                    : 'neutral'
              }
            >
              {status.data?.background.status ?? '—'}
            </Badge>
          </p>

          {status.data?.visibilityGate ? (
            <div className="mt-5">
              <CardEyebrow>Visibility gate</CardEyebrow>
              <ul className="mt-2 space-y-1.5 text-sm">
                {[
                  { ok: status.data.visibilityGate.identityVerified, label: 'Identity verified' },
                  { ok: status.data.visibilityGate.oakvaleCertified, label: 'Oakvale certification active' },
                  { ok: status.data.visibilityGate.completionOk, label: 'Profile ≥70% complete' },
                  { ok: status.data.visibilityGate.noSafeguarding, label: 'No safeguarding flag' },
                ].map((c) => (
                  <li key={c.label} className="flex items-center gap-2">
                    {c.ok ? (
                      <Check className="h-4 w-4 text-sage-600" aria-hidden />
                    ) : (
                      <X className="h-4 w-4 text-terracotta-600" aria-hidden />
                    )}
                    <span className={c.ok ? 'text-ink' : 'text-ink-600'}>{c.label}</span>
                  </li>
                ))}
              </ul>
              {!status.data.visibilityGate.visible ? (
                <p className="mt-2 text-xs text-muted">
                  Worker stays pending review until every check passes.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6 space-y-3">
            <Textarea
              placeholder="Notes for the worker (shown on rejection)…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={
                  review.isPending ||
                  (status.data?.identity.status === 'VERIFIED' &&
                    (pendingChanges.data?.changes.length ?? 0) === 0)
                }
                onClick={() => review.mutate('VERIFIED')}
              >
                {status.data?.identity.status === 'VERIFIED' &&
                (pendingChanges.data?.changes.length ?? 0) > 0
                  ? 'Re-approve changes'
                  : 'Approve identity'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={review.isPending}
                onClick={() => review.mutate('REJECTED')}
              >
                Reject
              </Button>
            </div>
            <p className="text-xs text-muted">
              Approve makes the worker live once they have an active Oakvale CPD certification (and a
              complete profile). Reject sets visibility to REJECTED and surfaces notes to the worker.
            </p>
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardEyebrow>Background documents (advisory)</CardEyebrow>
        <CardTitle>Police, guarantor &amp; affidavit</CardTitle>
        <p className="text-sm text-muted mt-2">
          Review the uploaded documents and mark the background Clear or Flagged. This is advisory. It
          updates the badge but does not change whether the worker is visible to employers.
        </p>
        <div className="grid md:grid-cols-3 gap-3 mt-5">
          <DocSlot label="Police character certificate" id={sectionC?.policeCertificateDocumentId ?? null} />
          <DocSlot label="Guarantor / attestation letter" id={sectionC?.guarantorLetterDocumentId ?? null} />
          <DocSlot label="Sworn affidavit" id={sectionC?.affidavitDocumentId ?? null} />
        </div>
        <div className="mt-6 max-w-xl space-y-3">
          <Textarea
            placeholder="Notes for the worker (shown if flagged)…"
            value={bgNotes}
            onChange={(e) => setBgNotes(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={reviewBg.isPending || status.data?.background.status === 'CLEAR'}
              onClick={() => reviewBg.mutate('CLEAR')}
            >
              Mark clear
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={reviewBg.isPending || status.data?.background.status === 'FLAGGED'}
              onClick={() => reviewBg.mutate('FLAGGED')}
            >
              Flag
            </Button>
          </div>
        </div>
      </Card>
    </AdminShell>
  );
}

function WorkerPhoto({ selfieId, name }: { selfieId: string | null; name: string | null }) {
  const urlQuery = useQuery({
    queryKey: ['adminWorkerSelfie', selfieId],
    queryFn: () =>
      api
        .get<{ data: { downloadUrl: string } }>(`/workers/documents/${selfieId}/download-url`)
        .then((r) => r.data.downloadUrl),
    enabled: Boolean(selfieId),
    staleTime: Infinity,
  });

  if (urlQuery.data) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={urlQuery.data}
        alt={name ?? 'Worker'}
        className="h-16 w-16 rounded-full object-cover border border-ink/10 shadow-sm"
      />
    );
  }

  const initial = name?.trim()?.charAt(0)?.toUpperCase() ?? '?';
  return (
    <div className="h-16 w-16 rounded-full border border-ink/10 bg-cream-50 shadow-sm flex items-center justify-center text-xl font-medium text-muted">
      {initial}
    </div>
  );
}

function DocSlot({ label, id }: { label: string; id: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [doc, setDoc] = useState<WorkerDocumentSummary | null>(null);

  async function load() {
    if (!id) return;
    try {
      const r = await api.get<{ data: { downloadUrl: string; document: WorkerDocumentSummary } }>(
        `/workers/documents/${id}/download-url`,
      );
      setUrl(r.data.downloadUrl);
      setDoc(r.data.document);
    } catch (e) {
      toastApiError(e, 'Could not load.');
    }
  }

  return (
    <div className="rounded-xl border border-ink/8 bg-cream-50 p-4">
      <p className="text-eyebrow text-muted">{label}</p>
      {!id ? (
        <p className="text-xs text-muted mt-2">Not uploaded.</p>
      ) : !url ? (
        <Button type="button" size="sm" variant="outline" className="mt-3" onClick={load}>
          Open
        </Button>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted truncate">{doc?.originalFilename}</p>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-ink hover:text-terracotta-600 underline underline-offset-4 decoration-ink/20"
          >
            View in new tab →
          </a>
        </div>
      )}
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return String(v);
}
