'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { EmployerShell } from '@/components/dashboard/EmployerShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { placementsApi } from '@/lib/placements-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';
import { useEmployerConfig } from '@/lib/use-employer-config';

export default function BillingSuccessPage() {
  const params = useSearchParams();
  const router = useRouter();
  const placementId = params.get('placementId');
  const hydrated = useHydratedTokens();
  const config = useEmployerConfig();

  const detail = useQuery({
    queryKey: ['placementDetail', placementId],
    queryFn: () => placementsApi.detail(placementId!),
    enabled: hydrated && !!placementId,
    // Poll until the payment webhook flips the placement to ACTIVE, then stop.
    refetchInterval: (query) =>
      query.state.data?.placement.status === 'ACTIVE' ? false : 3_000,
  });

  useEffect(() => {
    if (detail.data?.placement.status === 'ACTIVE') {
      const t = setTimeout(() => router.push('/employer/placement'), 1200);
      return () => clearTimeout(t);
    }
  }, [detail.data?.placement.status, router]);

  return (
    <EmployerShell config={config}>
      <PageHeader eyebrow="Checkout complete" title="Thank you." />
      <Card>
        <CardEyebrow>Confirming payment</CardEyebrow>
        <CardTitle>
          {detail.data?.placement.status === 'ACTIVE'
            ? 'Placement activated.'
            : 'Waiting for confirmation…'}
        </CardTitle>
        <p className="text-sm text-ink-600 mt-3 max-w-xl">
          We&rsquo;re waiting for Stripe to confirm the payment. This usually takes a few seconds.
          You&rsquo;ll be redirected to your placement page automatically.
        </p>
        <p className="text-xs text-muted mt-6">
          Not redirected?{' '}
          <Link
            href="/employer/placement"
            className="underline underline-offset-4"
          >
            Go to your placement
          </Link>
          .
        </p>
      </Card>
    </EmployerShell>
  );
}
