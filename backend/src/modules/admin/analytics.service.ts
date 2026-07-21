import { sql } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import { visibilityGateSql } from '@/modules/compliance/visibility.js';
import { buildFunnel, pct, type FunnelStage } from './analytics.helpers.js';

/**
 * §14.2 advanced analytics — the conversion funnel, time-to-placement, and
 * placement success rates the operational KPI snapshot doesn't cover.
 */

export interface TimeToPlacement {
  /** Activated placements considered. */
  sample: number;
  avgDays: number | null;
  medianDays: number | null;
}

export interface SuccessRates {
  shortlistToPlacementPct: number;
  offerToAcceptancePct: number;
}

export interface AnalyticsSnapshot {
  funnel: FunnelStage[];
  timeToPlacement: TimeToPlacement;
  successRates: SuccessRates;
  generatedAt: string;
}

export async function getAnalytics(): Promise<AnalyticsSnapshot> {
  const [funnelCounts, ttp, rates] = await Promise.all([
    funnelCountsQuery(),
    timeToPlacementQuery(),
    successRatesQuery(),
  ]);
  return {
    funnel: buildFunnel(funnelCounts),
    timeToPlacement: ttp,
    successRates: rates,
    generatedAt: new Date().toISOString(),
  };
}

async function funnelCountsQuery(): Promise<{ stage: string; count: number }[]> {
  const rows = await db.execute<{
    registered: number;
    profile70: number;
    approved: number;
    visible: number;
    applied: number;
    placed: number;
  }>(sql`
    SELECT
      COUNT(*)::int AS registered,
      COUNT(*) FILTER (WHERE profile_completion_pct >= 70)::int AS profile70,
      COUNT(*) FILTER (WHERE visibility_status = 'APPROVED')::int AS approved,
      COUNT(*) FILTER (WHERE ${visibilityGateSql(sql.raw('workers.id'))})::int AS visible,
      (SELECT COUNT(DISTINCT worker_id)::int FROM job_applications) AS applied,
      (SELECT COUNT(DISTINCT worker_id)::int FROM placements) AS placed
    FROM workers
    WHERE deleted_at IS NULL
  `);
  const r = rows[0];
  return [
    { stage: 'Registered', count: r?.registered ?? 0 },
    { stage: 'Profile ≥70%', count: r?.profile70 ?? 0 },
    { stage: 'Verified', count: r?.approved ?? 0 },
    { stage: 'Visible to employers', count: r?.visible ?? 0 },
    { stage: 'Applied', count: r?.applied ?? 0 },
    { stage: 'Placed', count: r?.placed ?? 0 },
  ];
}

async function timeToPlacementQuery(): Promise<TimeToPlacement> {
  const rows = await db.execute<{
    sample: number;
    avg_days: number | null;
    median_days: number | null;
  }>(sql`
    SELECT
      COUNT(*)::int AS sample,
      AVG(EXTRACT(EPOCH FROM (activated_at - created_at)) / 86400) AS avg_days,
      PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (activated_at - created_at)) / 86400
      ) AS median_days
    FROM placements
    WHERE activated_at IS NOT NULL
  `);
  const r = rows[0];
  return {
    sample: r?.sample ?? 0,
    avgDays: r?.avg_days == null ? null : Math.round(Number(r.avg_days) * 10) / 10,
    medianDays: r?.median_days == null ? null : Math.round(Number(r.median_days) * 10) / 10,
  };
}

async function successRatesQuery(): Promise<SuccessRates> {
  const rows = await db.execute<{
    shortlists_total: number;
    shortlists_placed: number;
    offers_sent: number;
    offers_accepted: number;
  }>(sql`
    SELECT
      (SELECT COUNT(*)::int FROM shortlists) AS shortlists_total,
      (SELECT COUNT(*)::int FROM shortlists WHERE selected_worker_id IS NOT NULL) AS shortlists_placed,
      (SELECT COUNT(*)::int FROM placement_offers WHERE status <> 'DRAFT') AS offers_sent,
      (SELECT COUNT(*)::int FROM placement_offers WHERE status = 'ACCEPTED') AS offers_accepted
  `);
  const r = rows[0];
  return {
    shortlistToPlacementPct: pct(r?.shortlists_placed ?? 0, r?.shortlists_total ?? 0),
    offerToAcceptancePct: pct(r?.offers_accepted ?? 0, r?.offers_sent ?? 0),
  };
}
