'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { EmployerShell } from '@/components/dashboard/EmployerShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { employersApi } from '@/lib/employers-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export function IndividualEmployerOverview() {
  const hydrated = useHydratedTokens();

  const profile = useQuery({
    queryKey: ['employerProfile'],
    queryFn: employersApi.me,
    enabled: hydrated,
  });

  const needs = profile.data?.individualEmployerNeedsAssessment as
    | { careRecipientName?: string; relationship?: string; urgencyLevel?: string; accommodationType?: string }
    | null
    | undefined;

  return (
    <EmployerShell config={profile.data?.employerTypeConfig}>
      <PageHeader
        eyebrow="Diaspora caregiving"
        title="Care, arranged from anywhere."
        description="Edit the care assessment, browse credentialed workers, and prepare for your shortlist."
        actions={
          needs?.careRecipientName ? (
            <Badge tone="sage">Assessment on file</Badge>
          ) : (
            <Badge tone="terracotta">Assessment missing</Badge>
          )
        }
      />

      <div className="stagger grid lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <CardEyebrow>Care recipient</CardEyebrow>
          <CardTitle>{needs?.careRecipientName ?? 'Not added yet'}</CardTitle>
          {needs?.relationship ? (
            <p className="text-sm text-ink-600 mt-3">
              {needs.relationship} · {(needs.accommodationType ?? '').replace('_', ' ').toLowerCase()} ·
              {' '}urgency {(needs.urgencyLevel ?? '').toLowerCase()}
            </p>
          ) : (
            <p className="text-sm text-ink-600 mt-3">
              We can&rsquo;t build a shortlist without the care assessment. Should take 8 minutes.
            </p>
          )}
          <div className="mt-5">
            <Link href="/employer/needs-assessment">
              <Button size="sm">{needs?.careRecipientName ? 'Edit assessment' : 'Start assessment'}</Button>
            </Link>
          </div>
        </Card>

        <Card>
          <CardEyebrow>Worker pool</CardEyebrow>
          <CardTitle>Browse credentialed carers</CardTitle>
          <p className="text-sm text-ink-600 mt-3">
            Only verified + CPD-certified workers appear. No PII beyond name, state, skills, and credentials.
          </p>
          <div className="mt-5">
            <Link href="/employer/workers">
              <Button size="sm" variant="outline">Open worker browse</Button>
            </Link>
          </div>
        </Card>

        <Card>
          <CardEyebrow>Payment</CardEyebrow>
          <CardTitle>GBP / USD via Stripe</CardTitle>
          <p className="text-sm text-ink-600 mt-3">
            You pay Oakvale UK. Workers are paid in NGN by Oakvale Nigeria. No conversions, no
            confusion.
          </p>
        </Card>

        <Card>
          <CardEyebrow>Guarantee</CardEyebrow>
          <CardTitle>90-day replacement</CardTitle>
          <p className="text-sm text-ink-600 mt-3">
            If the placement isn&rsquo;t working out within 90 days, we replace at no additional fee, on a 5
            business-day SLA.
          </p>
        </Card>

        <Card>
          <CardEyebrow>Welfare</CardEyebrow>
          <CardTitle>Monthly written report</CardTitle>
          <p className="text-sm text-ink-600 mt-3">
            Our liaison nurse checks in monthly and sends you a written summary.
          </p>
        </Card>
      </div>
    </EmployerShell>
  );
}
