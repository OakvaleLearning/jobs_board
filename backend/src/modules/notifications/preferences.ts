import { and, eq } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import { notificationPreferences } from '@/shared/db/schema.js';
import { AppError } from '@/shared/errors/app-error.js';
import {
  isForcedKind,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_KINDS,
  type NotificationChannel,
  type NotificationKind,
} from '@oakvale/shared/enums/notifications.js';

export interface PreferenceRow {
  kind: NotificationKind;
  channel: NotificationChannel;
  enabled: boolean;
  digestMode: 'immediate' | 'daily';
  forced: boolean;
}

/**
 * Pure helper used by the worker enqueue path AND the test suite.
 * `disabledMap` is `${kind}:${channel}` → `false` (disabled). Anything missing defaults enabled.
 * Forced kinds always return true regardless of disabledMap.
 */
export function shouldEnqueue(
  kind: string,
  channel: NotificationChannel,
  disabledMap: ReadonlySet<string>,
): boolean {
  if (isForcedKind(kind)) return true;
  return !disabledMap.has(`${kind}:${channel}`);
}

export async function loadDisabledMap(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({
      kind: notificationPreferences.kind,
      channel: notificationPreferences.channel,
      enabled: notificationPreferences.enabled,
    })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId));
  const set = new Set<string>();
  for (const r of rows) {
    if (!r.enabled) set.add(`${r.kind}:${r.channel}`);
  }
  return set;
}

/**
 * Returns the digest mode for a given user/kind/channel, defaulting to 'immediate'.
 * Forced kinds are always 'immediate'.
 */
export async function loadDigestMode(
  userId: string,
  kind: string,
  channel: NotificationChannel,
): Promise<'immediate' | 'daily'> {
  if (isForcedKind(kind)) return 'immediate';
  const rows = await db
    .select({ digestMode: notificationPreferences.digestMode })
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.kind, kind),
        eq(notificationPreferences.channel, channel),
      ),
    )
    .limit(1);
  return rows[0]?.digestMode === 'daily' ? 'daily' : 'immediate';
}

export async function listForUser(userId: string): Promise<PreferenceRow[]> {
  const rows = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId));
  const byKey = new Map(rows.map((r) => [`${r.kind}:${r.channel}`, r]));
  const out: PreferenceRow[] = [];
  for (const kind of NOTIFICATION_KINDS) {
    for (const channel of NOTIFICATION_CHANNELS) {
      const forced = isForcedKind(kind);
      const existing = byKey.get(`${kind}:${channel}`);
      const enabled = forced ? true : existing ? existing.enabled : true;
      const digestMode =
        forced || channel !== 'EMAIL'
          ? 'immediate'
          : existing?.digestMode === 'daily'
            ? 'daily'
            : 'immediate';
      out.push({ kind, channel, enabled, digestMode, forced });
    }
  }
  return out;
}

export interface PreferenceUpdate {
  kind: NotificationKind;
  channel: NotificationChannel;
  enabled: boolean;
  digestMode?: 'immediate' | 'daily';
}

export async function applyUpdates(userId: string, updates: PreferenceUpdate[]): Promise<void> {
  for (const u of updates) {
    if (isForcedKind(u.kind) && !u.enabled) {
      throw new AppError({
        code: 'FORCED_KIND_CANNOT_BE_DISABLED',
        message: `Kind ${u.kind} cannot be disabled.`,
        statusCode: 400,
      });
    }
    if (isForcedKind(u.kind) && u.digestMode === 'daily') {
      throw new AppError({
        code: 'FORCED_KIND_CANNOT_BE_DISABLED',
        message: `Kind ${u.kind} must remain immediate.`,
        statusCode: 400,
      });
    }
  }
  for (const u of updates) {
    await db
      .insert(notificationPreferences)
      .values({
        userId,
        kind: u.kind,
        channel: u.channel,
        enabled: u.enabled,
        digestMode: u.digestMode ?? null,
      })
      .onConflictDoUpdate({
        target: [
          notificationPreferences.userId,
          notificationPreferences.kind,
          notificationPreferences.channel,
        ],
        set: {
          enabled: u.enabled,
          ...(u.digestMode !== undefined ? { digestMode: u.digestMode } : {}),
          updatedAt: new Date(),
        },
      });
  }
}
