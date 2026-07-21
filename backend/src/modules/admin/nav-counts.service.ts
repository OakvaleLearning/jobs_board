import { sql } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import { AppError } from '@/shared/errors/app-error.js';
import { ADMIN_NAV_KEYS, type AdminNavKey } from '@oakvale/shared/enums/admin.js';

export type NavCounts = Record<AdminNavKey, number>;

const NAV_KEY_SET = new Set<string>(ADMIN_NAV_KEYS);

function assertNavKey(key: string): AdminNavKey {
  if (!NAV_KEY_SET.has(key)) {
    throw new AppError({
      code: 'VALIDATION_ERROR',
      message: `Unknown admin nav key: ${key}`,
      statusCode: 400,
    });
  }
  return key as AdminNavKey;
}

/**
 * For each admin-sidebar queue, count the *pending* entries that arrived after this
 * admin last opened that queue (their `admin_nav_seen.last_seen_at`, or epoch if they
 * have never opened it). This is the "new since last visit" delta the sidebar bubbles
 * render — it clears to 0 when the admin clicks the link (markNavSeen) and reappears
 * only when newer entries land.
 *
 * Read-only aggregate over many domain tables, mirroring kpis.service — see that file
 * for the same cross-table reporting pattern used across the admin module.
 */
export async function getNavCounts(adminUserId: string): Promise<NavCounts> {
  // `seen(key)` returns this admin's last-seen timestamp for a queue, or epoch.
  const rows = await db.execute<Record<AdminNavKey, number>>(sql`
    WITH s AS (
      SELECT nav_key, last_seen_at
      FROM admin_nav_seen
      WHERE admin_user_id = ${adminUserId}
    )
    SELECT
      (SELECT COUNT(*)::int FROM verification_requests
         WHERE status IN ('SUBMITTED','IN_REVIEW')
           AND COALESCE(submitted_at, created_at) >
               COALESCE((SELECT last_seen_at FROM s WHERE nav_key = 'verification'), 'epoch'::timestamptz)
      ) AS "verification",
      (SELECT COUNT(*)::int FROM employers
         WHERE verification_status = 'PENDING'
           AND COALESCE(verification_submitted_at, created_at) >
               COALESCE((SELECT last_seen_at FROM s WHERE nav_key = 'employer-verification'), 'epoch'::timestamptz)
      ) AS "employer-verification",
      (SELECT COUNT(*)::int FROM background_checks
         WHERE status = 'PENDING'
           AND COALESCE(submitted_at, created_at) >
               COALESCE((SELECT last_seen_at FROM s WHERE nav_key = 'background-checks'), 'epoch'::timestamptz)
      ) AS "background-checks",
      (SELECT COUNT(*)::int FROM certifications
         WHERE verification_status = 'PENDING'
           AND created_at >
               COALESCE((SELECT last_seen_at FROM s WHERE nav_key = 'certifications'), 'epoch'::timestamptz)
      ) AS "certifications",
      (SELECT COUNT(*)::int FROM job_postings
         WHERE status = 'PENDING_REVIEW'
           AND created_at >
               COALESCE((SELECT last_seen_at FROM s WHERE nav_key = 'job-review'), 'epoch'::timestamptz)
      ) AS "job-review",
      (SELECT COUNT(*)::int FROM placement_offers
         WHERE status = 'AGENT_REVIEW'
           AND created_at >
               COALESCE((SELECT last_seen_at FROM s WHERE nav_key = 'offers'), 'epoch'::timestamptz)
      ) AS "offers",
      (SELECT COUNT(*)::int FROM interviews
         WHERE status = 'REQUESTED'
           AND created_at >
               COALESCE((SELECT last_seen_at FROM s WHERE nav_key = 'interviews'), 'epoch'::timestamptz)
      ) AS "interviews",
      (SELECT COUNT(*)::int FROM complaints
         WHERE status NOT IN ('RESOLVED','CLOSED')
           AND created_at >
               COALESCE((SELECT last_seen_at FROM s WHERE nav_key = 'complaints'), 'epoch'::timestamptz)
      ) AS "complaints",
      (SELECT COUNT(*)::int FROM messages
         WHERE flagged_for_review = true AND reviewed_at IS NULL
           AND created_at >
               COALESCE((SELECT last_seen_at FROM s WHERE nav_key = 'messaging'), 'epoch'::timestamptz)
      ) AS "messaging",
      (SELECT COUNT(*)::int FROM replacement_requests
         WHERE status = 'OPEN'
           AND created_at >
               COALESCE((SELECT last_seen_at FROM s WHERE nav_key = 'replacements'), 'epoch'::timestamptz)
      ) AS "replacements",
      (SELECT COUNT(*)::int FROM welfare_escalations
         WHERE resolved_at IS NULL
           AND created_at >
               COALESCE((SELECT last_seen_at FROM s WHERE nav_key = 'welfare-escalations'), 'epoch'::timestamptz)
      ) AS "welfare-escalations",
      (SELECT COUNT(*)::int FROM contracts
         WHERE type = 'ANNUAL_PARTNERSHIP' AND status = 'FULLY_EXECUTED'
           AND expires_at IS NOT NULL
           AND expires_at > now()
           AND expires_at <= now() + interval '60 days'
           AND (expires_at - interval '60 days') >
               COALESCE((SELECT last_seen_at FROM s WHERE nav_key = 'contracts-renewals'), 'epoch'::timestamptz)
      ) AS "contracts-renewals",
      (SELECT COUNT(*)::int FROM compliance_flags
         WHERE resolved_at IS NULL
           AND COALESCE(raised_at, created_at) >
               COALESCE((SELECT last_seen_at FROM s WHERE nav_key = 'compliance-flags'), 'epoch'::timestamptz)
      ) AS "compliance-flags"
  `);

  const r = rows[0];
  const out = {} as NavCounts;
  for (const key of ADMIN_NAV_KEYS) out[key] = r?.[key] ?? 0;
  return out;
}

/**
 * Mark a queue as seen by this admin (upsert `last_seen_at = now()`), clearing its
 * sidebar bubble. Synced per admin, so clearing on one device carries to another.
 */
export async function markNavSeen(adminUserId: string, navKey: string): Promise<void> {
  const key = assertNavKey(navKey);
  await db.execute(sql`
    INSERT INTO admin_nav_seen (admin_user_id, nav_key, last_seen_at)
    VALUES (${adminUserId}, ${key}, now())
    ON CONFLICT (admin_user_id, nav_key)
    DO UPDATE SET last_seen_at = now(), updated_at = now()
  `);
}
