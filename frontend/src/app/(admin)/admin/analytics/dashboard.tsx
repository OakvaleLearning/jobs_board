'use client';

import { useQuery } from '@tanstack/react-query';
import { AdminShell } from '@/components/dashboard/AdminShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Stat } from '@/components/ui/Stat';
import { adminApi, type FunnelStage } from '@/lib/admin-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export function AdminAnalyticsDashboard() {
  const hydrated = useHydratedTokens();
  const analytics = useQuery({
    queryKey: ['adminAnalytics'],
    queryFn: adminApi.analytics,
    enabled: hydrated,
    refetchInterval: 60_000,
  });

  const data = analytics.data;
  const ttp = data?.timeToPlacement;

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin · analytics"
        title="Pipeline & conversion"
        description={
          data
            ? `Refreshed ${new Date(data.generatedAt).toLocaleTimeString()}`
            : 'Funnel, time-to-placement, and placement success rates.'
        }
      />

      {!data ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardEyebrow>Worker conversion funnel</CardEyebrow>
            <CardTitle>From registration to placement</CardTitle>
            <div className="mt-6 space-y-3">
              {data.funnel.map((s, i) => (
                <FunnelBar key={s.stage} stage={s} isFirst={i === 0} />
              ))}
            </div>
          </Card>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            <Stat
              label="Median time to placement"
              value={ttp?.medianDays != null ? `${ttp.medianDays}d` : '—'}
              sub={ttp?.sample ? `across ${ttp.sample} activated placements` : 'no activated placements yet'}
            />
            <Stat
              label="Average time to placement"
              value={ttp?.avgDays != null ? `${ttp.avgDays}d` : '—'}
              sub="match created → activated"
            />
            <Stat
              label="Shortlist → placement"
              value={`${data.successRates.shortlistToPlacementPct}%`}
              sub="shortlists that led to a selection"
              tone="sage"
            />
            <Stat
              label="Offer → acceptance"
              value={`${data.successRates.offerToAcceptancePct}%`}
              sub="sent offers accepted by workers"
              tone="sage"
            />
          </div>
        </div>
      )}
    </AdminShell>
  );
}

function FunnelBar({ stage, isFirst }: { stage: FunnelStage; isFirst: boolean }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-ink font-medium">{stage.stage}</span>
        <span className="text-muted tabular-nums">
          {stage.count.toLocaleString()}
          {!isFirst ? (
            <span className="ml-2 text-xs">
              {stage.pctOfTop}% of top · {stage.pctOfPrev}% step
            </span>
          ) : null}
        </span>
      </div>
      <div className="mt-1.5 h-3 rounded-full bg-ink/5 overflow-hidden">
        <div
          className="h-full rounded-full bg-brand-500 transition-all"
          style={{ width: `${Math.max(2, stage.pctOfTop)}%` }}
        />
      </div>
    </div>
  );
}
