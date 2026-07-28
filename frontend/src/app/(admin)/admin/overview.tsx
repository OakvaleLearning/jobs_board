'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AdminShell } from '@/components/dashboard/AdminShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { adminApi } from '@/lib/admin-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export function AdminOverview() {
  const hydrated = useHydratedTokens();

  const kpis = useQuery({
    queryKey: ['adminKpis'],
    queryFn: adminApi.kpis,
    enabled: hydrated,
    refetchInterval: 60_000,
  });

  const data = kpis.data;
  const pending = data?.workers.pendingReview ?? 0;
  const bgPending = data?.workers.backgroundCheckPending ?? 0;
  const activeReplacements = data?.placements.replacementsOpen ?? 0;
  const slaAtRisk = data?.placements.replacementsSlaAtRisk ?? 0;
  const slaBreached = data?.placements.replacementsBreached ?? 0;
  const activeSubs = data?.revenue.activeSubscriptions ?? 0;
  const ndpaMissing = data?.employers.ndpaConsentMissingCorporate ?? 0;

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Internal · agents & admin"
        title="Run the marketplace."
        description="Verification, placements, replacements, and revenue, all live, all in one place."
        actions={
          <Badge tone={slaBreached === 0 && ndpaMissing === 0 ? 'sage' : 'terracotta'}>
            {slaBreached === 0 && ndpaMissing === 0
              ? 'All systems nominal'
              : `${slaBreached} SLA · ${ndpaMissing} NDPA`}
          </Badge>
        }
      />

      <div className="stagger grid md:grid-cols-2 lg:grid-cols-4 gap-5">
        <Kpi label="Pending verification" value={pending} sub="awaiting agent review" />
        <Kpi label="Background docs to review" value={bgPending} sub="awaiting admin review" />
        <Kpi label="Replacements open" value={activeReplacements} sub={`${slaAtRisk} at risk · ${slaBreached} breached`} />
        <Kpi label="Active subscriptions" value={activeSubs} sub="GBP + NGN combined count" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mt-5">
        <Card className="lg:col-span-2">
          <CardEyebrow>Verification queue</CardEyebrow>
          <CardTitle>{pending === 0 ? 'Quiet for now.' : `${pending} worker${pending === 1 ? '' : 's'} waiting.`}</CardTitle>
          <p className="text-sm text-ink-600 mt-3 max-w-xl">
            Workers awaiting review. Approve identity, then review their uploaded background documents (advisory).
          </p>
          <div className="mt-5 flex gap-2">
            <Link href="/admin/verification">
              <Button size="sm">Open queue</Button>
            </Link>
            <Link href="/admin/kpis">
              <Button size="sm" variant="outline">Full KPI dashboard</Button>
            </Link>
          </div>
        </Card>
        <Card>
          <CardEyebrow>Replacements queue</CardEyebrow>
          <CardTitle>{activeReplacements === 0 ? 'None open' : `${activeReplacements} open`}</CardTitle>
          <p className="text-sm text-ink-600 mt-3">
            SLA timers run on business days. Anything under 24h flips red on the board.
          </p>
          <div className="mt-5">
            <Link href="/admin/replacements">
              <Button size="sm" variant="outline">Open board</Button>
            </Link>
          </div>
        </Card>
        <Card>
          <CardEyebrow>Compliance</CardEyebrow>
          <CardTitle>
            {ndpaMissing === 0 ? 'NDPA consents complete' : `${ndpaMissing} NDPA missing`}
          </CardTitle>
          <p className="text-sm text-ink-600 mt-3">
            Corporate employers without recorded NDPA consent cannot legally see worker data.
          </p>
          <div className="mt-5">
            <Link href="/admin/employers">
              <Button size="sm" variant="outline">Employer roster</Button>
            </Link>
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}

function Kpi({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <Card>
      <CardEyebrow>{label}</CardEyebrow>
      <p className="h-display text-4xl text-ink mt-3 tabular-nums">{value}</p>
      <p className="text-xs text-muted mt-1">{sub}</p>
    </Card>
  );
}
