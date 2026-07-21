'use client';

import { useEffect, useState } from 'react';
import { hydrateTokens } from './api-client';

/**
 * Hydrates auth tokens from localStorage once on mount and returns true when
 * done. Gate TanStack queries with `enabled: hydrated` so the first fetch
 * carries the Authorization header.
 */
export function useHydratedTokens(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    hydrateTokens();
    setHydrated(true);
  }, []);
  return hydrated;
}
