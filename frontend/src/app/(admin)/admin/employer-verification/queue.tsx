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
import { adminApi } from '@/lib/admin-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export function EmployerVerificationQueue() {
  const router = useRouter();
  const hydrated = useHydratedTokens();
  const q = useQuery({
    queryKey: ['adminEmployerVerificationQueue'],
    queryFn: () => adminApi.employerVerificationQueue(1),
    enabled: hydrated,
  });

  const pager = usePagination(q.data?.data ?? []);

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin · employers"
        title="Employer verification."
        description="Employers awaiting verification. Review their details and documents, then approve or request changes."
        actions={<Badge tone="neutral">{q.data?.meta.total ?? 0} pending</Badge>}
      />

      <Table>
        <THead>
          <TR>
            <TH>Organisation</TH>
            <TH>Account email</TH>
            <TH>Docs</TH>
            <TH>Submitted</TH>
            <TH className="text-right">Action</TH>
          </TR>
        </THead>
        <TBody>
          {pager.pageRows.map((r) => (
            <TR key={r.employerId} onClick={() => router.push(`/admin/employer-verification/${r.employerId}`)}>
              <TD className="font-medium">{r.orgName ?? 'Unnamed'}</TD>
              <TD muted>{r.email}</TD>
              <TD className="tabular-nums">{r.documentCount}</TD>
              <TD muted>
                {r.verificationSubmittedAt ? new Date(r.verificationSubmittedAt).toLocaleString() : '—'}
              </TD>
              <TD>
                <div className="flex items-center justify-end gap-1">
                  <IconButton
                    icon={ClipboardCheck}
                    label="Review"
                    href={`/admin/employer-verification/${r.employerId}`}
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
