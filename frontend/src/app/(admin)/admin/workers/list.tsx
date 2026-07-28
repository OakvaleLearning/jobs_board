'use client';

import { ClipboardCheck, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AdminShell } from '@/components/dashboard/AdminShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card } from '@/components/ui/Card';
import { Table, THead, TBody, TR, TH, TD, TableEmpty } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { IconButton } from '@/components/ui/IconButton';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { adminApi } from '@/lib/admin-api';

import { VISIBILITY_STATUS, type VisibilityStatus } from '@oakvale/shared/enums/worker';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export function AdminWorkersRoster() {
  const router = useRouter();
  const hydrated = useHydratedTokens();
  const [visibility, setVisibility] = useState<VisibilityStatus | ''>('');
  const [q, setQ] = useState('');

  const list = useQuery({
    queryKey: ['adminWorkersRoster', visibility, q],
    queryFn: () =>
      adminApi.rosters.workers({
        visibility: (visibility || undefined) as VisibilityStatus | undefined,
        q: q || undefined,
      }),
    enabled: hydrated,
  });

  const pager = usePagination(list.data?.data ?? []);

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin · workers"
        title="Workers roster"
        description="The full pipeline: drafts, pending review, verified, suspended. No visibility gate here; this is operations."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              adminApi.exportCsv('workers', {
                visibility: visibility || undefined,
                q: q || undefined,
              })
            }
          >
            Export CSV
          </Button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
          <div className="flex items-end gap-3 flex-1">
            <div className="flex-1 max-w-md">
              <p className="text-eyebrow text-muted">Search</p>
              <Input
                placeholder="Name…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <p className="text-eyebrow text-muted">Visibility</p>
              <Select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as VisibilityStatus | '')}
                className="mt-1 w-auto"
              >
                <option value="">Any</option>
                {VISIBILITY_STATUS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted">{list.data?.meta.total ?? 0} total</p>
        </div>

        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Region</TH>
              <TH>Profile %</TH>
              <TH>Visibility</TH>
              <TH>Submitted</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {pager.pageRows.map((w) => (
              <TR key={w.id} onClick={() => router.push(`/admin/workers/${w.id}`)}>
                <TD>{w.fullName ?? w.id.slice(0, 8)}</TD>
                <TD muted>{w.stateOfOrigin ?? '—'}</TD>
                <TD className="tabular-nums">{w.profileCompletionPct}%</TD>
                <TD>
                  <Badge
                    tone={
                      w.visibilityStatus === 'APPROVED'
                        ? 'sage'
                        : w.visibilityStatus === 'REJECTED' || w.visibilityStatus === 'SUSPENDED'
                          ? 'terracotta'
                          : 'neutral'
                    }
                  >
                    {w.visibilityStatus}
                  </Badge>
                </TD>
                <TD muted>
                  {w.submittedAt ? new Date(w.submittedAt).toLocaleDateString() : '—'}
                </TD>
                <TD>
                  <div className="flex items-center justify-end gap-1">
                    <IconButton
                      icon={Eye}
                      label="View"
                      href={`/admin/workers/${w.id}`}
                      onClick={(e) => e.stopPropagation()}
                    />
                    {w.visibilityStatus === 'PENDING_REVIEW' ? (
                      <IconButton
                        icon={ClipboardCheck}
                        label="Review"
                        href={`/admin/verification/${w.id}`}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : null}
                  </div>
                </TD>
              </TR>
            ))}
            {(list.data?.data ?? []).length === 0 ? (
              <TableEmpty colSpan={6}>No workers match these filters.</TableEmpty>
            ) : null}
          </TBody>
        </Table>
        <Pagination state={pager} />
      </Card>
    </AdminShell>
  );
}
