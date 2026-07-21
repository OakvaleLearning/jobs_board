'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/notifications-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export function InboxBell({ inboxHref }: { inboxHref: string }) {
  const hydrated = useHydratedTokens();
  const count = useQuery({
    queryKey: ['unreadCount'],
    queryFn: notificationsApi.unreadCount,
    enabled: hydrated,
    // Rendered in every dashboard shell, so keep this cheap.
    refetchInterval: 60_000,
  });
  const n = count.data ?? 0;
  return (
    <Link
      href={inboxHref}
      className="relative inline-flex items-center justify-center rounded-full border border-ink/12 bg-cream-50 w-9 h-9 hover:bg-cream-100"
      aria-label="Inbox"
      title="Notifications"
    >
      <BellIcon />
      {n > 0 ? (
        <span className="absolute -top-1 -right-1 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-brand-500 text-white text-[10px] font-medium flex items-center justify-center">
          {n > 99 ? '99+' : n}
        </span>
      ) : null}
    </Link>
  );
}

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
