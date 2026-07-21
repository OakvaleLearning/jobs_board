'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminShell } from '@/components/dashboard/AdminShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card } from '@/components/ui/Card';
import { Table, THead, TBody, TR, TH, TD, TableEmpty } from '@/components/ui/Table';
import { Send } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { toast, toastApiError } from '@/lib/toast';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { offersApi } from '@/lib/offers-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export function OfferReviewQueueView() {
  const queryClient = useQueryClient();
  const hydrated = useHydratedTokens();

  const list = useQuery({
    queryKey: ['adminOfferReview'],
    queryFn: () => offersApi.adminQueue({ limit: 100 }),
    enabled: hydrated,
  });

  const approve = useMutation({
    mutationFn: (id: string) => offersApi.adminApprove(id),
    onSuccess: () => {
      toast.success('Offer approved & sent.');
      queryClient.invalidateQueries({ queryKey: ['adminOfferReview'] });
    },
    onError: (e) => toastApiError(e, 'Could not approve.'),
  });

  const pager = usePagination(list.data?.data ?? []);

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin · offers"
        title="Offer review queue"
        description="Employer-submitted offers awaiting agent review before they reach the worker."
      />

      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Pipeline</TH>
              <TH>Start</TH>
              <TH>Salary</TH>
              <TH>Notes</TH>
              <TH>Created</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {pager.pageRows.map((row) => (
              <TR key={row.id}>
                <TD><Badge tone="brand">{row.pipelineType}</Badge></TD>
                <TD className="tabular-nums text-xs">{row.startDate}</TD>
                <TD className="tabular-nums text-xs">
                  {(row.salaryAmountMinor / 100).toLocaleString()} {row.salaryCurrency}
                </TD>
                <TD className="max-w-md truncate">{row.notes ?? '—'}</TD>
                <TD muted className="text-xs">
                  {new Date(row.createdAt).toLocaleDateString()}
                </TD>
                <TD>
                  <div className="flex items-center justify-end gap-1">
                    <IconButton
                      icon={Send}
                      label="Approve & send"
                      tone="primary"
                      onClick={() => approve.mutate(row.id)}
                      disabled={approve.isPending}
                    />
                  </div>
                </TD>
              </TR>
            ))}
            {(list.data?.data ?? []).length === 0 ? (
              <TableEmpty colSpan={6}>Nothing in the review queue.</TableEmpty>
            ) : null}
          </TBody>
        </Table>
        <Pagination state={pager} />
      </Card>
    </AdminShell>
  );
}
