'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { paymentsApi } from '@/lib/payments-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export function SubscribeBanner({ surface }: { surface: string }) {
  const hydrated = useHydratedTokens();

  const sub = useQuery({
    queryKey: ['employerSubscription'],
    queryFn: paymentsApi.subscription,
    enabled: hydrated,
  });

  if (!hydrated) return null;
  if (sub.data?.status === 'ACTIVE') return null;

  return (
    <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-sage-200 bg-sage-50/40 px-5 py-4">
      <div>
        <p className="text-eyebrow text-muted">
          Annual subscription
        </p>
        <p className="text-sm text-ink mt-1">
          Unlock priority {surface} access, faster SLAs, and richer dashboards.
        </p>
      </div>
      <Link
        href="/employer/billing"
        className="rounded-full bg-brand-500 text-white px-4 py-2 text-xs uppercase tracking-wide hover:bg-brand-600 transition"
      >
        Subscribe
      </Link>
    </div>
  );
}
