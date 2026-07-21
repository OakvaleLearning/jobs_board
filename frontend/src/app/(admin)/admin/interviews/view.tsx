'use client';

import { useQuery } from '@tanstack/react-query';
import { AdminShell } from '@/components/dashboard/AdminShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card } from '@/components/ui/Card';
import { Table, THead, TBody, TR, TH, TD, TableEmpty } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { interviewsApi, type InterviewRow } from '@/lib/interviews-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export function AdminInterviewsView() {
  const hydrated = useHydratedTokens();

  const list = useQuery({
    queryKey: ['adminInterviews'],
    queryFn: () => interviewsApi.adminList({ limit: 100 }),
    enabled: hydrated,
  });

  const pager = usePagination(list.data ?? []);

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin · interviews"
        title="Interviews"
        description="All interview activity across placements, for agent oversight and facilitation (PRD 6.5)."
      />

      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Status</TH>
              <TH>Format</TH>
              <TH>Confirmed</TH>
              <TH>Outcome</TH>
              <TH>Requested</TH>
            </TR>
          </THead>
          <TBody>
            {pager.pageRows.map((row) => (
              <TR key={row.id}>
                <TD>
                  <Badge tone={toneForStatus(row.status)}>{row.status}</Badge>
                </TD>
                <TD className="text-xs">{row.format}</TD>
                <TD muted className="text-xs">
                  {row.confirmedSlot ? new Date(row.confirmedSlot).toLocaleString() : '—'}
                </TD>
                <TD muted className="text-xs">{row.outcome ?? '—'}</TD>
                <TD muted className="text-xs">
                  {new Date(row.createdAt).toLocaleDateString()}
                </TD>
              </TR>
            ))}
            {(list.data ?? []).length === 0 ? (
              <TableEmpty colSpan={5}>No interviews scheduled yet.</TableEmpty>
            ) : null}
          </TBody>
        </Table>
        <Pagination state={pager} />
      </Card>
    </AdminShell>
  );
}

function toneForStatus(s: InterviewRow['status']): 'neutral' | 'sage' | 'terracotta' | 'brand' {
  switch (s) {
    case 'CONFIRMED':
      return 'sage';
    case 'REQUESTED':
      return 'brand';
    case 'CANCELLED':
      return 'terracotta';
    default:
      return 'neutral';
  }
}
