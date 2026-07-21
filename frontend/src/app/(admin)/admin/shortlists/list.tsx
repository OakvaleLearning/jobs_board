'use client';

import { SlidersHorizontal, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminShell } from '@/components/dashboard/AdminShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Table, THead, TBody, TR, TH, TD, TableEmpty } from '@/components/ui/Table';
import { TextLink } from '@/components/ui/Link';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { Field } from '@/app/(worker)/worker/profile/SectionFrame';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { toast, toastApiError, toastFormErrors } from '@/lib/toast';
import { placementsApi, type Shortlist } from '@/lib/placements-api';
import { adminApi, type EmployerRosterRow } from '@/lib/admin-api';
import { jobsApi, type JobPostingRow } from '@/lib/jobs-api';
import { generateShortlistSchema, type GenerateShortlistInput } from '@oakvale/shared/schema/placement';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

type ShortlistStatus = 'New' | 'Open' | 'Decided';

function statusOf(s: Shortlist): ShortlistStatus {
  return s.decidedAt ? 'Decided' : s.viewedAt ? 'Open' : 'New';
}

function isCorporate(emp: EmployerRosterRow): boolean {
  return /CORPORATE/i.test(emp.employerType);
}

function employerLabel(emp: EmployerRosterRow): string {
  return emp.orgName ?? emp.fullName ?? emp.email;
}

export function AdminShortlists() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const hydrated = useHydratedTokens();
  const [showGen, setShowGen] = useState(false);
  const [selectedEmployer, setSelectedEmployer] = useState<EmployerRosterRow | null>(null);

  // Filters for the list table.
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | ShortlistStatus>('ALL');

  const q = useQuery({
    queryKey: ['adminShortlists'],
    queryFn: placementsApi.adminShortlists,
    enabled: hydrated,
  });

  // Page through the employer roster once — powers both the picker and the
  // id → name map used to render the table. The endpoint has no text search,
  // so we gather all pages and filter client-side.
  const roster = useQuery({
    queryKey: ['adminEmployerRoster'],
    enabled: hydrated,
    queryFn: async () => {
      const all: EmployerRosterRow[] = [];
      let page = 1;
      for (;;) {
        const r = await adminApi.rosters.employers({ page });
        all.push(...r.data);
        if (r.data.length === 0 || page * r.meta.limit >= r.meta.total) break;
        page += 1;
        if (page > 50) break; // safety cap
      }
      return all;
    },
  });

  const employerName = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of roster.data ?? []) map.set(e.id, employerLabel(e));
    return map;
  }, [roster.data]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<GenerateShortlistInput>({
    resolver: zodResolver(generateShortlistSchema),
  });

  // Keep employerId / jobPostingId registered so Zod validation still runs,
  // but the values are driven by the pickers, not typed.
  register('employerId');
  register('jobPostingId');

  const generate = useMutation({
    mutationFn: placementsApi.generateShortlist,
    onSuccess: () => {
      toast.success('Shortlist generated.');
      setShowGen(false);
      setSelectedEmployer(null);
      reset();
      queryClient.invalidateQueries({ queryKey: ['adminShortlists'] });
    },
    onError: (e) => toastApiError(e, 'Generation failed.'),
  });

  function pickEmployer(emp: EmployerRosterRow) {
    setSelectedEmployer(emp);
    setValue('employerId', emp.id, { shouldValidate: true });
    setValue('jobPostingId', undefined, { shouldValidate: false });
  }
  function clearEmployer() {
    setSelectedEmployer(null);
    setValue('employerId', '', { shouldValidate: false });
    setValue('jobPostingId', undefined, { shouldValidate: false });
  }

  const filtered = useMemo(() => {
    const rows = q.data?.data ?? [];
    const needle = filterText.trim().toLowerCase();
    return rows.filter((s) => {
      if (filterStatus !== 'ALL' && statusOf(s) !== filterStatus) return false;
      if (!needle) return true;
      const name = employerName.get(s.employerId) ?? '';
      return (
        name.toLowerCase().includes(needle) ||
        s.id.toLowerCase().includes(needle) ||
        s.employerId.toLowerCase().includes(needle)
      );
    });
  }, [q.data?.data, filterText, filterStatus, employerName]);

  const pager = usePagination<Shortlist>(filtered);

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin · shortlists"
        title="Shortlists."
        description="Every shortlist generated by our matching engine. Generate a new one against an employer, then open it to override before the employer sees it."
        actions={
          <Button size="sm" onClick={() => setShowGen((v) => !v)}>
            {showGen ? 'Cancel' : 'Generate new'}
          </Button>
        }
      />

      {showGen ? (
        <Card className="mb-6 space-y-4">
          <CardEyebrow>Generate shortlist</CardEyebrow>
          <CardTitle>Pick the employer</CardTitle>
          <form
            onSubmit={handleSubmit((v) => generate.mutate(v), toastFormErrors)}
            className="grid md:grid-cols-2 gap-4"
          >
            <Field label="Employer" error={errors.employerId?.message}>
              {selectedEmployer ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-ink/12 bg-cream-50 px-4 h-11">
                  <span className="truncate text-sm text-ink">
                    {employerLabel(selectedEmployer)}
                    <span className="text-muted"> · {selectedEmployer.employerType.toLowerCase()}</span>
                  </span>
                  <button
                    type="button"
                    onClick={clearEmployer}
                    aria-label="Clear employer"
                    className="text-muted hover:text-ink"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <EmployerPicker
                  employers={roster.data ?? []}
                  loading={roster.isLoading}
                  onSelect={pickEmployer}
                />
              )}
            </Field>

            <Field label="Job posting" error={errors.jobPostingId?.message}>
              {selectedEmployer && isCorporate(selectedEmployer) ? (
                <JobPostingPicker
                  employerId={selectedEmployer.id}
                  enabled={hydrated}
                  onSelect={(jobId) =>
                    setValue('jobPostingId', jobId ?? undefined, { shouldValidate: false })
                  }
                />
              ) : (
                <div className="flex items-center rounded-xl border border-ink/12 bg-cream-100/60 px-4 h-11 text-sm text-muted">
                  {selectedEmployer ? 'Not applicable for this pipeline.' : 'Pick a corporate employer first.'}
                </div>
              )}
            </Field>

            <div className="md:col-span-2 flex justify-end gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowGen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting || generate.isPending}>
                {generate.isPending ? 'Generating…' : 'Generate'}
              </Button>
            </div>
          </form>
          <p className="text-xs text-muted">
            Matching runs against the visibility-gated worker pool plus the employer&rsquo;s needs assessment.
            Pick a job posting for corporate hires to add posting-specific signals.
          </p>
        </Card>
      ) : null}

      <div className="mb-4 grid sm:grid-cols-[1fr_auto] gap-3">
        <Input
          placeholder="Search by employer or shortlist id…"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
        <div className="flex items-center gap-1">
          {(['ALL', 'New', 'Open', 'Decided'] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={filterStatus === s ? 'primary' : 'outline'}
              onClick={() => setFilterStatus(s)}
            >
              {s === 'ALL' ? 'All' : s}
            </Button>
          ))}
        </div>
      </div>

      <Table>
        <THead>
          <TR>
            <TH>Shortlist</TH>
            <TH>Pipeline</TH>
            <TH>Candidates</TH>
            <TH>Status</TH>
            <TH>Created</TH>
            <TH className="text-right">Action</TH>
          </TR>
        </THead>
        <TBody>
          {pager.pageRows.map((s: Shortlist) => (
            <TR key={s.id} onClick={() => router.push(`/admin/shortlists/${s.id}`)}>
              <TD className="tabular-nums">
                <TextLink href={`/admin/shortlists/${s.id}`} onClick={(e) => e.stopPropagation()}>
                  {s.id.slice(0, 8)}
                </TextLink>
                <p className="text-xs text-muted">
                  {employerName.get(s.employerId) ?? `Employer ${s.employerId.slice(0, 8)}`}
                </p>
              </TD>
              <TD>{s.requestType.toLowerCase()}</TD>
              <TD className="tabular-nums">{s.workerIds.length}</TD>
              <TD>
                <Badge tone={s.decidedAt ? 'sage' : s.viewedAt ? 'neutral' : 'terracotta'}>
                  {statusOf(s)}
                </Badge>
              </TD>
              <TD muted>{new Date(s.createdAt).toLocaleString()}</TD>
              <TD>
                <div className="flex items-center justify-end gap-1">
                  <IconButton
                    icon={SlidersHorizontal}
                    label="Override"
                    href={`/admin/shortlists/${s.id}`}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </TD>
            </TR>
          ))}
          {filtered.length === 0 ? (
            <TableEmpty colSpan={6}>
              {(q.data?.data ?? []).length === 0 ? 'No shortlists yet.' : 'No shortlists match your filters.'}
            </TableEmpty>
          ) : null}
        </TBody>
      </Table>
      <Pagination state={pager} className="mt-4" />
    </AdminShell>
  );
}

function EmployerPicker({
  employers,
  loading,
  onSelect,
}: {
  employers: EmployerRosterRow[];
  loading: boolean;
  onSelect: (emp: EmployerRosterRow) => void;
}) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const matches = useMemo(() => {
    const rows = needle
      ? employers.filter(
          (e) =>
            employerLabel(e).toLowerCase().includes(needle) ||
            e.email.toLowerCase().includes(needle) ||
            e.employerType.toLowerCase().includes(needle),
        )
      : employers;
    return rows.slice(0, 12);
  }, [employers, needle]);

  return (
    <div>
      <Input
        placeholder={loading ? 'Loading employers…' : 'Search name, email, pipeline…'}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={loading}
      />
      <ul className="mt-2 max-h-72 overflow-auto rounded-xl border border-ink/8 bg-cream-50 divide-y divide-ink/8">
        {matches.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => onSelect(e)}
              className="w-full text-left px-3 py-2 hover:bg-cream-100/70"
            >
              <p className="text-sm text-ink truncate">{employerLabel(e)}</p>
              <p className="text-xs text-muted truncate">
                {e.employerType.toLowerCase()} · {e.email}
              </p>
            </button>
          </li>
        ))}
        {!loading && matches.length === 0 ? (
          <li className="px-3 py-2 text-xs text-muted">No employers match.</li>
        ) : null}
      </ul>
    </div>
  );
}

function JobPostingPicker({
  employerId,
  enabled,
  onSelect,
}: {
  employerId: string;
  enabled: boolean;
  onSelect: (jobId: string | null) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const postings = useQuery({
    queryKey: ['adminJobPostings', 'OPEN'],
    queryFn: () => jobsApi.adminList({ status: 'OPEN' }),
    enabled,
  });

  const rows = useMemo(
    () => (postings.data ?? []).filter((p: JobPostingRow) => p.employerId === employerId),
    [postings.data, employerId],
  );

  function pick(jobId: string | null) {
    setSelected(jobId);
    onSelect(jobId);
  }

  return (
    <ul className="max-h-72 overflow-auto rounded-xl border border-ink/8 bg-cream-50 divide-y divide-ink/8">
      <li>
        <button
          type="button"
          onClick={() => pick(null)}
          className={`w-full text-left px-3 py-2 hover:bg-cream-100/70 ${selected === null ? 'bg-cream-100/70' : ''}`}
        >
          <p className="text-sm text-ink">No specific posting</p>
          <p className="text-xs text-muted">Match against the needs assessment only.</p>
        </button>
      </li>
      {rows.map((p) => (
        <li key={p.id}>
          <button
            type="button"
            onClick={() => pick(p.id)}
            className={`w-full text-left px-3 py-2 hover:bg-cream-100/70 ${selected === p.id ? 'bg-cream-100/70' : ''}`}
          >
            <p className="text-sm text-ink truncate">{p.title}</p>
            <p className="text-xs text-muted">
              {p.openings} opening{p.openings === 1 ? '' : 's'} · {p.status.toLowerCase()}
            </p>
          </button>
        </li>
      ))}
      {postings.isSuccess && rows.length === 0 ? (
        <li className="px-3 py-2 text-xs text-muted">No open postings for this employer.</li>
      ) : null}
    </ul>
  );
}
