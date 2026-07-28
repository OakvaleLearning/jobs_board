'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { DashboardShell, PageHeader } from '@/components/dashboard/Shell';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Progress } from '@/components/ui/Progress';
import { workersApi } from '@/lib/workers-api';
import { verificationApi } from '@/lib/verification-api';
import { complianceApi } from '@/lib/compliance-api';
import { offersApi } from '@/lib/offers-api';
import { contractsApi } from '@/lib/contracts-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';
import { useAuth } from '@/lib/auth-store';
import { WORKER_NAV } from '@/lib/worker-nav';

export function DashboardOverview() {
  const hydrated = useHydratedTokens();
  const user = useAuth((s) => s.user);

  const profile = useQuery({
    queryKey: ['workerProfile'],
    queryFn: workersApi.getProfile,
    enabled: hydrated,
  });
  const verification = useQuery({
    queryKey: ['verificationStatus'],
    queryFn: verificationApi.me,
    enabled: hydrated,
  });
  const compliance = useQuery({
    queryKey: ['complianceStatus'],
    queryFn: complianceApi.me,
    enabled: hydrated,
  });

  const offers = useQuery({
    queryKey: ['workerOffers'],
    queryFn: () => offersApi.myWorkerList().then((r) => r.data),
    enabled: hydrated,
  });
  const contracts = useQuery({
    queryKey: ['workerContracts'],
    queryFn: contractsApi.mine,
    enabled: hydrated,
  });

  // The worker's own selfie — fetch the document list, then a presigned URL for it.
  const documents = useQuery({
    queryKey: ['workerDocuments'],
    queryFn: workersApi.listDocuments,
    enabled: hydrated,
  });
  const selfieDoc = (documents.data ?? []).find(
    (d) => d.category === 'SELFIE' && d.status === 'CLEAN',
  );
  const selfieUrl = useQuery({
    queryKey: ['workerSelfieUrl', selfieDoc?.id],
    queryFn: () => workersApi.getDocumentUrl(selfieDoc!.id),
    enabled: hydrated && Boolean(selfieDoc),
  });
  const photoUrl = selfieUrl.data?.downloadUrl ?? null;

  const openOffers = (offers.data ?? []).filter((o) => o.status === 'SENT_TO_WORKER').length;
  const unsignedContracts = (contracts.data ?? []).filter((c) => c.status === 'AWAITING_WORKER').length;

  const pct = profile.data?.profileCompletionPct ?? 0;
  const status = profile.data?.visibilityStatus ?? 'DRAFT';
  const submittable = pct >= 80 && (status === 'DRAFT' || status === 'REJECTED');
  const identityState = verification.data?.identity.status ?? 'UNSTARTED';
  const bgState = verification.data?.background.status ?? 'UNSTARTED';
  const cpdActive = compliance.data?.oakvaleCertified ?? false;

  return (
    <DashboardShell surface="Worker portal" nav={WORKER_NAV}>
      <PageHeader
        eyebrow="Worker · overview"
        title={`Welcome, ${user?.fullName ?? 'healthcare professional'}`}
        description="Complete each section to become discoverable. We verify identity, run a background check, and confirm CPD before your profile goes live."
        actions={
          <>
            <Badge tone={pct >= 80 ? 'sage' : 'terracotta'}>Profile {pct}% complete</Badge>
            <Avatar src={photoUrl} name={user?.fullName} size="lg" />
          </>
        }
      />

      {identityState === 'VERIFIED' && bgState === 'CLEAR' && !cpdActive ? (
        <div className="mb-5 rounded-2xl border border-terracotta-500/20 bg-terracotta-50 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-eyebrow text-terracotta-700">One step left</p>
            <p className="text-sm text-ink-600 mt-1">
              Your identity is verified and your background check is clear. Add your Oakvale CPD
              certification to go live to employers.
            </p>
          </div>
          <Link href="/worker/compliance">
            <Button size="sm">Complete CPD</Button>
          </Link>
        </div>
      ) : null}

      <div className="stagger grid lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <CardEyebrow>Profile completion</CardEyebrow>
            <Link href="/worker/profile" className="text-xs text-muted hover:text-ink underline underline-offset-4">
              Open editor →
            </Link>
          </div>
          <CardTitle>Build a profile employers can trust.</CardTitle>
          <Progress value={pct} className="mt-2" />
          <div className="flex flex-wrap gap-3 mt-5">
            <Link href="/worker/profile">
              <Button size="sm">Continue editing</Button>
            </Link>
            {submittable ? (
              <Link href="/worker/profile">
                <Button size="sm" variant="secondary">
                  {status === 'REJECTED' ? 'Resubmit for review' : 'Submit for review'}
                </Button>
              </Link>
            ) : null}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <CardEyebrow>Visibility</CardEyebrow>
            <StatusPill tone={toneForVisibility(status)}>{labelForStatus(status)}</StatusPill>
          </div>
          <CardTitle>{labelForStatus(status)}</CardTitle>
          <p className="text-sm text-ink-600 mt-3">
            {status === 'DRAFT' && 'Reach 80% completion to submit. We verify identity and CPD before your profile goes live.'}
            {status === 'PENDING_REVIEW' && 'Our agents are reviewing your documents. Background check runs on approval.'}
            {status === 'APPROVED' && 'You are visible to employers. Welcome to the marketplace.'}
            {status === 'REJECTED' && 'Your profile needs changes. Check the notes from our agents and resubmit.'}
            {status === 'SUSPENDED' && 'Your profile is suspended. Contact your agent.'}
          </p>
          {status === 'REJECTED' && verification.data?.identity.notes ? (
            <p className="text-sm text-terracotta-700 mt-2">
              Agent notes: {verification.data.identity.notes}
            </p>
          ) : null}
        </Card>

        <Card>
          <CardEyebrow>Identity & background</CardEyebrow>
          <CardTitle>{labelIdentity(identityState, bgState)}</CardTitle>
          <div className="flex flex-wrap gap-2 mt-3">
            <StatusPill tone={toneForIdentity(identityState)}>
              Identity · {labelForIdentityState(identityState)}
            </StatusPill>
            <StatusPill tone={toneForBackground(bgState)}>
              Background · {labelForBackgroundState(bgState)}
            </StatusPill>
          </div>
          <p className="text-sm text-ink-600 mt-3">
            {identityState === 'VERIFIED' && bgState === 'CLEAR'
              ? 'You are fully verified.'
              : identityState === 'VERIFIED'
                ? 'Identity approved. Your background documents are with our team (advisory).'
                : identityState === 'REJECTED'
                  ? 'Your identity submission was rejected. Check verification for notes.'
                  : 'Submit your profile from the editor to start verification.'}
          </p>
          <div className="mt-5">
            <Link href="/worker/verification">
              <Button size="sm" variant="outline">Open verification</Button>
            </Link>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <CardEyebrow>Oakvale CPD</CardEyebrow>
            <StatusPill tone={cpdActive ? 'sage' : 'terracotta'}>
              {cpdActive ? 'Certified' : 'Not certified'}
            </StatusPill>
          </div>
          <CardTitle>{cpdActive ? 'Active' : 'Not yet certified'}</CardTitle>
          <p className="text-sm text-ink-600 mt-3">
            {cpdActive
              ? 'A valid Oakvale certification is on file. We’ll remind you 60 days before expiry.'
              : 'Upload your Oakvale certification (or enrol in the programme) to be visible to employers.'}
          </p>
          <div className="mt-5">
            <Link href="/worker/compliance">
              <Button size="sm" variant="outline">CPD & compliance</Button>
            </Link>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <CardEyebrow>Offers & contracts</CardEyebrow>
            <StatusPill tone={openOffers + unsignedContracts > 0 ? 'terracotta' : 'neutral'}>
              {openOffers + unsignedContracts > 0 ? `${openOffers + unsignedContracts} need action` : 'All clear'}
            </StatusPill>
          </div>
          <CardTitle>
            {openOffers > 0 || unsignedContracts > 0
              ? 'Action needed.'
              : 'Nothing waiting on you.'}
          </CardTitle>
          <p className="text-sm text-ink-600 mt-3">
            {openOffers > 0 ? `${openOffers} offer${openOffers === 1 ? '' : 's'} awaiting your response. ` : ''}
            {unsignedContracts > 0 ? `${unsignedContracts} contract${unsignedContracts === 1 ? '' : 's'} awaiting your signature.` : ''}
            {openOffers === 0 && unsignedContracts === 0 ? 'Offers and agreements land here the moment they need you.' : ''}
          </p>
          <div className="mt-5 flex gap-2">
            <Link href="/worker/offers">
              <Button size="sm" variant="outline">Offers</Button>
            </Link>
            <Link href="/worker/contracts">
              <Button size="sm" variant="outline">Contracts</Button>
            </Link>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <CardEyebrow>Placements</CardEyebrow>
            <StatusPill tone="neutral">None yet</StatusPill>
          </div>
          <CardTitle>None yet</CardTitle>
          <p className="text-sm text-ink-600 mt-3">
            Shortlists go out once your profile is verified and certified. You&rsquo;ll see them here.
          </p>
          <div className="mt-5">
            <Link href="/worker/placements">
              <Button size="sm" variant="outline">Open placements</Button>
            </Link>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <CardEyebrow>Welfare check-ins</CardEyebrow>
            <StatusPill tone="brand">Monthly</StatusPill>
          </div>
          <CardTitle>Monthly</CardTitle>
          <p className="text-sm text-ink-600 mt-3">
            When you&rsquo;re placed, our liaison nurse logs a monthly welfare report.
          </p>
        </Card>
      </div>
    </DashboardShell>
  );
}

type PillTone = 'neutral' | 'sage' | 'terracotta' | 'ink' | 'brand';

function StatusPill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  return (
    <Badge tone={tone}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </Badge>
  );
}

function toneForVisibility(s: string): PillTone {
  switch (s) {
    case 'APPROVED': return 'sage';
    case 'PENDING_REVIEW': return 'brand';
    case 'REJECTED':
    case 'SUSPENDED': return 'terracotta';
    default: return 'neutral';
  }
}

function toneForIdentity(s: string): PillTone {
  switch (s) {
    case 'VERIFIED': return 'sage';
    case 'SUBMITTED':
    case 'IN_REVIEW': return 'brand';
    case 'REJECTED':
    case 'FLAGGED': return 'terracotta';
    default: return 'neutral';
  }
}

function labelForIdentityState(s: string): string {
  switch (s) {
    case 'VERIFIED': return 'Verified';
    case 'SUBMITTED':
    case 'IN_REVIEW': return 'In review';
    case 'REJECTED': return 'Rejected';
    case 'FLAGGED': return 'Flagged';
    case 'PENDING': return 'Pending';
    default: return 'Not submitted';
  }
}

function toneForBackground(s: string): PillTone {
  switch (s) {
    case 'CLEAR': return 'sage';
    case 'PENDING':
    case 'IN_PROGRESS': return 'brand';
    case 'FLAGGED':
    case 'REVIEW':
    case 'HIT':
    case 'FAILED': return 'terracotta';
    default: return 'neutral';
  }
}

function labelForBackgroundState(s: string): string {
  switch (s) {
    case 'CLEAR': return 'Clear';
    case 'PENDING':
    case 'IN_PROGRESS':
    case 'REVIEW': return 'Under review';
    case 'FLAGGED':
    case 'HIT':
    case 'FAILED': return 'Flagged';
    default: return 'Not submitted';
  }
}

function labelIdentity(identity: string, bg: string): string {
  if (identity === 'VERIFIED' && bg === 'CLEAR') return 'Fully verified';
  if (identity === 'VERIFIED') return 'Background check running';
  if (identity === 'IN_REVIEW' || identity === 'SUBMITTED') return 'Identity in review';
  if (identity === 'REJECTED') return 'Identity rejected';
  return 'Not submitted';
}

function labelForStatus(s: string): string {
  switch (s) {
    case 'DRAFT': return 'Draft';
    case 'PENDING_REVIEW': return 'In review';
    case 'APPROVED': return 'Live';
    case 'REJECTED': return 'Changes requested';
    case 'SUSPENDED': return 'Suspended';
    default: return s;
  }
}
