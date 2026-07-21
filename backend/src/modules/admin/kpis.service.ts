import { sql } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import { visibilityGateSql } from '@/modules/compliance/visibility.js';
import type { Currency } from '@oakvale/shared/enums/payment.js';

type CurrencyBucket = Partial<Record<Currency, number>>;

export interface WorkerKpis {
  total: number;
  draft: number;
  pendingReview: number;
  approved: number;
  rejected: number;
  suspended: number;
  visible: number;
  backgroundCheckClear: number;
  backgroundCheckPending: number;
  profileCompletion: { p50: number; p90: number; under50pct: number };
}

export interface EmployerKpis {
  total: number;
  individualEmployer: number;
  corporate: number;
  onboarded: number;
  withActiveSubscription: number;
  ndpaConsentMissingCorporate: number;
}

export interface PlacementKpis {
  total: number;
  byStatus: Record<string, number>;
  activatedLast30d: number;
  completedLast30d: number;
  terminatedLast30d: number;
  replacementsOpen: number;
  replacementsSlaAtRisk: number;
  replacementsBreached: number;
  welfareChecksDueSoon: number;
}

export interface RevenueKpis {
  totalBilledMinor: CurrencyBucket;
  paidLast30dMinor: CurrencyBucket;
  refundedLast30dMinor: CurrencyBucket;
  mrrMinor: CurrencyBucket;
  activeSubscriptions: number;
}

export interface KpiSnapshot {
  workers: WorkerKpis;
  employers: EmployerKpis;
  placements: PlacementKpis;
  revenue: RevenueKpis;
  generatedAt: string;
}

export async function getKpis(): Promise<KpiSnapshot> {
  const [workers, employers, placements, revenue] = await Promise.all([
    workerKpis(),
    employerKpis(),
    placementKpis(),
    revenueKpis(),
  ]);
  return {
    workers,
    employers,
    placements,
    revenue,
    generatedAt: new Date().toISOString(),
  };
}

async function workerKpis(): Promise<WorkerKpis> {
  const rows = await db.execute<{
    total: number;
    draft: number;
    pending_review: number;
    approved: number;
    rejected: number;
    suspended: number;
    visible: number;
    bg_clear: number;
    bg_pending: number;
    p50: number | null;
    p90: number | null;
    under50: number;
  }>(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE visibility_status = 'DRAFT')::int AS draft,
      COUNT(*) FILTER (WHERE visibility_status = 'PENDING_REVIEW')::int AS pending_review,
      COUNT(*) FILTER (WHERE visibility_status = 'APPROVED')::int AS approved,
      COUNT(*) FILTER (WHERE visibility_status = 'REJECTED')::int AS rejected,
      COUNT(*) FILTER (WHERE visibility_status = 'SUSPENDED')::int AS suspended,
      COUNT(*) FILTER (WHERE ${visibilityGateSql(sql.raw('workers.id'))})::int AS visible,
      (SELECT COUNT(*)::int FROM background_checks WHERE status = 'CLEAR') AS bg_clear,
      (SELECT COUNT(*)::int FROM background_checks WHERE status IN ('PENDING','IN_PROGRESS')) AS bg_pending,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY profile_completion_pct)::int AS p50,
      PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY profile_completion_pct)::int AS p90,
      COUNT(*) FILTER (WHERE profile_completion_pct < 50)::int AS under50
    FROM workers
    WHERE deleted_at IS NULL
  `);
  const r = rows[0];
  return {
    total: r?.total ?? 0,
    draft: r?.draft ?? 0,
    pendingReview: r?.pending_review ?? 0,
    approved: r?.approved ?? 0,
    rejected: r?.rejected ?? 0,
    suspended: r?.suspended ?? 0,
    visible: r?.visible ?? 0,
    backgroundCheckClear: r?.bg_clear ?? 0,
    backgroundCheckPending: r?.bg_pending ?? 0,
    profileCompletion: {
      p50: r?.p50 ?? 0,
      p90: r?.p90 ?? 0,
      under50pct: r?.under50 ?? 0,
    },
  };
}

async function employerKpis(): Promise<EmployerKpis> {
  const rows = await db.execute<{
    total: number;
    individual_employer: number;
    corporate: number;
    onboarded: number;
    with_sub: number;
    ndpa_missing: number;
  }>(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE employer_type = 'INDIVIDUAL_EMPLOYER')::int AS individual_employer,
      COUNT(*) FILTER (WHERE employer_type = 'CORPORATE')::int AS corporate,
      COUNT(*) FILTER (WHERE onboarding_completed_at IS NOT NULL)::int AS onboarded,
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM subscriptions s WHERE s.employer_id = employers.id AND s.status = 'ACTIVE'
      ))::int AS with_sub,
      COUNT(*) FILTER (WHERE employer_type = 'CORPORATE' AND ndpa_consent_given = false)::int AS ndpa_missing
    FROM employers
  `);
  const r = rows[0];
  return {
    total: r?.total ?? 0,
    individualEmployer: r?.individual_employer ?? 0,
    corporate: r?.corporate ?? 0,
    onboarded: r?.onboarded ?? 0,
    withActiveSubscription: r?.with_sub ?? 0,
    ndpaConsentMissingCorporate: r?.ndpa_missing ?? 0,
  };
}

async function placementKpis(): Promise<PlacementKpis> {
  const statusRows = await db.execute<{ status: string; count: number }>(sql`
    SELECT status::text AS status, COUNT(*)::int AS count FROM placements GROUP BY status
  `);
  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const r of statusRows) {
    byStatus[r.status] = r.count;
    total += r.count;
  }

  const rangeRows = await db.execute<{
    activated_30: number;
    completed_30: number;
    terminated_30: number;
    welfare_due: number;
  }>(sql`
    SELECT
      (SELECT COUNT(*)::int FROM placements WHERE activated_at >= now() - interval '30 days') AS activated_30,
      (SELECT COUNT(*)::int FROM placements WHERE status = 'COMPLETED' AND ended_at >= now() - interval '30 days') AS completed_30,
      (SELECT COUNT(*)::int FROM placements WHERE status = 'TERMINATED' AND ended_at >= now() - interval '30 days') AS terminated_30,
      (SELECT COUNT(*)::int FROM welfare_checks WHERE completed_at IS NULL AND scheduled_at IS NOT NULL AND scheduled_at <= now() + interval '7 days') AS welfare_due
  `);
  const rg = rangeRows[0];

  const replRows = await db.execute<{
    open: number;
    at_risk: number;
    breached: number;
  }>(sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'OPEN')::int AS open,
      COUNT(*) FILTER (WHERE status = 'OPEN' AND sla_deadline > now() AND sla_deadline < now() + interval '24 hours')::int AS at_risk,
      COUNT(*) FILTER (WHERE status = 'OPEN' AND sla_deadline <= now())::int AS breached
    FROM replacement_requests
  `);
  const rp = replRows[0];

  return {
    total,
    byStatus,
    activatedLast30d: rg?.activated_30 ?? 0,
    completedLast30d: rg?.completed_30 ?? 0,
    terminatedLast30d: rg?.terminated_30 ?? 0,
    replacementsOpen: rp?.open ?? 0,
    replacementsSlaAtRisk: rp?.at_risk ?? 0,
    replacementsBreached: rp?.breached ?? 0,
    welfareChecksDueSoon: rg?.welfare_due ?? 0,
  };
}

async function revenueKpis(): Promise<RevenueKpis> {
  const billedRows = await db.execute<{ currency: string; sum: number }>(sql`
    SELECT currency, COALESCE(SUM(amount_minor), 0)::bigint AS sum FROM invoices GROUP BY currency
  `);
  const paidRows = await db.execute<{ currency: string; sum: number }>(sql`
    SELECT currency, COALESCE(SUM(amount_minor), 0)::bigint AS sum
    FROM payments
    WHERE status = 'SUCCEEDED' AND captured_at >= now() - interval '30 days'
    GROUP BY currency
  `);
  const refundedRows = await db.execute<{ currency: string; sum: number }>(sql`
    SELECT currency, COALESCE(SUM(amount_minor), 0)::bigint AS sum
    FROM payments
    WHERE status = 'REFUNDED' AND updated_at >= now() - interval '30 days'
    GROUP BY currency
  `);
  const mrrRows = await db.execute<{ currency: string; sum: number }>(sql`
    SELECT i.currency, COALESCE(SUM(i.amount_minor) / 12, 0)::bigint AS sum
    FROM invoices i
    INNER JOIN subscriptions s ON s.id = i.subscription_id
    WHERE i.purpose = 'SUBSCRIPTION' AND s.status = 'ACTIVE'
    GROUP BY i.currency
  `);
  const activeSubRows = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*)::int AS count FROM subscriptions WHERE status = 'ACTIVE'
  `);

  const intoBucket = (rows: { currency: string; sum: number }[]): CurrencyBucket => {
    const out: CurrencyBucket = {};
    for (const r of rows) {
      out[r.currency as Currency] = Number(r.sum);
    }
    return out;
  };

  return {
    totalBilledMinor: intoBucket(billedRows as unknown as { currency: string; sum: number }[]),
    paidLast30dMinor: intoBucket(paidRows as unknown as { currency: string; sum: number }[]),
    refundedLast30dMinor: intoBucket(refundedRows as unknown as { currency: string; sum: number }[]),
    mrrMinor: intoBucket(mrrRows as unknown as { currency: string; sum: number }[]),
    activeSubscriptions: activeSubRows[0]?.count ?? 0,
  };
}
