'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { JOB_APPLICATION_STATUSES, type JobApplicationStatus } from '@oakvale/shared/enums/employer';
import { EmployerShell } from '@/components/dashboard/EmployerShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/app/(worker)/worker/profile/SectionFrame';
import { RequestInterviewButton } from '@/components/interviews/RequestInterviewButton';
import { employersApi } from '@/lib/employers-api';
import { jobsApi } from '@/lib/jobs-api';
import { toast, toastApiError } from '@/lib/toast';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';
import { useEmployerConfig } from '@/lib/use-employer-config';
import { JobTabs } from '../JobTabs';

export function JobApplicants({ jobId }: { jobId: string }) {
  const hydrated = useHydratedTokens();
  const config = useEmployerConfig();
  const queryClient = useQueryClient();

  const job = useQuery({
    queryKey: ['employerJob', jobId],
    queryFn: () => employersApi.getJobPosting(jobId),
    enabled: hydrated,
  });

  const applicants = useQuery({
    queryKey: ['jobApplicants', jobId],
    queryFn: () => jobsApi.applicants(jobId),
    enabled: hydrated,
  });

  const setStatus = useMutation({
    mutationFn: ({ appId, status }: { appId: string; status: JobApplicationStatus }) =>
      jobsApi.setApplicationStatus(jobId, appId, status),
    onSuccess: () => {
      toast.success('Applicant updated.');
      queryClient.invalidateQueries({ queryKey: ['jobApplicants', jobId] });
    },
    onError: (e) => toastApiError(e, 'Could not update applicant.'),
  });

  return (
    <EmployerShell config={config}>
      <PageHeader
        eyebrow="Corporate · applicants"
        title={job.data?.title ? `Applicants — ${job.data.title}` : 'Applicants'}
        actions={
          <Link
            href={`/employer/jobs/${jobId}`}
            className="text-sm text-muted hover:text-ink underline underline-offset-4"
          >
            Back to job
          </Link>
        }
      />

      <JobTabs jobId={jobId} />

      <Card>
        <CardEyebrow>Applicants</CardEyebrow>
        <CardTitle>{(applicants.data ?? []).length} applicant(s)</CardTitle>
        <ul className="mt-5 space-y-4">
          {(applicants.data ?? []).map((a) => (
            <li key={a.id} className="rounded-xl border border-ink/8 bg-cream-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-ink">{a.workerName ?? 'Verified worker'}</p>
                <Badge tone="neutral">{a.status}</Badge>
              </div>
              {a.note ? <p className="text-xs text-muted mt-1">“{a.note}”</p> : null}
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <div>
                  <p className="text-xs text-muted mb-1">Set status</p>
                  <Select
                    value={a.status}
                    onChange={(e) =>
                      setStatus.mutate({ appId: a.id, status: e.target.value as JobApplicationStatus })
                    }
                    options={JOB_APPLICATION_STATUSES.map((s) => ({ value: s, label: s.toLowerCase() }))}
                  />
                </div>
                <RequestInterviewButton workerId={a.workerId} jobPostingId={jobId} />
              </div>
            </li>
          ))}
          {(applicants.data ?? []).length === 0 ? (
            <li className="text-sm text-muted">No applications yet.</li>
          ) : null}
        </ul>
      </Card>
    </EmployerShell>
  );
}
