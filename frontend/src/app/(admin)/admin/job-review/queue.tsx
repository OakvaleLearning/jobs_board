'use client';

import { Check, Eye, PenLine } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminShell } from '@/components/dashboard/AdminShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card } from '@/components/ui/Card';
import { Table, THead, TBody, TR, TH, TD, TableEmpty } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Modal } from '@/components/ui/Modal';
import { toast, toastApiError } from '@/lib/toast';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { jobsApi, type JobPostingRow } from '@/lib/jobs-api';
import { employersApi } from '@/lib/employers-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export function JobReviewQueueView() {
  const queryClient = useQueryClient();
  const hydrated = useHydratedTokens();
  const [detail, setDetail] = useState<JobPostingRow | null>(null);

  const list = useQuery({
    queryKey: ['adminJobReview'],
    queryFn: () => jobsApi.adminList({ limit: 100 }),
    enabled: hydrated,
  });

  const categories = useQuery({
    queryKey: ['workforceCategories'],
    queryFn: employersApi.listWorkforceCategories,
    enabled: hydrated,
  });
  const categoryName = (id: string | null) =>
    id ? ((categories.data ?? []).find((c) => c.id === id)?.name ?? '—') : '—';

  function onDone() {
    void queryClient.invalidateQueries({ queryKey: ['adminJobReview'] });
  }

  const approve = useMutation({
    mutationFn: (id: string) => jobsApi.review(id, true),
    onSuccess: () => {
      toast.success('Posting approved.');
      onDone();
    },
    onError: (e) => toastApiError(e, 'Could not approve.'),
  });

  const revise = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => jobsApi.review(id, false, notes),
    onSuccess: () => {
      toast.success('Revision requested.');
      onDone();
    },
    onError: (e) => toastApiError(e, 'Could not request revision.'),
  });

  function onRevise(id: string) {
    const notes = window.prompt('What needs to change before this can go live?');
    if (notes && notes.trim().length > 0) {
      revise.mutate({ id, notes: notes.trim() });
    }
  }

  const busy = approve.isPending || revise.isPending;

  const pager = usePagination(list.data ?? []);

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin · jobs"
        title="Job post review"
        description="All corporate job postings. Those awaiting agent review can be approved or sent back before they go live (PRD 6.3)."
      />

      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Employer</TH>
              <TH>Title</TH>
              <TH>Status</TH>
              <TH>Category</TH>
              <TH>Requirements</TH>
              <TH>Location</TH>
              <TH>Salary</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {pager.pageRows.map((row) => (
              <TR key={row.id} onClick={() => setDetail(row)}>
                <TD>{row.orgName ?? '—'}</TD>
                <TD className="font-medium">{row.title}</TD>
                <TD>
                  <Badge tone={statusTone(row.status)}>
                    {row.status.replace('_', ' ').toLowerCase()}
                  </Badge>
                </TD>
                <TD muted className="text-xs">{categoryName(row.workforceCategoryId)}</TD>
                <TD className="text-xs">
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge tone={row.visibility === 'RESTRICTED' ? 'terracotta' : 'sage'}>
                      {row.visibility === 'RESTRICTED' ? 'Restricted' : 'Public'}
                    </Badge>
                    {row.backgroundCheckRequired ? <Badge tone="neutral">BG required</Badge> : null}
                  </div>
                </TD>
                <TD muted className="text-xs">{row.workLocation ?? '—'}</TD>
                <TD muted className="text-xs">{row.salaryRange ?? '—'}</TD>
                <TD className="whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1">
                    <IconButton
                      icon={Eye}
                      label="View details"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetail(row);
                      }}
                    />
                    {row.status === 'PENDING_REVIEW' ? (
                      <>
                        <IconButton
                          icon={Check}
                          label="Approve"
                          tone="primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            approve.mutate(row.id);
                          }}
                          disabled={busy}
                        />
                        <IconButton
                          icon={PenLine}
                          label="Request revision"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRevise(row.id);
                          }}
                          disabled={busy}
                        />
                      </>
                    ) : null}
                  </div>
                </TD>
              </TR>
            ))}
            {(list.data ?? []).length === 0 ? (
              <TableEmpty colSpan={8}>No job posts found.</TableEmpty>
            ) : null}
          </TBody>
        </Table>
        <Pagination state={pager} />
      </Card>

      <Modal
        open={detail !== null}
        onClose={() => setDetail(null)}
        size="lg"
        title={detail?.title}
        description={detail?.orgName ?? 'Job posting'}
      >
        {detail ? (
          <div className="space-y-6 text-left">
            <div className="flex flex-wrap gap-2">
              <Badge tone={detail.visibility === 'RESTRICTED' ? 'terracotta' : 'sage'}>
                {detail.visibility === 'RESTRICTED' ? 'Restricted' : 'Public'}
              </Badge>
              {detail.backgroundCheckRequired ? <Badge tone="neutral">BG required</Badge> : null}
              <Badge tone="brand">{detail.priorityLevel.toLowerCase()} priority</Badge>
            </div>

            <Section label="Description">
              <p className="whitespace-pre-wrap text-sm text-ink-600">{detail.description || '—'}</p>
            </Section>

            <Section label="Duties">
              <p className="whitespace-pre-wrap text-sm text-ink-600">{detail.duties || '—'}</p>
            </Section>

            <Section label="Benefits">
              {detail.benefits.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {detail.benefits.map((b) => (
                    <Badge key={b} tone="neutral">
                      {b}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">—</p>
              )}
            </Section>

            <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <Meta label="Category" value={categoryName(detail.workforceCategoryId)} />
              <Meta
                label="Location"
                value={[detail.workLocation, detail.country].filter(Boolean).join(' · ') || '—'}
              />
              <Meta label="Schedule" value={detail.schedule ?? '—'} />
              <Meta
                label="Salary"
                value={
                  detail.salaryRange ? `${detail.salaryRange} ${detail.salaryCurrency}` : '—'
                }
              />
              <Meta label="Openings" value={String(detail.openings)} />
              <Meta label="Deadline" value={detail.deadline ?? '—'} />
              <Meta
                label="Submitted"
                value={new Date(detail.createdAt).toLocaleDateString()}
              />
            </div>

            {detail.status === 'PENDING_REVIEW' ? (
              <div className="flex justify-end gap-3 border-t border-ink/8 pt-5">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (detail) onRevise(detail.id);
                    setDetail(null);
                  }}
                  disabled={busy}
                >
                  Request revision
                </Button>
                <Button
                  onClick={() => {
                    if (detail) approve.mutate(detail.id);
                    setDetail(null);
                  }}
                  disabled={busy}
                >
                  Approve
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </AdminShell>
  );
}

function statusTone(status: JobPostingRow['status']): 'sage' | 'terracotta' | 'neutral' | 'brand' {
  switch (status) {
    case 'OPEN':
      return 'sage';
    case 'PENDING_REVIEW':
      return 'brand';
    case 'DRAFT':
      return 'terracotta';
    default:
      return 'neutral';
  }
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-eyebrow text-muted">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-eyebrow text-muted">{label}</p>
      <p className="mt-1 text-sm text-ink-600">{value}</p>
    </div>
  );
}
