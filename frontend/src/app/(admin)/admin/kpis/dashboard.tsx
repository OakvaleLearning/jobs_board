'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AdminShell } from '@/components/dashboard/AdminShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Stat } from '@/components/ui/Stat';
import { Sparkline } from '@/components/ui/Sparkline';
import { adminApi, type KpiSnapshot } from '@/lib/admin-api';
import { formatMoney } from '@/lib/payments-api';
import type { Currency } from '@oakvale/shared/enums/payment';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export function AdminKpiDashboard() {
  const hydrated = useHydratedTokens();
  const [window, setWindow] = useState<'30d' | '90d'>('30d');

  const kpis = useQuery({
    queryKey: ['adminKpis'],
    queryFn: adminApi.kpis,
    enabled: hydrated,
    refetchInterval: 60_000,
  });

  const series = useQuery({
    queryKey: ['adminKpiTimeseries', window],
    queryFn: () => adminApi.kpisTimeseries(window),
    enabled: hydrated,
  });

  const activatedSeries = (series.data?.placements.activatedDaily ?? []).map((p) => p.value);
  const replacementsSeries = (series.data?.placements.replacementsOpenedDaily ?? []).map((p) => p.value);
  const paidByCcy = series.data?.revenue.paidMinorDailyByCurrency ?? {};

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin · KPIs"
        title="Operating dashboard"
        description={
          kpis.data
            ? `Refreshed ${new Date(kpis.data.generatedAt).toLocaleTimeString()}`
            : 'Live numbers across workers, employers, placements, and money.'
        }
        actions={
          <div className="inline-flex rounded-full border border-ink/10 bg-cream-50 overflow-hidden text-xs">
            {(['30d', '90d'] as const).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWindow(w)}
                className={`px-3 py-1.5 ${
                  window === w ? 'bg-brand-500 text-white' : 'text-muted hover:text-ink'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        }
      />

      {!kpis.data ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <div className="space-y-8">
          <WorkersSection data={kpis.data.workers} />
          <EmployersSection data={kpis.data.employers} />
          <PlacementsSection
            data={kpis.data.placements}
            activatedSeries={activatedSeries}
            replacementsSeries={replacementsSeries}
          />
          <RevenueSection data={kpis.data.revenue} paidByCcy={paidByCcy} />
        </div>
      )}
    </AdminShell>
  );
}

function WorkersSection({ data }: { data: KpiSnapshot['workers'] }) {
  return (
    <Card>
      <CardEyebrow>Workers</CardEyebrow>
      <CardTitle>{data.total} on the platform</CardTitle>
      <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Visible to employers" value={data.visible} tone="sage" />
        <Stat label="Pending review" value={data.pendingReview} />
        <Stat label="Approved" value={data.approved} />
        <Stat label="Drafts" value={data.draft} />
        <Stat label="Bg-check clear" value={data.backgroundCheckClear} />
        <Stat label="Bg-check pending" value={data.backgroundCheckPending} />
        <Stat
          label="Profile completion p50 / p90"
          value={`${data.profileCompletion.p50}% · ${data.profileCompletion.p90}%`}
          sub={`${data.profileCompletion.under50pct} workers under 50%`}
        />
        <Stat label="Suspended" value={data.suspended} tone={data.suspended > 0 ? 'terracotta' : 'neutral'} />
      </div>
    </Card>
  );
}

function EmployersSection({ data }: { data: KpiSnapshot['employers'] }) {
  return (
    <Card>
      <CardEyebrow>Employers</CardEyebrow>
      <CardTitle>{data.total} signed up</CardTitle>
      <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Diaspora" value={data.individualEmployer} />
        <Stat label="Corporate" value={data.corporate} />
        <Stat label="Onboarded" value={data.onboarded} tone="sage" />
        <Stat label="Active subscription" value={data.withActiveSubscription} tone="sage" />
        <Stat
          label="NDPA consent missing (corporate)"
          value={data.ndpaConsentMissingCorporate}
          tone={data.ndpaConsentMissingCorporate > 0 ? 'terracotta' : 'sage'}
          sub="Cannot legally view worker data until resolved"
        />
      </div>
    </Card>
  );
}

function PlacementsSection({
  data,
  activatedSeries,
  replacementsSeries,
}: {
  data: KpiSnapshot['placements'];
  activatedSeries: number[];
  replacementsSeries: number[];
}) {
  const breachRate = data.replacementsOpen > 0
    ? Math.round((data.replacementsBreached / data.replacementsOpen) * 100)
    : 0;
  return (
    <Card>
      <CardEyebrow>Placements</CardEyebrow>
      <CardTitle>{data.total} all-time</CardTitle>
      <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Active" value={data.byStatus['ACTIVE'] ?? 0} tone="sage" />
        <Stat label="Pending payment" value={data.byStatus['PENDING_PAYMENT'] ?? 0} />
        <Stat label="Suspended" value={data.byStatus['SUSPENDED'] ?? 0} tone={data.byStatus['SUSPENDED'] ? 'terracotta' : 'neutral'} />
        <Stat label="Completed" value={data.byStatus['COMPLETED'] ?? 0} />
        <Stat
          label="Activated · last 30d"
          value={data.activatedLast30d}
          sub={<Sparkline series={activatedSeries} className="text-sage-700" />}
        />
        <Stat label="Completed · last 30d" value={data.completedLast30d} />
        <Stat label="Terminated · last 30d" value={data.terminatedLast30d} />
        <Stat label="Welfare checks due ≤7d" value={data.welfareChecksDueSoon} />
        <Stat
          label="Replacements open"
          value={data.replacementsOpen}
          sub={<Sparkline series={replacementsSeries} className="text-terracotta-700" />}
        />
        <Stat label="SLA at risk (<24h)" value={data.replacementsSlaAtRisk} tone={data.replacementsSlaAtRisk > 0 ? 'terracotta' : 'neutral'} />
        <Stat
          label="SLA breached"
          value={data.replacementsBreached}
          tone={breachRate > 15 ? 'terracotta' : data.replacementsBreached > 0 ? 'terracotta' : 'sage'}
          sub={`${breachRate}% of open requests`}
        />
      </div>
    </Card>
  );
}

function RevenueSection({
  data,
  paidByCcy,
}: {
  data: KpiSnapshot['revenue'];
  paidByCcy: Partial<Record<Currency, Array<{ date: string; value: number }>>>;
}) {
  const currencies: Currency[] = ['GBP', 'USD', 'NGN'];
  return (
    <Card>
      <CardEyebrow>Revenue · isolated by ledger</CardEyebrow>
      <CardTitle>{data.activeSubscriptions} active subscriptions</CardTitle>
      <p className="text-xs text-muted mt-2">
        Stripe (GBP/USD) and Paystack (NGN) ledgers are tracked separately. No FX conversion — ever.
      </p>

      <div className="mt-6 space-y-6">
        <RevenueRow label="Total billed" bucket={data.totalBilledMinor} currencies={currencies} />
        <RevenueRow
          label="Paid · last 30d"
          bucket={data.paidLast30dMinor}
          currencies={currencies}
          tone="sage"
          seriesByCcy={paidByCcy}
        />
        <RevenueRow label="Refunded · last 30d" bucket={data.refundedLast30dMinor} currencies={currencies} tone="terracotta" />
        <RevenueRow label="MRR (from subscription invoices)" bucket={data.mrrMinor} currencies={['GBP', 'NGN']} />
      </div>
    </Card>
  );
}

function RevenueRow({
  label,
  bucket,
  currencies,
  tone = 'neutral',
  seriesByCcy,
}: {
  label: string;
  bucket: Partial<Record<Currency, number>>;
  currencies: Currency[];
  tone?: 'neutral' | 'sage' | 'terracotta';
  seriesByCcy?: Partial<Record<Currency, Array<{ date: string; value: number }>>>;
}) {
  return (
    <div>
      <p className="text-eyebrow text-muted">{label}</p>
      <div className="mt-2 grid sm:grid-cols-3 gap-3">
        {currencies.map((c) => (
          <Stat
            key={c}
            label={c}
            value={formatMoney(bucket[c] ?? 0, c)}
            tone={tone}
            sub={
              seriesByCcy?.[c] ? (
                <Sparkline
                  series={seriesByCcy[c]!.map((p) => p.value)}
                  className={tone === 'sage' ? 'text-sage-700' : 'text-ink'}
                />
              ) : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
