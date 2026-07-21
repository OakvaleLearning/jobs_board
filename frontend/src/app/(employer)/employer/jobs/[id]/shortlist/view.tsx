'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { EmployerShell } from '@/components/dashboard/EmployerShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { SubscribeBanner } from '@/components/ui/SubscribeBanner';
import { Card } from '@/components/ui/Card';
import { placementsApi } from '@/lib/placements-api';
import { ShortlistDetailView } from '@/app/(employer)/employer/shortlist/[id]/detail';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';
import { useEmployerConfig } from '@/lib/use-employer-config';

export function CorporateJobShortlist({ jobId }: { jobId: string }) {
  const hydrated = useHydratedTokens();
  const config = useEmployerConfig();

  const all = useQuery({
    queryKey: ['employerShortlists'],
    queryFn: placementsApi.employerShortlists,
    enabled: hydrated,
  });

  const latest = (all.data ?? [])
    .filter((s) => s.jobPostingId === jobId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];

  if (!hydrated || all.isLoading) {
    return (
      <EmployerShell config={config}>
        <p className="text-muted">Loading…</p>
      </EmployerShell>
    );
  }

  if (!latest) {
    return (
      <EmployerShell config={config}>
        <PageHeader
          eyebrow="Corporate · shortlist"
          title="No shortlist yet."
          description="Once an Oakvale agent generates a shortlist for this job posting, it will appear here."
          actions={
            <Link
              href={`/employer/jobs/${jobId}`}
              className="text-sm text-muted hover:text-ink underline underline-offset-4"
            >
              Back to job
            </Link>
          }
        />
        <SubscribeBanner surface="priority shortlist" />
        <Card className="text-muted">
          The agent generates shortlists from the workforce assessment. Reach out to your placement coordinator if you’re ready.
        </Card>
      </EmployerShell>
    );
  }

  return (
    <>
      <ShortlistDetailView id={latest.id} />
    </>
  );
}
