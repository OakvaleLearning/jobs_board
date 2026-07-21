'use client';

import { useQuery } from '@tanstack/react-query';
import { AdminShell } from '@/components/dashboard/AdminShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card } from '@/components/ui/Card';
import { Table, THead, TBody, TR, TH, TD, TableEmpty } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { contractsApi } from '@/lib/contracts-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export function ContractsListView() {
  const hydrated = useHydratedTokens();

  const list = useQuery({
    queryKey: ['adminContracts'],
    queryFn: () => contractsApi.adminList({ limit: 100 }),
    enabled: hydrated,
  });

  const pager = usePagination(list.data?.data ?? []);

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin · contracts"
        title="Contract registry"
        description="Worker Placement, Employer Service, and Annual Partnership agreements across the platform."
      />

      <Card>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-muted">{list.data?.meta.total ?? 0} contracts</p>
        </div>
        <Table>
          <THead>
            <TR>
              <TH>Type</TH>
              <TH>Status</TH>
              <TH>Placement</TH>
              <TH>Executed</TH>
              <TH>Updated</TH>
            </TR>
          </THead>
          <TBody>
            {pager.pageRows.map((row) => (
              <TR key={row.id}>
                <TD className="font-medium">{row.type}</TD>
                <TD>
                  <Badge
                    tone={
                      row.status === 'FULLY_EXECUTED'
                        ? 'sage'
                        : row.status === 'TERMINATED' || row.status === 'DISPUTED'
                          ? 'terracotta'
                          : 'brand'
                    }
                  >
                    {row.status}
                  </Badge>
                </TD>
                <TD muted className="text-xs">
                  {row.placementId ? row.placementId.slice(0, 8) : '—'}
                </TD>
                <TD muted className="text-xs">
                  {row.fullyExecutedAt
                    ? new Date(row.fullyExecutedAt).toLocaleDateString()
                    : '—'}
                </TD>
                <TD muted className="text-xs">
                  {new Date(row.updatedAt).toLocaleString()}
                </TD>
              </TR>
            ))}
            {(list.data?.data ?? []).length === 0 ? (
              <TableEmpty colSpan={5}>No contracts yet.</TableEmpty>
            ) : null}
          </TBody>
        </Table>
        <Pagination state={pager} />
      </Card>
    </AdminShell>
  );
}
