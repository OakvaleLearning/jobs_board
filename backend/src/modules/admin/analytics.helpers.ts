/** Pure analytics helpers (no DB access) — unit-tested in analytics.test.ts. */

export interface FunnelStage {
  stage: string;
  count: number;
  /** Share of the top-of-funnel cohort, 0–100. */
  pctOfTop: number;
  /** Conversion from the immediately preceding stage, 0–100 (100 for the first stage). */
  pctOfPrev: number;
}

/** Percentage of numerator/denominator, rounded to one decimal; 0 when denominator is 0. */
export function pct(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/** Build funnel stages from ordered [label, count] pairs, adding the % conversions. */
export function buildFunnel(stages: { stage: string; count: number }[]): FunnelStage[] {
  const top = stages[0]?.count ?? 0;
  return stages.map((s, i) => {
    const prev = i === 0 ? s.count : stages[i - 1]!.count;
    return {
      stage: s.stage,
      count: s.count,
      pctOfTop: pct(s.count, top),
      pctOfPrev: i === 0 ? 100 : pct(s.count, prev),
    };
  });
}
