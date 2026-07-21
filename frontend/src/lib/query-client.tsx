'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { hydrateTokens } from './api-client';
import { Toaster } from '@/components/ui/Toast';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => {
    // Eagerly hydrate tokens before any query can fire (no-op on the server).
    hydrateTokens();
    return new QueryClient({
      defaultOptions: {
        queries: { staleTime: 30_000, refetchOnWindowFocus: false },
      },
    });
  });
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
