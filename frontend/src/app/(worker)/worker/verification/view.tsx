'use client';

import { useQuery } from '@tanstack/react-query';
import { DashboardShell, PageHeader } from '@/components/dashboard/Shell';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { verificationApi, type VerificationStatusAggregate } from '@/lib/verification-api';
import { complianceApi, type ComplianceStatusResp } from '@/lib/compliance-api';
import { cn } from '@/lib/cn';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';
import { WORKER_NAV } from '@/lib/worker-nav';

type Step = {
  key: string;
  title: string;
  tone: 'sage' | 'terracotta' | 'neutral' | 'ink';
  state: string;
  detail: string;
};

export function VerificationView() {
  const hydrated = useHydratedTokens();

  const v = useQuery({ queryKey: ['verificationStatus'], queryFn: verificationApi.me, enabled: hydrated });
  const c = useQuery({ queryKey: ['complianceStatus'], queryFn: complianceApi.me, enabled: hydrated });

  const steps = buildSteps(v.data, c.data);

  return (
    <DashboardShell surface="Worker portal" nav={WORKER_NAV}>
      <PageHeader
        eyebrow="Worker · verification"
        title="The trust ladder."
        description="Every check below has to pass before your profile becomes visible to employers. We&rsquo;ll keep you posted at each step."
        actions={
          v.data?.overallVerified && c.data?.oakvaleCertified ? (
            <Badge tone="sage">Live to employers</Badge>
          ) : (
            <Badge tone="terracotta">In progress</Badge>
          )
        }
      />

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <ol className="relative space-y-4 pl-8">
          <div className="absolute left-3 top-3 bottom-3 w-px bg-ink/10" aria-hidden />
          {steps.map((s, i) => (
            <li key={s.key} className="relative">
              <span
                className={cn(
                  'absolute -left-[26px] top-3 h-4 w-4 rounded-full ring-4 ring-cream-100',
                  s.tone === 'sage'
                    ? 'bg-sage-500'
                    : s.tone === 'terracotta'
                      ? 'bg-terracotta-500'
                      : s.tone === 'ink'
                        ? 'bg-brand-500'
                        : 'bg-ink/20',
                )}
                aria-hidden
              />
              <Card className="!p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="h-display text-base text-muted tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                    <h3 className="h-display text-xl">{s.title}</h3>
                  </div>
                  <Badge tone={s.tone}>{s.state}</Badge>
                </div>
                <p className="text-sm text-ink-600 mt-3 max-w-2xl">{s.detail}</p>
              </Card>
            </li>
          ))}
        </ol>

        <Card>
          <CardEyebrow>Visibility gate</CardEyebrow>
          <CardTitle>{c.data?.visibleToEmployers ? 'You’re visible.' : 'Not yet visible.'}</CardTitle>
          <p className="text-sm text-ink-600 mt-3">
            These must be true: identity verified, Oakvale CPD certification active, profile complete — and
            no active safeguarding flag. Your background check is advisory and does not block visibility.
          </p>
          <ul className="mt-5 space-y-2 text-sm">
            <Gate ok={v.data?.identity.status === 'VERIFIED'} label="Identity verified" />
            <Gate ok={!!c.data?.oakvaleCertified} label="Oakvale CPD active" />
            <Gate ok={!c.data?.activeFlags.some((f) => f.flagType === 'SAFEGUARDING')} label="No safeguarding flags" />
          </ul>
        </Card>
      </div>
    </DashboardShell>
  );
}

function Gate({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center justify-between gap-3 text-ink-600">
      <span>{label}</span>
      <Badge tone={ok ? 'sage' : 'neutral'}>{ok ? 'Yes' : 'Pending'}</Badge>
    </li>
  );
}

function buildSteps(
  v: VerificationStatusAggregate | undefined,
  c: ComplianceStatusResp | undefined,
): Step[] {
  const identity = v?.identity.status ?? 'UNSTARTED';
  const bg = v?.background.status ?? 'UNSTARTED';
  const certified = c?.oakvaleCertified ?? false;

  return [
    {
      key: 'identity',
      title: 'Identity verified',
      tone: identity === 'VERIFIED' ? 'sage' : identity === 'REJECTED' ? 'terracotta' : 'neutral',
      state:
        identity === 'VERIFIED'
          ? 'Verified'
          : identity === 'IN_REVIEW' || identity === 'SUBMITTED'
            ? 'In review'
            : identity === 'REJECTED'
              ? 'Rejected'
              : 'Not submitted',
      detail:
        identity === 'VERIFIED'
          ? 'Your ID, selfie, and address have all been confirmed.'
          : identity === 'REJECTED'
            ? v?.identity.notes
              ? `Agent notes: ${v.identity.notes}`
              : 'We need updated documents. Check your dashboard.'
            : identity === 'UNSTARTED'
              ? 'Submit your profile from the editor to start the review.'
              : 'Our agents are reviewing your identity documents.',
    },
    {
      key: 'background',
      title: 'Background documents (advisory)',
      tone: bg === 'CLEAR' ? 'sage' : bg === 'FLAGGED' || bg === 'HIT' || bg === 'FAILED' ? 'terracotta' : 'neutral',
      state:
        bg === 'UNSTARTED'
          ? 'Not submitted'
          : bg === 'CLEAR'
            ? 'Clear'
            : bg === 'FLAGGED' || bg === 'HIT' || bg === 'FAILED'
              ? 'Flagged'
              : 'Under review',
      detail:
        bg === 'CLEAR'
          ? 'Our team reviewed your background documents and marked them clear.'
          : bg === 'FLAGGED' || bg === 'HIT' || bg === 'FAILED'
            ? v?.background.notes
              ? `Reviewer notes: ${v.background.notes}`
              : 'A document needs follow-up. You can re-upload clearer copies from your profile.'
            : bg === 'UNSTARTED'
              ? 'Upload your police, guarantor, and affidavit documents in the profile editor.'
              : 'Our team is reviewing the background documents you uploaded. This is advisory and does not block your visibility.',
    },
    {
      key: 'cpd',
      title: 'Oakvale CPD certification',
      tone: certified ? 'sage' : 'neutral',
      state: certified ? 'Active' : 'Not enrolled',
      detail: certified
        ? 'A valid Oakvale certification is on file. We’ll remind you 60 days before it expires.'
        : 'Enrol in (or upload) your Oakvale CPD to complete the gate.',
    },
    {
      key: 'visible',
      title: 'Live to employers',
      tone:
        v?.visibilityStatus === 'APPROVED'
          ? 'sage'
          : v?.visibilityStatus === 'REJECTED'
            ? 'terracotta'
            : 'ink',
      state:
        v?.visibilityStatus === 'APPROVED'
          ? 'Approved'
          : v?.visibilityStatus === 'REJECTED'
            ? 'Changes requested'
            : v?.visibilityStatus === 'PENDING_REVIEW'
              ? 'In review'
              : 'Draft',
      detail:
        v?.visibilityStatus === 'APPROVED'
          ? 'You’re part of the marketplace. Shortlists can include you.'
          : 'Your profile becomes visible the moment all checks above are green.',
    },
  ];
}
