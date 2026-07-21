'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_STATUSES,
  COMPLAINT_URGENCIES,
  type ComplaintCategory,
  type ComplaintStatus,
  type ComplaintUrgency,
} from '@oakvale/shared/enums/complaints';
import { AdminShell } from '@/components/dashboard/AdminShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card } from '@/components/ui/Card';
import { Table, THead, TBody, TR, TH, TD, TableEmpty } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Field, Select } from '@/app/(worker)/worker/profile/SectionFrame';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { complaintsApi } from '@/lib/complaints-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

function urgencyTone(u: ComplaintUrgency): 'terracotta' | 'brand' | 'neutral' {
  if (u === 'CRITICAL' || u === 'HIGH') return 'terracotta';
  if (u === 'MEDIUM') return 'brand';
  return 'neutral';
}

function statusTone(s: ComplaintStatus): 'sage' | 'terracotta' | 'brand' | 'neutral' {
  if (s === 'RESOLVED' || s === 'CLOSED') return 'sage';
  if (s === 'SUBMITTED') return 'terracotta';
  return 'brand';
}

function slaLight(deadline: string | null): { tone: 'sage' | 'brand' | 'terracotta'; label: string } {
  if (!deadline) return { tone: 'sage', label: 'No SLA' };
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms < 0) return { tone: 'terracotta', label: 'Breached' };
  if (ms < 4 * 60 * 60 * 1000) return { tone: 'terracotta', label: '< 4h' };
  if (ms < 24 * 60 * 60 * 1000) return { tone: 'brand', label: '< 24h' };
  return { tone: 'sage', label: 'On track' };
}

export function ComplaintsListView() {
  const hydrated = useHydratedTokens();
  const [category, setCategory] = useState<string>('');
  const [urgency, setUrgency] = useState<string>('');
  const [status, setStatus] = useState<string>('');

  const list = useQuery({
    queryKey: ['adminComplaints', category, urgency, status],
    queryFn: () =>
      complaintsApi.adminList({
        category: (category || undefined) as ComplaintCategory | undefined,
        urgency: (urgency || undefined) as ComplaintUrgency | undefined,
        status: (status || undefined) as ComplaintStatus | undefined,
        limit: 100,
      }),
    enabled: hydrated,
  });

  const pager = usePagination(list.data?.data ?? []);

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin · complaints"
        title="Complaints register"
        description="Triaged by category and urgency. SAFEGUARDING complaints auto-suspend the accused worker's active placements."
      />

      <Card>
        <div className="grid md:grid-cols-3 gap-3 mb-5">
          <Field label="Category">
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={[{ value: '', label: 'All categories' }, ...COMPLAINT_CATEGORIES.map((c) => ({ value: c, label: c }))]}
            />
          </Field>
          <Field label="Urgency">
            <Select
              value={urgency}
              onChange={(e) => setUrgency(e.target.value)}
              options={[{ value: '', label: 'All' }, ...COMPLAINT_URGENCIES.map((u) => ({ value: u, label: u }))]}
            />
          </Field>
          <Field label="Status">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[{ value: '', label: 'All' }, ...COMPLAINT_STATUSES.map((s) => ({ value: s, label: s }))]}
            />
          </Field>
        </div>

        <Table>
          <THead>
            <TR>
              <TH>Case</TH>
              <TH>Category</TH>
              <TH>Urgency</TH>
              <TH>Status</TH>
              <TH>SLA</TH>
              <TH>Subject</TH>
              <TH>Raised</TH>
            </TR>
          </THead>
          <TBody>
            {pager.pageRows.map((row) => {
              const sla = slaLight(row.slaDeadline);
              return (
                <TR key={row.id}>
                  <TD className="font-mono text-xs">{row.caseRef}</TD>
                  <TD className="text-xs">{row.category}</TD>
                  <TD><Badge tone={urgencyTone(row.urgency)}>{row.urgency}</Badge></TD>
                  <TD><Badge tone={statusTone(row.status)}>{row.status}</Badge></TD>
                  <TD><Badge tone={sla.tone}>{sla.label}</Badge></TD>
                  <TD className="max-w-md truncate">{row.subject}</TD>
                  <TD muted className="text-xs">
                    {new Date(row.createdAt).toLocaleDateString()}
                  </TD>
                </TR>
              );
            })}
            {(list.data?.data ?? []).length === 0 ? (
              <TableEmpty colSpan={7}>No complaints found.</TableEmpty>
            ) : null}
          </TBody>
        </Table>
        <Pagination state={pager} />
      </Card>
    </AdminShell>
  );
}
