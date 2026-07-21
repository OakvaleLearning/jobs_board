'use client';

import { ClipboardCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AdminShell } from '@/components/dashboard/AdminShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Table, THead, TBody, TR, TH, TD, TableEmpty } from '@/components/ui/Table';
import { IconButton } from '@/components/ui/IconButton';
import { Badge } from '@/components/ui/Badge';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { verificationApi, type BackgroundCheckRow } from '@/lib/verification-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export function BackgroundChecksList() {
  const router = useRouter();
  const hydrated = useHydratedTokens();

  const q = useQuery({
    queryKey: ['adminBackgroundChecks'],
    queryFn: () => verificationApi.backgroundChecks(1),
    enabled: hydrated,
  });

  const pager = usePagination<BackgroundCheckRow>(q.data ?? []);

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin · background checks"
        title="Background review queue."
        description="Workers who have submitted background documents. Open a worker to review their documents and mark the background Clear or Flagged."
      />

      <Table>
        <THead>
          <TR>
            <TH>Worker</TH>
            <TH>Status</TH>
            <TH>Submitted</TH>
            <TH>Reviewed</TH>
            <TH />
          </TR>
        </THead>
        <TBody>
          {pager.pageRows.map((r: BackgroundCheckRow) => (
            <TR key={r.id} onClick={() => router.push(`/admin/verification/${r.workerId}`)}>
              <TD>{r.fullName ?? r.workerId.slice(0, 8)}</TD>
              <TD>
                <Badge tone={statusTone(r.status)}>{r.status}</Badge>
              </TD>
              <TD muted>
                {r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '—'}
              </TD>
              <TD muted>
                {r.completedAt ? new Date(r.completedAt).toLocaleString() : '—'}
              </TD>
              <TD>
                <div className="flex items-center gap-1">
                  <IconButton
                    icon={ClipboardCheck}
                    label="Review"
                    href={`/admin/verification/${r.workerId}`}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </TD>
            </TR>
          ))}
          {(q.data ?? []).length === 0 ? (
            <TableEmpty colSpan={5}>No background submissions yet.</TableEmpty>
          ) : null}
        </TBody>
      </Table>
      <Pagination state={pager} className="mt-4" />
    </AdminShell>
  );
}

function statusTone(s: BackgroundCheckRow['status']): 'sage' | 'terracotta' | 'neutral' {
  if (s === 'CLEAR') return 'sage';
  if (s === 'FLAGGED' || s === 'HIT' || s === 'FAILED' || s === 'REVIEW') return 'terracotta';
  return 'neutral';
}
