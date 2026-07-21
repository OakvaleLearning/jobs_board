'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { adminApi, type CertSubmissionRow } from '@/lib/admin-api';
import { workersApi } from '@/lib/workers-api';
import { toast, toastApiError } from '@/lib/toast';

/** Status → badge tone, shared by the modal and the table. */
export function statusTone(status: CertSubmissionRow['verificationStatus']) {
  switch (status) {
    case 'APPROVED':
      return 'sage' as const;
    case 'REJECTED':
      return 'terracotta' as const;
    default:
      return 'amber' as const;
  }
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-ink text-right">{value}</span>
    </div>
  );
}

export function CertReviewModal({
  cert,
  onClose,
}: {
  cert: CertSubmissionRow | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);

  // Reset the reject panel whenever a different submission is opened.
  useEffect(() => {
    setRejecting(false);
    setNote('');
    setNoteError(null);
  }, [cert?.certificationId]);

  const docQuery = useQuery({
    queryKey: ['certDocumentUrl', cert?.certificateDocumentId],
    queryFn: () => workersApi.getDocumentUrl(cert!.certificateDocumentId!),
    enabled: !!cert?.certificateDocumentId,
  });

  const mut = useMutation({
    mutationFn: (decision: 'APPROVED' | 'REJECTED') =>
      adminApi.reviewCertification(cert!.certificationId, {
        decision,
        note: decision === 'REJECTED' ? note.trim() : undefined,
      }),
    onSuccess: (_data, decision) => {
      toast.success(decision === 'APPROVED' ? 'Certificate approved.' : 'Certificate rejected.');
      queryClient.invalidateQueries({ queryKey: ['adminCertifications'] });
      onClose();
    },
    onError: (e) => toastApiError(e, 'Could not save the review.'),
  });

  function onReject() {
    if (note.trim().length === 0) {
      setNoteError('A reason is required when rejecting a certificate.');
      return;
    }
    setNoteError(null);
    mut.mutate('REJECTED');
  }

  if (!cert) return null;

  const doc = docQuery.data?.document;
  const url = docQuery.data?.downloadUrl;
  const isImage = doc?.mimeType.startsWith('image/');
  const isPdf = doc?.mimeType === 'application/pdf';

  return (
    <Modal
      open={!!cert}
      onClose={onClose}
      size="xl"
      title="Review certificate"
      description={cert.fullName ?? cert.workerId.slice(0, 8)}
    >
      <div className="grid gap-6 md:grid-cols-2">
        {/* Left: submission details */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Badge tone={statusTone(cert.verificationStatus)}>
              {cert.verificationStatus.toLowerCase()}
            </Badge>
            <Badge tone={cert.isOakvaleCert ? 'brand' : 'neutral'}>
              {cert.certType.replace(/_/g, ' ').toLowerCase()}
            </Badge>
          </div>
          <div className="divide-y divide-ink/6">
            <DetailRow label="Worker" value={cert.fullName ?? '—'} />
            <DetailRow label="Email" value={cert.email} />
            <DetailRow label="Phone" value={cert.phone ?? '—'} />
            <DetailRow label="Issued by" value={cert.issuedBy} />
            <DetailRow
              label="Certificate number"
              value={cert.certNumber ?? <span className="text-muted">—</span>}
            />
            <DetailRow label="Issued on" value={cert.issuedAt} />
            <DetailRow label="Expires" value={cert.expiresAt ?? '—'} />
            <DetailRow
              label="Submitted"
              value={new Date(cert.submittedAt).toLocaleDateString()}
            />
            {cert.reviewNote ? (
              <DetailRow label="Last review note" value={cert.reviewNote} />
            ) : null}
          </div>
        </div>

        {/* Right: certificate preview */}
        <div>
          <p className="mb-2 text-sm font-medium text-ink">Certificate document</p>
          <div className="flex min-h-[16rem] items-center justify-center overflow-hidden rounded-2xl border border-ink/8 bg-cream-50">
            {!cert.certificateDocumentId ? (
              <Badge tone="terracotta">Missing</Badge>
            ) : docQuery.isLoading ? (
              <span className="text-sm text-muted">Loading preview…</span>
            ) : docQuery.isError || !url ? (
              <span className="text-sm text-terracotta-700">Could not load the document.</span>
            ) : isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="Certificate" className="max-h-[28rem] w-full object-contain" />
            ) : isPdf ? (
              <iframe src={url} title="Certificate" className="h-[28rem] w-full" />
            ) : (
              <span className="text-sm text-muted">Preview unavailable for this file type.</span>
            )}
          </div>
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-sm text-brand-700 hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              Open in new tab
            </a>
          ) : null}
        </div>
      </div>

      {/* Reject reason */}
      {rejecting ? (
        <div className="mt-6">
          <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="reject-note">
            Reason for rejection
          </label>
          <textarea
            id="reject-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-ink/12 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500/40"
            placeholder="Explain why this certificate can't be verified (visible to admins)."
          />
          {noteError ? <p className="mt-1.5 text-xs text-terracotta-700">{noteError}</p> : null}
        </div>
      ) : null}

      {/* Actions */}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" type="button" onClick={onClose} disabled={mut.isPending}>
          Cancel
        </Button>
        {rejecting ? (
          <Button variant="secondary" type="button" onClick={onReject} disabled={mut.isPending}>
            {mut.isPending ? 'Rejecting…' : 'Confirm reject'}
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              type="button"
              onClick={() => setRejecting(true)}
              disabled={mut.isPending}
            >
              Reject
            </Button>
            <Button type="button" onClick={() => mut.mutate('APPROVED')} disabled={mut.isPending}>
              {mut.isPending ? 'Approving…' : 'Approve'}
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
