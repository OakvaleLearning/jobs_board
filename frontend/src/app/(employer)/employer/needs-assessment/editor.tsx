'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { EmployerShell } from '@/components/dashboard/EmployerShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { employersApi } from '@/lib/employers-api';
import { IndividualEmployerNeedsStep } from '@/app/(employer)/employer/onboarding/steps/individual-employer-needs';
import { CorporateNeedsStep } from '@/app/(employer)/employer/onboarding/steps/corporate-needs';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export function NeedsAssessmentEditor() {
  const router = useRouter();
  const hydrated = useHydratedTokens();

  const q = useQuery({
    queryKey: ['employerProfile'],
    queryFn: employersApi.me,
    enabled: hydrated,
  });

  const config = q.data?.employerTypeConfig ?? null;

  if (!q.data) {
    return (
      <EmployerShell config={config}>
        <p className="text-muted">Loading…</p>
      </EmployerShell>
    );
  }

  const usesIndividualEmployer = config?.usesIndividualEmployerNeeds ?? true;

  return (
    <EmployerShell config={config}>
      <PageHeader
        eyebrow={usesIndividualEmployer ? 'Care assessment' : 'Workforce needs'}
        title={usesIndividualEmployer ? 'Care recipient assessment.' : 'Workforce needs assessment.'}
        description="Keep this up to date — we re-shortlist based on changes."
      />
      {usesIndividualEmployer ? (
        <IndividualEmployerNeedsStep profile={q.data} onNext={() => router.push('/employer/dashboard')} />
      ) : (
        <CorporateNeedsStep profile={q.data} onNext={() => router.push('/employer/dashboard')} />
      )}
    </EmployerShell>
  );
}
