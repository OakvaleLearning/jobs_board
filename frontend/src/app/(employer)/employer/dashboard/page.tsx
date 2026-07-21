'use client';

import { useQuery } from '@tanstack/react-query';
import { employersApi } from '@/lib/employers-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';
import { IndividualEmployerOverview } from './individual-employer-overview';
import { CorporateOverview } from './corporate-overview';

/**
 * Generic employer dashboard (§5). Picks the overview by the configurable
 * type's derived flags — job-posting types get the corporate-style overview,
 * account-managed types get the individual-employer one. A brand-new type falls back
 * to the corporate overview until it has a bespoke one.
 */
export default function EmployerDashboardPage() {
  const hydrated = useHydratedTokens();
  const profile = useQuery({
    queryKey: ['employerProfile'],
    queryFn: employersApi.me,
    enabled: hydrated,
  });

  const config = profile.data?.employerTypeConfig;
  if (config?.usesIndividualEmployerNeeds || config?.isAccountManaged) {
    return <IndividualEmployerOverview />;
  }
  return <CorporateOverview />;
}
