'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AdminShell } from '@/components/dashboard/AdminShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Table, THead, TBody, TR, TH, TD, TableEmpty } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { TextLink } from '@/components/ui/Link';
import { Badge } from '@/components/ui/Badge';
import { placementsApi, type Placement } from '@/lib/placements-api';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { adminApi } from '@/lib/admin-api';
import { PLACEMENT_STATUSES, PIPELINE_TYPES, type PipelineType, type PlacementStatus } from '@oakvale/shared/enums/placement';
import { cn } from '@/lib/cn';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export function AdminPlacementBoard() {
  const router = useRouter();
  const hydrated = useHydratedTokens();
  const [status, setStatus] = useState<PlacementStatus | ''>('');
  const [pipeline, setPipeline] = useState<PipelineType | ''>('');

  const q = useQuery({
    queryKey: ['adminPlacements', { status, pipeline }],
    queryFn: () =>
      placementsApi.adminList({
        status: (status || undefined) as PlacementStatus | undefined,
        pipeline: (pipeline || undefined) as PipelineType | undefined,
      }),
    enabled: hydrated,
    refetchInterval: 30_000,
  });

  const pager = usePagination<Placement>(q.data?.data ?? []);

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin · placements"
        title="Placement board."
        description="Every placement across both pipelines. Click through to log welfare checks, activate, or end a placement."
        actions={
          <div className="flex items-center gap-2">
            <Badge tone="neutral">{q.data?.meta.total ?? 0} total</Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => adminApi.exportCsv('placements', {})}
            >
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 mb-5">
        <Filter label="All statuses" value="" current={status} onSelect={() => setStatus('')} />
        {PLACEMENT_STATUSES.map((s) => (
          <Filter key={s} label={s.toLowerCase()} value={s} current={status} onSelect={() => setStatus(s)} />
        ))}
        <span className="w-3" />
        <Filter label="All pipelines" value="" current={pipeline} onSelect={() => setPipeline('')} />
        {PIPELINE_TYPES.map((p) => (
          <Filter key={p} label={p.toLowerCase()} value={p} current={pipeline} onSelect={() => setPipeline(p)} />
        ))}
      </div>

      <Table>
        <THead>
          <TR>
            <TH>Placement</TH>
            <TH>Pipeline</TH>
            <TH>Status</TH>
            <TH>Activated</TH>
            <TH>Guarantee</TH>
          </TR>
        </THead>
        <TBody>
          {pager.pageRows.map((p: Placement) => (
            <TR key={p.id} onClick={() => router.push(`/admin/placements/${p.id}`)}>
              <TD>
                <TextLink
                  href={`/admin/placements/${p.id}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {p.id.slice(0, 8)}
                </TextLink>
              </TD>
              <TD>{p.pipelineType.toLowerCase()}</TD>
              <TD>
                <Badge tone={statusTone(p.status)}>{p.status.replace('_', ' ').toLowerCase()}</Badge>
              </TD>
              <TD muted>
                {p.activatedAt ? new Date(p.activatedAt).toLocaleDateString() : '—'}
              </TD>
              <TD muted>
                {p.guaranteeExpiresAt ? new Date(p.guaranteeExpiresAt).toLocaleDateString() : '—'}
              </TD>
            </TR>
          ))}
          {(q.data?.data ?? []).length === 0 ? (
            <TableEmpty colSpan={5}>No placements match these filters.</TableEmpty>
          ) : null}
        </TBody>
      </Table>
      <Pagination state={pager} className="mt-4" />
    </AdminShell>
  );
}

function Filter({
  label,
  value,
  current,
  onSelect,
}: {
  label: string;
  value: string;
  current: string;
  onSelect: () => void;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'rounded-full px-3 py-1 text-xs uppercase tracking-widish transition',
        active ? 'bg-ink text-cream-50' : 'bg-ink/5 text-ink-600 hover:bg-ink/10',
      )}
    >
      {label}
    </button>
  );
}

function statusTone(s: PlacementStatus): 'sage' | 'terracotta' | 'neutral' | 'ink' {
  if (s === 'ACTIVE') return 'sage';
  if (s === 'SUSPENDED' || s === 'TERMINATED') return 'terracotta';
  if (s === 'PENDING_PAYMENT') return 'ink';
  return 'neutral';
}
