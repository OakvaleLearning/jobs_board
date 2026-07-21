import { sql } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import type { Currency } from '@oakvale/shared/enums/payment.js';

export type WindowParam = '30d' | '90d';

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

export interface CurrencyDailySeries {
  GBP?: DailyPoint[];
  USD?: DailyPoint[];
  NGN?: DailyPoint[];
}

export interface KpiTimeseries {
  workers: {
    verifiedDaily: DailyPoint[];
    submittedDaily: DailyPoint[];
  };
  placements: {
    activatedDaily: DailyPoint[];
    replacementsOpenedDaily: DailyPoint[];
  };
  revenue: {
    paidMinorDailyByCurrency: CurrencyDailySeries;
  };
  window: WindowParam;
  from: string;
  to: string;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Pure helper: given a sparse `{date,value}[]` and a [from,to] inclusive window,
 * return one point per day in chronological order, with 0 for missing days.
 */
export function padSeries(rows: DailyPoint[], from: Date, to: Date): DailyPoint[] {
  const byDate = new Map<string, number>();
  for (const r of rows) byDate.set(r.date, r.value);
  const out: DailyPoint[] = [];
  const cursor = new Date(from);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setUTCHours(0, 0, 0, 0);
  while (cursor <= end) {
    const k = isoDate(cursor);
    out.push({ date: k, value: byDate.get(k) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function windowDays(w: WindowParam): number {
  return w === '90d' ? 90 : 30;
}

async function dailyCount(sourceSql: ReturnType<typeof sql>, from: Date, to: Date): Promise<DailyPoint[]> {
  const rows = (await db.execute<{ d: string; c: number }>(sourceSql)) as unknown as Array<{
    d: string;
    c: number;
  }>;
  const points: DailyPoint[] = rows.map((r) => ({ date: r.d, value: Number(r.c) }));
  return padSeries(points, from, to);
}

export async function getTimeseries(window: WindowParam): Promise<KpiTimeseries> {
  const days = windowDays(window);
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - days);

  const verifiedDaily = await dailyCount(
    sql`SELECT to_char(date_trunc('day', completed_at), 'YYYY-MM-DD') AS d, COUNT(*)::int AS c
        FROM background_checks
        WHERE status = 'CLEAR' AND completed_at >= now() - interval '${sql.raw(String(days))} days'
        GROUP BY 1 ORDER BY 1`,
    from,
    to,
  );
  const submittedDaily = await dailyCount(
    sql`SELECT to_char(date_trunc('day', submitted_at), 'YYYY-MM-DD') AS d, COUNT(*)::int AS c
        FROM workers
        WHERE submitted_at IS NOT NULL AND submitted_at >= now() - interval '${sql.raw(String(days))} days'
        GROUP BY 1 ORDER BY 1`,
    from,
    to,
  );
  const activatedDaily = await dailyCount(
    sql`SELECT to_char(date_trunc('day', activated_at), 'YYYY-MM-DD') AS d, COUNT(*)::int AS c
        FROM placements
        WHERE activated_at >= now() - interval '${sql.raw(String(days))} days'
        GROUP BY 1 ORDER BY 1`,
    from,
    to,
  );
  const replacementsOpenedDaily = await dailyCount(
    sql`SELECT to_char(date_trunc('day', requested_at), 'YYYY-MM-DD') AS d, COUNT(*)::int AS c
        FROM replacement_requests
        WHERE requested_at >= now() - interval '${sql.raw(String(days))} days'
        GROUP BY 1 ORDER BY 1`,
    from,
    to,
  );

  // Revenue per-currency daily paid totals
  const paidRows = (await db.execute<{ d: string; currency: string; c: number }>(
    sql`SELECT to_char(date_trunc('day', captured_at), 'YYYY-MM-DD') AS d,
              currency,
              COALESCE(SUM(amount_minor), 0)::bigint AS c
       FROM payments
       WHERE status = 'SUCCEEDED' AND captured_at >= now() - interval '${sql.raw(String(days))} days'
       GROUP BY 1, currency
       ORDER BY 1`,
  )) as unknown as Array<{ d: string; currency: string; c: number }>;
  const byCcy: Record<string, DailyPoint[]> = {};
  for (const r of paidRows) {
    if (!byCcy[r.currency]) byCcy[r.currency] = [];
    byCcy[r.currency]!.push({ date: r.d, value: Number(r.c) });
  }
  const paidMinorDailyByCurrency: CurrencyDailySeries = {};
  for (const ccy of ['GBP', 'USD', 'NGN'] as Currency[]) {
    paidMinorDailyByCurrency[ccy] = padSeries(byCcy[ccy] ?? [], from, to);
  }

  return {
    workers: { verifiedDaily, submittedDaily },
    placements: { activatedDaily, replacementsOpenedDaily },
    revenue: { paidMinorDailyByCurrency },
    window,
    from: from.toISOString(),
    to: to.toISOString(),
  };
}
