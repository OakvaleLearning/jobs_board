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
import { verificationApi } from '@/lib/verification-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export function VerificationQueue() {
  const router = useRouter();
  const hydrated = useHydratedTokens();

  const q = useQuery({
    queryKey: ['adminVerificationQueue'],
    queryFn: () => verificationApi.queue(1),
    enabled: hydrated,
  });

  const pager = usePagination(q.data?.data ?? []);

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin · verification"
        title="Verification queue."
        description="Workers waiting on review. Approve identity, then review their uploaded background documents."
        actions={<Badge tone="neutral">{q.data?.meta.total ?? 0} pending</Badge>}
      />

      <Table>
        <THead>
          <TR>
            <TH>Worker</TH>
            <TH>Identity status</TH>
            <TH>Completion</TH>
            <TH>Submitted</TH>
            <TH className="text-right">Action</TH>
          </TR>
        </THead>
        <TBody>
          {pager.pageRows.map((r) => (
            <TR key={r.workerId} onClick={() => router.push(`/admin/verification/${r.workerId}`)}>
              <TD>
                <p className="font-medium">{r.fullName ?? 'Unnamed worker'}</p>
                <p className="text-xs text-muted">{r.workerId.slice(0, 8)}</p>
              </TD>
              <TD>
                <Badge tone={r.identityStatus === 'IN_REVIEW' ? 'terracotta' : 'neutral'}>
                  {r.identityStatus}
                </Badge>
              </TD>
              <TD className="tabular-nums">{r.profileCompletionPct}%</TD>
              <TD muted>
                {r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '—'}
              </TD>
              <TD>
                <div className="flex items-center justify-end gap-1">
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
          {(q.data?.data ?? []).length === 0 ? (
            <TableEmpty colSpan={5}>Queue is empty.</TableEmpty>
          ) : null}
        </TBody>
      </Table>
      <Pagination state={pager} className="mt-4" />
    </AdminShell>
  );
}
