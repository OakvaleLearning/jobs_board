'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, CheckCheck, Mail, MessageSquare } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { notificationsApi, type NotificationRow } from '@/lib/notifications-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';
import { cn } from '@/lib/cn';
import {
  TONE_AVATAR_CLASSES,
  iconForKind,
  labelForKind,
  toneForKind,
} from '@/lib/notification-display';

function relative(date: string): string {
  const t = new Date(date).getTime();
  const diffMs = Date.now() - t;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const CHANNEL_ICONS: Record<string, LucideIcon> = {
  EMAIL: Mail,
  SMS: MessageSquare,
  IN_APP: Bell,
};

const CHANNEL_LABELS: Record<string, string> = {
  EMAIL: 'Email',
  SMS: 'SMS',
  IN_APP: 'In-app',
};

type InboxData = { data: NotificationRow[]; meta: { total: number; page: number; limit: number } };

export function InboxView() {
  const queryClient = useQueryClient();
  const hydrated = useHydratedTokens();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['inbox', unreadOnly],
    queryFn: () => notificationsApi.list({ unreadOnly }),
    enabled: hydrated,
  });

  const rows = list.data?.data ?? [];
  const unreadCount = rows.filter((n) => n.status !== 'READ').length;

  // Flip the given rows to READ in the cache so they stay in the table (just restyled) rather than
  // being refetched away — while the unread counters (this badge + the header bell) decrement.
  const markReadInCache = (ids: string[] | 'all') => {
    const now = new Date().toISOString();
    queryClient.setQueryData<InboxData>(['inbox', unreadOnly], (prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        data: prev.data.map((n) =>
          ids === 'all' || ids.includes(n.id)
            ? { ...n, status: 'READ', readAt: n.readAt ?? now }
            : n,
        ),
      };
    });
    queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
  };

  const markRead = useMutation({
    mutationFn: (ids: string[]) => notificationsApi.markRead(ids),
    onSuccess: (_data, ids) => markReadInCache(ids),
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => markReadInCache('all'),
  });

  const selected = selectedId ? rows.find((n) => n.id === selectedId) ?? null : null;

  const openDetail = (n: NotificationRow) => {
    setSelectedId(n.id);
    if (n.status !== 'READ' && !markRead.isPending) markRead.mutate([n.id]);
  };

  return (
    <Card variant="glass">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <CardEyebrow>Inbox</CardEyebrow>
          <CardTitle className="flex items-center gap-2">
            Notifications
            {unreadCount > 0 ? (
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-sage-500 px-2 text-xs font-semibold text-white">
                {unreadCount}
              </span>
            ) : null}
          </CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full border border-ink/10 bg-cream-50 p-0.5 text-xs">
            {([
              ['All', false],
              ['Unread', true],
            ] as const).map(([label, val]) => (
              <button
                key={label}
                type="button"
                onClick={() => setUnreadOnly(val)}
                className={cn(
                  'rounded-full px-3 py-1.5 font-medium transition-colors',
                  unreadOnly === val ? 'bg-ink text-cream-50' : 'text-muted hover:text-ink',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending || unreadCount === 0}
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-ink/8">
        <table className="w-full text-sm">
          <thead className="bg-cream-50 text-eyebrow text-muted">
            <tr>
              <th className="w-8 px-3 py-3" aria-label="Status" />
              <th className="text-left px-3 py-3 font-medium">Type</th>
              <th className="text-left px-3 py-3 font-medium">Subject</th>
              <th className="text-left px-3 py-3 font-medium">Channel</th>
              <th className="text-right px-4 py-3 font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {list.isLoading ? (
              <SkeletonRows />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-0">
                  <EmptyState unreadOnly={unreadOnly} />
                </td>
              </tr>
            ) : (
              rows.map((n) => (
                <NotificationRowItem key={n.id} n={n} onOpen={() => openDetail(n)} />
              ))
            )}
          </tbody>
        </table>
      </div>

      <NotificationModal notification={selected} onClose={() => setSelectedId(null)} />
    </Card>
  );
}

function NotificationRowItem({ n, onOpen }: { n: NotificationRow; onOpen: () => void }) {
  const unread = n.status !== 'READ';
  const Icon = iconForKind(n.kind);
  const ChannelIcon = CHANNEL_ICONS[n.channel] ?? Bell;

  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        'cursor-pointer border-t border-ink/8 transition-colors',
        unread ? 'bg-sage-50/50 hover:bg-sage-50' : 'bg-white hover:bg-cream-50',
      )}
    >
      <td className="px-3 py-3 align-middle">
        {unread ? (
          <span className="mx-auto block h-2 w-2 rounded-full bg-sage-500" aria-label="Unread" />
        ) : null}
      </td>
      <td className="px-3 py-3 align-middle">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              TONE_AVATAR_CLASSES[toneForKind(n.kind)],
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
          <span className={cn('whitespace-nowrap', unread ? 'font-semibold text-ink' : 'text-ink-600')}>
            {labelForKind(n.kind)}
          </span>
        </div>
      </td>
      <td className="px-3 py-3 align-middle">
        <p className={cn('max-w-xs truncate', unread ? 'text-ink' : 'text-ink-600')}>
          {n.subject ?? '—'}
        </p>
      </td>
      <td className="px-3 py-3 align-middle">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted">
          <ChannelIcon className="h-3.5 w-3.5" />
          {CHANNEL_LABELS[n.channel] ?? n.channel}
        </span>
      </td>
      <td className="px-4 py-3 align-middle text-right text-xs text-muted whitespace-nowrap">
        {relative(n.createdAt)}
      </td>
    </tr>
  );
}

function NotificationModal({
  notification: n,
  onClose,
}: {
  notification: NotificationRow | null;
  onClose: () => void;
}) {
  const ChannelIcon = n ? CHANNEL_ICONS[n.channel] ?? Bell : Bell;
  return (
    <Modal
      open={n !== null}
      onClose={onClose}
      size="lg"
      title={n ? labelForKind(n.kind) : undefined}
      description={n?.subject ?? undefined}
    >
      {n ? (
        <div className="space-y-5 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={n.status === 'READ' ? 'neutral' : 'sage'}>{n.status}</Badge>
            <Badge tone="neutral">
              <ChannelIcon className="h-3 w-3" />
              {CHANNEL_LABELS[n.channel] ?? n.channel}
            </Badge>
          </div>

          {n.body ? (
            <div>
              <p className="text-label text-muted">Message</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink-600">{n.body}</p>
            </div>
          ) : null}

          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MetaField label="Created" value={new Date(n.createdAt).toLocaleString()} />
            <MetaField label="Sent" value={n.sentAt ? new Date(n.sentAt).toLocaleString() : '—'} />
            <MetaField label="Read" value={n.readAt ? new Date(n.readAt).toLocaleString() : '—'} />
          </dl>

          {n.payload && Object.keys(n.payload).length > 0 ? (
            <div>
              <p className="text-label text-muted">Details</p>
              <pre className="mt-1 overflow-x-auto rounded-xl border border-ink/8 bg-cream-50 p-3 text-xs text-ink-600">
                {JSON.stringify(n.payload, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-label text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}

function EmptyState({ unreadOnly }: { unreadOnly: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink/5 text-muted">
        <BellOff className="h-6 w-6" />
      </span>
      <p className="text-sm font-medium text-ink">
        {unreadOnly ? 'No unread notifications' : 'Your inbox is empty'}
      </p>
      <p className="max-w-xs text-xs text-muted">
        {unreadOnly
          ? 'You’re all caught up. Nothing waiting on you right now.'
          : 'Placement updates, invoice reminders, and account events will appear here.'}
      </p>
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-t border-ink/8">
          <td className="px-3 py-3">
            <span className="mx-auto block h-2 w-2 animate-pulse rounded-full bg-ink/10" />
          </td>
          <td className="px-3 py-3">
            <div className="flex items-center gap-2.5">
              <span className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-ink/5" />
              <span className="block h-3 w-24 animate-pulse rounded bg-ink/5" />
            </div>
          </td>
          <td className="px-3 py-3">
            <span className="block h-3 w-40 animate-pulse rounded bg-ink/5" />
          </td>
          <td className="px-3 py-3">
            <span className="block h-3 w-16 animate-pulse rounded bg-ink/5" />
          </td>
          <td className="px-4 py-3">
            <span className="ml-auto block h-3 w-12 animate-pulse rounded bg-ink/5" />
          </td>
        </tr>
      ))}
    </>
  );
}
