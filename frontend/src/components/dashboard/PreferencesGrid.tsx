'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Lock, Mail, MessageSquare } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';
import { toastApiError } from '@/lib/toast';
import { notificationsApi, type PreferenceRow } from '@/lib/notifications-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';
import { cn } from '@/lib/cn';
import {
  NOTIFICATION_CATEGORIES,
  TONE_AVATAR_CLASSES,
  labelForKind,
  type NotificationTone,
} from '@/lib/notification-display';
import {
  NOTIFICATION_CHANNELS,
  type NotificationChannel,
} from '@oakvale/shared/enums/notifications';

const CHANNEL_META: Record<NotificationChannel, { label: string; icon: LucideIcon }> = {
  EMAIL: { label: 'Email', icon: Mail },
  SMS: { label: 'SMS', icon: MessageSquare },
  IN_APP: { label: 'In-app', icon: Bell },
};

interface PrefUpdate {
  kind: string;
  channel: NotificationChannel;
  enabled: boolean;
  digestMode?: 'immediate' | 'daily';
}

export function PreferencesGrid() {
  const queryClient = useQueryClient();
  const hydrated = useHydratedTokens();

  const prefs = useQuery({
    queryKey: ['notificationPreferences'],
    queryFn: notificationsApi.getPreferences,
    enabled: hydrated,
  });

  const save = useMutation({
    mutationFn: (u: PrefUpdate) => notificationsApi.updatePreferences([u]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationPreferences'] });
    },
    onError: (e) => toastApiError(e, 'Could not save preference.'),
  });

  // `${kind}:${channel}` → row, plus the set of kinds the backend actually returned for this user.
  const matrix = new Map<string, PreferenceRow>();
  const presentKinds = new Set<string>();
  for (const row of prefs.data ?? []) {
    matrix.set(`${row.kind}:${row.channel}`, row);
    presentKinds.add(row.kind);
  }

  const groups = NOTIFICATION_CATEGORIES.map((c) => ({
    title: c.title,
    icon: c.icon,
    tone: c.tone,
    kinds: c.kinds.filter((k) => presentKinds.has(k)),
  })).filter((c) => c.kinds.length > 0);

  const categorised = new Set(NOTIFICATION_CATEGORIES.flatMap((c) => c.kinds));
  const otherKinds = [...presentKinds].filter((k) => !categorised.has(k));
  if (otherKinds.length > 0) {
    groups.push({ title: 'Other', icon: Bell, tone: 'neutral', kinds: otherKinds });
  }

  return (
    <Card variant="glass">
      <CardEyebrow>Notification preferences</CardEyebrow>
      <CardTitle>Choose what we send you, and where.</CardTitle>
      <p className="mt-3 max-w-xl text-sm text-ink-600">
        Safety, legal, and admin escalations cannot be disabled. They’ll always reach you in the appropriate channel.
      </p>

      <div className="mt-6 space-y-6">
        {groups.map((group) => (
          <PreferenceSection
            key={group.title}
            title={group.title}
            icon={group.icon}
            tone={group.tone}
            kinds={group.kinds}
            matrix={matrix}
            pending={save.isPending}
            onChange={(u) => save.mutate(u)}
          />
        ))}
      </div>
    </Card>
  );
}

function PreferenceSection({
  title,
  icon: Icon,
  tone,
  kinds,
  matrix,
  pending,
  onChange,
}: {
  title: string;
  icon: LucideIcon;
  tone: NotificationTone;
  kinds: string[];
  matrix: Map<string, PreferenceRow>;
  pending: boolean;
  onChange: (u: PrefUpdate) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-ink/8">
      <header className="flex items-center gap-3 border-b border-ink/8 bg-cream-50 px-4 py-3">
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', TONE_AVATAR_CLASSES[tone])}>
          <Icon className="h-4 w-4" />
        </span>
        <h4 className="text-sm font-semibold text-ink">{title}</h4>
      </header>

      <ul className="divide-y divide-ink/8">
        {kinds.map((kind) => (
          <li
            key={kind}
            className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-sm text-ink">{labelForKind(kind)}</p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {NOTIFICATION_CHANNELS.map((channel) => {
                const row = matrix.get(`${kind}:${channel}`);
                if (!row) return null;
                const meta = CHANNEL_META[channel];
                if (row.forced) {
                  return (
                    <span
                      key={channel}
                      className="inline-flex items-center gap-1.5 text-xs text-muted"
                      title="Required, cannot be disabled"
                    >
                      <meta.icon className="h-3.5 w-3.5" />
                      <Lock className="h-3 w-3" />
                    </span>
                  );
                }
                return (
                  <div key={channel} className="flex flex-col items-center gap-1">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                      <meta.icon className="h-3.5 w-3.5" />
                      {meta.label}
                    </span>
                    <Switch
                      size="sm"
                      checked={row.enabled}
                      disabled={pending}
                      aria-label={`${meta.label} for ${labelForKind(kind)}`}
                      onChange={(checked) =>
                        onChange({ kind, channel, enabled: checked, digestMode: row.digestMode })
                      }
                    />
                    {channel === 'EMAIL' && row.enabled ? (
                      <label className="flex items-center gap-1 text-[10px] text-muted" title="Send a daily digest instead of immediate emails">
                        <input
                          type="checkbox"
                          className="h-3 w-3 accent-ink"
                          checked={row.digestMode === 'daily'}
                          disabled={pending}
                          onChange={(e) =>
                            onChange({
                              kind,
                              channel,
                              enabled: row.enabled,
                              digestMode: e.target.checked ? 'daily' : 'immediate',
                            })
                          }
                        />
                        digest
                      </label>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
