'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { EmployerShell } from '@/components/dashboard/EmployerShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { employersApi } from '@/lib/employers-api';
import { paymentsApi } from '@/lib/payments-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export function CorporateOverview() {
  const hydrated = useHydratedTokens();

  const profile = useQuery({
    queryKey: ['employerProfile'],
    queryFn: employersApi.me,
    enabled: hydrated,
  });
  const jobs = useQuery({
    queryKey: ['employerJobs'],
    queryFn: employersApi.listJobPostings,
    enabled: hydrated && profile.data?.onboardingCompletedAt != null,
  });
  const subscription = useQuery({
    queryKey: ['employerSubscription'],
    queryFn: paymentsApi.subscription,
    enabled: hydrated,
  });

  const needs = profile.data?.corporateNeedsAssessment as
    | { numStaffRequired?: number; hoursOfOperation?: string }
    | null
    | undefined;

  const openJobs = (jobs.data ?? []).filter((j) => j.status === 'OPEN').length;
  const subStatus = subscription.data?.status;
  const subLabel = subStatus
    ? subStatus.charAt(0) + subStatus.slice(1).toLowerCase()
    : '—';

  return (
    <EmployerShell config={profile.data?.employerTypeConfig}>
      <PageHeader
        eyebrow="Corporate crèche"
        title="A workforce that&rsquo;s already trained."
        description="Manage NDPA consent, job postings, and worker browse, all under a credentialed marketplace."
        actions={
          profile.data?.ndpaConsentGiven ? (
            <Badge tone="sage">NDPA consent on file</Badge>
          ) : (
            <Badge tone="terracotta">NDPA consent missing</Badge>
          )
        }
      />

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
        <Kpi label="Open job postings" value={String(openJobs)} sub="open to candidates" />
        <Kpi label="Staff sized for" value={String(needs?.numStaffRequired ?? 0)} sub="from workforce assessment" />
        <Kpi label="Hours of operation" value={needs?.hoursOfOperation ?? '—'} sub="" />
        <Kpi label="Subscription" value={subLabel} sub="NGN annual partnership" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mt-5">
        <Card className="lg:col-span-2">
          <CardEyebrow>Job postings</CardEyebrow>
          <CardTitle>{(jobs.data ?? []).length === 0 ? 'No postings yet.' : `${(jobs.data ?? []).length} on file`}</CardTitle>
          <p className="text-sm text-ink-600 mt-3 max-w-xl">
            Post a job to receive a shortlist of credentialed caregivers. Postings can be edited or closed at any time.
          </p>
          <div className="mt-5 flex gap-3">
            <Link href="/employer/jobs">
              <Button size="sm">Manage postings</Button>
            </Link>
            <Link href="/employer/workers">
              <Button size="sm" variant="outline">Browse workers</Button>
            </Link>
          </div>
        </Card>

        <Card>
          <CardEyebrow>Compliance</CardEyebrow>
          <CardTitle>NDPA 2023</CardTitle>
          <p className="text-sm text-ink-600 mt-3">
            {profile.data?.ndpaConsentGiven
              ? `Recorded ${new Date(profile.data.ndpaConsentTimestamp ?? Date.now()).toLocaleString()}.`
              : 'Required before viewing any worker data. Complete onboarding to record it.'}
          </p>
        </Card>

        <Card>
          <CardEyebrow>Payment</CardEyebrow>
          <CardTitle>NGN via Paystack</CardTitle>
          <p className="text-sm text-ink-600 mt-3">
            30-day net invoices. Annual subscription includes CPD-refresh tracking for placed workers.
          </p>
        </Card>
      </div>
    </EmployerShell>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardEyebrow>{label}</CardEyebrow>
      <p className="h-display text-4xl text-ink mt-3 tabular-nums">{value}</p>
      {sub ? <p className="text-xs text-muted mt-1">{sub}</p> : null}
    </Card>
  );
}
