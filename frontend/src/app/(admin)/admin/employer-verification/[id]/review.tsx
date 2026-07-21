'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminShell } from '@/components/dashboard/AdminShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { adminApi, type EmployerReviewDoc } from '@/lib/admin-api';
import { toast, toastApiError } from '@/lib/toast';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';
import { useIsAdmin } from '@/lib/auth-store';
import { REFERRAL_SOURCE_LABELS, type ReferralSource } from '@oakvale/shared/schema/auth';

function referralSourceLabel(source: string | null | undefined): string | null {
  if (!source) return null;
  return REFERRAL_SOURCE_LABELS[source as ReferralSource] ?? source;
}

export function EmployerVerificationReview({ employerId }: { employerId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const hydrated = useHydratedTokens();
  const isAdmin = useIsAdmin();
  const [notes, setNotes] = useState('');

  const detail = useQuery({
    queryKey: ['adminEmployerVerification', employerId],
    queryFn: () => adminApi.getEmployerVerification(employerId),
    enabled: hydrated,
  });

  const review = useMutation({
    mutationFn: (decision: 'APPROVED' | 'REJECTED') =>
      adminApi.reviewEmployerVerification(employerId, { decision, notes: notes.trim() || undefined }),
    onSuccess: (_d, decision) => {
      toast.success(decision === 'APPROVED' ? 'Employer approved.' : 'Revision requested.');
      queryClient.invalidateQueries({ queryKey: ['adminEmployerVerificationQueue'] });
      router.push('/admin/employer-verification');
    },
    onError: (e) => toastApiError(e, 'Could not submit the decision.'),
  });

  const e = detail.data?.employer;
  const docs = detail.data?.documents ?? [];
  const referral = detail.data?.referral;

  return (
    <AdminShell>
      <Link
        href="/admin/employer-verification"
        className="mb-4 inline-flex items-center gap-2 rounded-full border border-ink/12 bg-white px-4 h-9 text-sm font-medium text-ink transition hover:border-brand-500/40 hover:bg-cream-50"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to queue
      </Link>
      <PageHeader
        eyebrow="Admin · employer verification"
        title={e?.orgName ?? 'Employer review'}
        description="Confirm the organisation details and documents, then approve or request changes."
        actions={e ? <Badge tone={e.verificationStatus === 'PENDING' ? 'terracotta' : 'neutral'}>{e.verificationStatus}</Badge> : null}
      />

      {!e ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <div className="grid lg:grid-cols-[1fr_340px] gap-6">
          <div className="space-y-6">
            <Card>
              <CardEyebrow>Organisation</CardEyebrow>
              <CardTitle>{e.orgName ?? 'Unnamed'}</CardTitle>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <Field label="Sector" value={e.sector} />
                <Field label="Registration no." value={e.regNumber} />
                <Field label="Address" value={e.address} />
                <Field label="Website" value={e.website} />
              </dl>
            </Card>

            <Card>
              <CardEyebrow>Verification documents</CardEyebrow>
              <CardTitle>{docs.length} uploaded</CardTitle>
              <ul className="mt-4 space-y-2">
                {docs.map((d) => (
                  <DocRow key={d.id} doc={d} />
                ))}
                {docs.length === 0 ? <li className="text-sm text-muted">No documents uploaded.</li> : null}
              </ul>
            </Card>

            <Card>
              <CardEyebrow>Referral</CardEyebrow>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <Field label="Source" value={referralSourceLabel(referral?.source)} />
                {referral?.referrerName ? (
                  <Field label="Referred by" value={referral.referrerName} />
                ) : null}
              </dl>
            </Card>
          </div>

          {isAdmin ? (
            <Card className="h-fit">
              <CardEyebrow>Decision</CardEyebrow>
              <CardTitle>Approve or request changes</CardTitle>
              <textarea
                value={notes}
                onChange={(ev) => setNotes(ev.target.value)}
                placeholder="Notes (shared with the employer on rejection)…"
                className="mt-4 w-full rounded-xl border border-ink/12 bg-cream-50 p-3 text-sm min-h-[120px]"
              />
              <p className="text-xs text-muted mt-2">Approving assigns you as the account manager.</p>
              <div className="mt-4 flex gap-2">
                <Button onClick={() => review.mutate('APPROVED')} disabled={review.isPending || e.verificationStatus !== 'PENDING'}>
                  Approve
                </Button>
                <Button
                  variant="outline"
                  onClick={() => review.mutate('REJECTED')}
                  disabled={review.isPending || e.verificationStatus !== 'PENDING'}
                >
                  Request changes
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="h-fit">
              <CardEyebrow>Decision</CardEyebrow>
              <CardTitle>View only</CardTitle>
              <p className="text-sm text-ink-600 mt-3">
                Review the organisation details and documents. An admin makes the final
                approval decision.
              </p>
            </Card>
          )}
        </div>
      )}
    </AdminShell>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-eyebrow text-muted">{label}</dt>
      <dd className="text-ink mt-0.5">{value || '—'}</dd>
    </div>
  );
}

function DocRow({ doc }: { doc: EmployerReviewDoc }) {
  const [loading, setLoading] = useState(false);
  async function open() {
    setLoading(true);
    try {
      const { downloadUrl } = await adminApi.employerDocumentUrl(doc.id);
      window.open(downloadUrl, '_blank', 'noopener');
    } catch {
      toast.error('Could not open the document.');
    } finally {
      setLoading(false);
    }
  }
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-ink/8 bg-cream-50 px-4 py-3">
      <div>
        <p className="text-sm text-ink">{doc.category.replaceAll('_', ' ').toLowerCase()}</p>
        <p className="text-xs text-muted truncate">{doc.originalFilename}</p>
      </div>
      <div className="flex items-center gap-2">
        <Badge tone={doc.status === 'CLEAN' ? 'sage' : doc.status === 'SCANNING' ? 'neutral' : 'terracotta'}>
          {doc.status}
        </Badge>
        <Button size="sm" variant="outline" onClick={open} disabled={loading}>
          {loading ? '…' : 'View'}
        </Button>
      </div>
    </li>
  );
}
