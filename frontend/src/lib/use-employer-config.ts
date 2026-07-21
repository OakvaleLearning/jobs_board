'use client';

import { useQuery } from '@tanstack/react-query';
import { employersApi, type EmployerTypeConfig } from './employers-api';
import { useHydratedTokens } from './use-hydrated-tokens';

/**
 * Resolves the current employer's configurable type config (§5). Shares the
 * `employerProfile` query cache, so it is free to call alongside an existing
 * profile query. Drives the config-driven `EmployerShell` nav.
 */
export function useEmployerConfig(): EmployerTypeConfig | null {
  const hydrated = useHydratedTokens();
  const profile = useQuery({
    queryKey: ['employerProfile'],
    queryFn: employersApi.me,
    enabled: hydrated,
  });
  return profile.data?.employerTypeConfig ?? null;
}
