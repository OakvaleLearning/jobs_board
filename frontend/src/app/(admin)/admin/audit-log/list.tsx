'use client';

import { Eye, EyeOff } from 'lucide-react';
import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AdminShell } from '@/components/dashboard/AdminShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card } from '@/components/ui/Card';
import { Table, THead, TBody, TR, TH, TD, TableEmpty } from '@/components/ui/Table';
import { IconButton } from '@/components/ui/IconButton';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { adminApi } from '@/lib/admin-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export function AdminAuditLog() {
  const hydrated = useHydratedTokens();
  const [action, setAction] = useState('');
  const [targetType, setTargetType] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['adminAuditLog', action, targetType],
    queryFn: () =>
      adminApi.auditLog({
        action: action || undefined,
        targetType: targetType || undefined,
      }),
    enabled: hydrated,
  });

  const pager = usePagination(list.data?.data ?? []);

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin · audit"
        title="Audit log"
        description="Every state change performed by an admin or agent: verification, placements, payments, agents, flags, subscriptions."
      />

      <Card>
        <div className="flex flex-wrap items-end gap-3 mb-5">
          <div className="flex-1 max-w-xs">
            <p className="text-eyebrow text-muted">Action</p>
            <Input
              placeholder="e.g. placement.activated"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="max-w-[12rem]">
            <p className="text-eyebrow text-muted">Target type</p>
            <Input
              placeholder="placement, worker, invoice…"
              value={targetType}
              onChange={(e) => setTargetType(e.target.value)}
              className="mt-1"
            />
          </div>
          <p className="text-xs text-muted ml-auto">{list.data?.meta.total ?? 0} entries</p>
        </div>

        <Table>
          <THead>
            <TR>
              <TH>When</TH>
              <TH>Action</TH>
              <TH>Actor</TH>
              <TH>Target</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {pager.pageRows.map((row) => (
              <Fragment key={row.id}>
                <TR>
                  <TD muted className="text-xs tabular-nums">
                    {new Date(row.occurredAt).toLocaleString()}
                  </TD>
                  <TD>
                    <Badge tone="neutral">{row.action}</Badge>
                  </TD>
                  <TD muted>
                    {row.actorRole ?? '—'}
                    {row.actorId ? ` · ${row.actorId.slice(0, 8)}` : ''}
                  </TD>
                  <TD muted>
                    {row.targetType ?? '—'}
                    {row.targetId ? ` · ${row.targetId.slice(0, 8)}` : ''}
                  </TD>
                  <TD>
                    {row.metadata ? (
                      <div className="flex items-center justify-end gap-1">
                        <IconButton
                          icon={expanded === row.id ? EyeOff : Eye}
                          label={expanded === row.id ? 'Hide' : 'Inspect'}
                          onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                        />
                      </div>
                    ) : null}
                  </TD>
                </TR>
                {expanded === row.id && row.metadata ? (
                  <TR>
                    <TD colSpan={5} className="bg-cream-50/60">
                      <pre className="text-xs text-muted whitespace-pre-wrap overflow-x-auto">
                        {JSON.stringify(row.metadata, null, 2)}
                      </pre>
                    </TD>
                  </TR>
                ) : null}
              </Fragment>
            ))}
            {(list.data?.data ?? []).length === 0 ? (
              <TableEmpty colSpan={5}>No matching audit entries.</TableEmpty>
            ) : null}
          </TBody>
        </Table>
        <Pagination state={pager} />
      </Card>
    </AdminShell>
  );
}
