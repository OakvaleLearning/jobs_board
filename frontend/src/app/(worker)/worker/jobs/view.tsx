'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardShell, PageHeader } from '@/components/dashboard/Shell';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { jobsApi, type JobPostingRow, type JobApplicationRow } from '@/lib/jobs-api';
import { toast, toastApiError } from '@/lib/toast';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';
import { WORKER_NAV } from '@/lib/worker-nav';

export function WorkerJobs() {
  const hydrated = useHydratedTokens();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');

  const jobs = useQuery({
    queryKey: ['workerJobs', search],
    queryFn: () => jobsApi.browse({ q: search || undefined }),
    enabled: hydrated,
  });

  const applications = useQuery({
    queryKey: ['workerJobApplications'],
    queryFn: () => jobsApi.myApplications(),
    enabled: hydrated,
  });

  const appliedByJob = useMemo(() => {
    const map = new Map<string, JobApplicationRow>();
    for (const a of applications.data ?? []) map.set(a.jobPostingId, a);
    return map;
  }, [applications.data]);

  return (
    <DashboardShell surface="Worker portal" nav={WORKER_NAV}>
      <PageHeader
        eyebrow="Worker · jobs"
        title="Open roles."
        description="Browse live, Oakvale-reviewed roles and apply. You can only apply once your profile is approved and live."
      />

      <form
        className="flex gap-2 mb-5"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q.trim());
        }}
      >
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by title, location, or keyword"
        />
        <Button size="sm" type="submit">
          Search
        </Button>
      </form>

      {jobs.isLoading ? (
        <Card>
          <p className="text-sm text-muted">Loading roles…</p>
        </Card>
      ) : (jobs.data ?? []).length === 0 ? (
        <Card>
          <CardEyebrow>No open roles</CardEyebrow>
          <CardTitle>Nothing matches right now.</CardTitle>
          <p className="text-sm text-ink-600 mt-3">
            Check back soon — new roles are posted as employers and our agents approve them.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {(jobs.data ?? []).map((job) => (
            <JobCard key={job.id} job={job} application={appliedByJob.get(job.id)} />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}

function JobCard({
  job,
  application,
}: {
  job: JobPostingRow;
  application?: JobApplicationRow;
}) {
  const queryClient = useQueryClient();

  const apply = useMutation({
    mutationFn: () => jobsApi.apply(job.id),
    onSuccess: () => {
      toast.success('Application submitted.');
      void queryClient.invalidateQueries({ queryKey: ['workerJobApplications'] });
    },
    onError: (e) => toastApiError(e, 'Could not submit your application.'),
  });

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <CardEyebrow>{job.orgName ?? 'Employer'}</CardEyebrow>
        {application ? (
          <Badge tone={toneForApp(application.status)}>{labelForApp(application.status)}</Badge>
        ) : (
          <Badge tone="neutral">Open</Badge>
        )}
      </div>
      <CardTitle>{job.title}</CardTitle>
      {job.careTypeName ? (
        <div className="mt-2">
          <Badge tone="brand">{job.careTypeName}</Badge>
        </div>
      ) : null}
      <div className="text-sm text-ink-600 mt-3 space-y-1">
        {job.workLocation ? <p>Location: {job.workLocation}</p> : null}
        {job.schedule ? <p>Schedule: {job.schedule}</p> : null}
        {job.salaryRange ? <p>Salary: {job.salaryRange}</p> : null}
        {job.deadline ? <p>Apply by {new Date(job.deadline).toLocaleDateString()}</p> : null}
        <p className="text-muted whitespace-pre-line">{job.description}</p>
      </div>

      {job.specialisations?.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {job.specialisations.map((s) => (
            <Badge key={s} tone="neutral">
              {s}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="mt-5">
        {application ? (
          <p className="text-xs text-muted">
            Applied {new Date(application.createdAt).toLocaleDateString()}
          </p>
        ) : (
          <Button size="sm" onClick={() => apply.mutate()} disabled={apply.isPending}>
            {apply.isPending ? 'Applying…' : 'Apply'}
          </Button>
        )}
      </div>
    </Card>
  );
}

function toneForApp(s: JobApplicationRow['status']): 'neutral' | 'sage' | 'terracotta' | 'brand' {
  switch (s) {
    case 'PROGRESSED':
      return 'sage';
    case 'REVIEWED':
      return 'brand';
    case 'REJECTED':
      return 'terracotta';
    default:
      return 'neutral';
  }
}

function labelForApp(s: JobApplicationRow['status']): string {
  switch (s) {
    case 'APPLIED':
      return 'Applied';
    case 'REVIEWED':
      return 'Under review';
    case 'PROGRESSED':
      return 'Progressed';
    case 'REJECTED':
      return 'Not selected';
    default:
      return s;
  }
}
