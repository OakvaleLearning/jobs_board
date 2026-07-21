'use client';

import { useQuery } from '@tanstack/react-query';
import { DashboardShell, PageHeader } from '@/components/dashboard/Shell';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { downloadBlob } from '@/lib/api-client';

function downloadPlacementPdf(placementId: string) {
  const filename = `placement_${placementId.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.pdf`;
  return downloadBlob(`/placements/${placementId}/record.pdf`, filename);
}
import { placementsApi, type Placement } from '@/lib/placements-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';
import { WORKER_NAV } from '@/lib/worker-nav';

export function WorkerPlacements() {
  const hydrated = useHydratedTokens();

  const q = useQuery({
    queryKey: ['workerPlacements'],
    queryFn: placementsApi.me,
    enabled: hydrated,
  });

  const active = (q.data ?? []).filter((p) => p.status === 'ACTIVE' || p.status === 'SUSPENDED');
  const past = (q.data ?? []).filter((p) => p.status === 'COMPLETED' || p.status === 'TERMINATED');
  const upcoming = (q.data ?? []).filter(
    (p) => p.status === 'PENDING_PAYMENT' || p.status === 'SELECTED',
  );

  return (
    <DashboardShell surface="Worker portal" nav={WORKER_NAV}>
      <PageHeader
        eyebrow="Worker · placements"
        title="Where you’re working."
        description="Active assignments, upcoming activations, and a record of past placements."
        actions={<Badge tone="neutral">{q.data?.length ?? 0} on file</Badge>}
      />

      <div className="space-y-10">
        <Section title="Active" items={active} emptyMessage="No active placements." />
        <Section title="Upcoming" items={upcoming} emptyMessage="Nothing in the pipeline yet." />
        <Section title="History" items={past} emptyMessage="No completed placements yet." />
      </div>
    </DashboardShell>
  );
}

function Section({
  title,
  items,
  emptyMessage,
}: {
  title: string;
  items: Placement[];
  emptyMessage: string;
}) {
  return (
    <section className="space-y-4">
      <p className="text-eyebrow text-muted">{title}</p>
      {items.length === 0 ? (
        <Card className="text-muted text-sm">{emptyMessage}</Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {items.map((p) => (
            <PlacementCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </section>
  );
}

function PlacementCard({ p }: { p: Placement }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <CardEyebrow>{p.pipelineType.toLowerCase()} · placement</CardEyebrow>
        <Badge tone={statusTone(p.status)}>{p.status.replace('_', ' ').toLowerCase()}</Badge>
      </div>
      <CardTitle>
        {p.activatedAt
          ? `Active since ${new Date(p.activatedAt).toLocaleDateString()}`
          : p.status === 'PENDING_PAYMENT'
            ? 'Awaiting activation'
            : 'Selected'}
      </CardTitle>
      <ul className="mt-4 space-y-1 text-sm text-ink-600">
        {p.guaranteeExpiresAt ? (
          <li>Guarantee through {new Date(p.guaranteeExpiresAt).toLocaleDateString()}</li>
        ) : null}
        {p.endedAt ? (
          <li>
            Ended {new Date(p.endedAt).toLocaleDateString()}
            {p.endReason ? ` · ${p.endReason}` : ''}
          </li>
        ) : null}
      </ul>
      {p.status === 'SUSPENDED' ? (
        <p className="text-xs text-terracotta-700 mt-4">
          This placement is suspended pending an Oakvale safeguarding review.
        </p>
      ) : null}
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => downloadPlacementPdf(p.id)}
          className="text-xs text-muted hover:text-ink underline underline-offset-4"
        >
          Download record (PDF)
        </button>
      </div>
    </Card>
  );
}

function statusTone(s: string): 'sage' | 'terracotta' | 'neutral' | 'ink' {
  switch (s) {
    case 'ACTIVE':
      return 'sage';
    case 'SUSPENDED':
    case 'TERMINATED':
      return 'terracotta';
    case 'COMPLETED':
      return 'neutral';
    default:
      return 'ink';
  }
}
