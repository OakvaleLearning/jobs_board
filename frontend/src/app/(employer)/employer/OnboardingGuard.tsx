'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { employersApi } from '@/lib/employers-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

/**
 * Side-effect-only guard mounted by the employer layout. While onboarding is
 * incomplete (`onboardingCompletedAt` is null), it bounces the employer back
 * into the wizard from any employer page — as soon as they log in and on deep
 * links alike. The onboarding path is excluded to avoid a redirect loop; the
 * wizard itself handles the reverse (completed → dashboard). Shares the
 * `employerProfile` query key, so this adds no extra request.
 */
export function OnboardingGuard(): null {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useHydratedTokens();

  const profile = useQuery({
    queryKey: ['employerProfile'],
    queryFn: employersApi.me,
    enabled: hydrated,
  });

  useEffect(() => {
    if (
      profile.data &&
      !profile.data.onboardingCompletedAt &&
      !pathname.startsWith('/employer/onboarding')
    ) {
      router.replace('/employer/onboarding');
    }
  }, [profile.data, pathname, router]);

  return null;
}
