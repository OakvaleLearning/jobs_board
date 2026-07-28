'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardShell, PageHeader } from '@/components/dashboard/Shell';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { interviewsApi, type InterviewRow } from '@/lib/interviews-api';
import { toast, toastApiError } from '@/lib/toast';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';
import { WORKER_NAV } from '@/lib/worker-nav';

export function WorkerInterviews() {
  const hydrated = useHydratedTokens();

  const interviews = useQuery({
    queryKey: ['workerInterviews'],
    queryFn: () => interviewsApi.myWorkerList(),
    enabled: hydrated,
  });

  return (
    <DashboardShell surface="Worker portal" nav={WORKER_NAV}>
      <PageHeader
        eyebrow="Worker · interviews"
        title="Your interviews."
        description="When an employer requests an interview, accept one of their proposed times or suggest an alternative."
      />

      {interviews.isLoading ? (
        <Card>
          <p className="text-sm text-muted">Loading interviews…</p>
        </Card>
      ) : (interviews.data ?? []).length === 0 ? (
        <Card>
          <CardEyebrow>No interviews yet</CardEyebrow>
          <CardTitle>Nothing scheduled right now.</CardTitle>
          <p className="text-sm text-ink-600 mt-3">
            We&rsquo;ll notify you by SMS and in-app the moment an employer requests an interview.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {(interviews.data ?? []).map((iv) => (
            <InterviewCard key={iv.id} interview={iv} />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}

function InterviewCard({ interview }: { interview: InterviewRow }) {
  const queryClient = useQueryClient();
  const [proposing, setProposing] = useState(false);
  const [altSlot, setAltSlot] = useState('');

  const canRespond = interview.status === 'REQUESTED';

  function onDone() {
    void queryClient.invalidateQueries({ queryKey: ['workerInterviews'] });
  }

  const accept = useMutation({
    mutationFn: (slot: string) => interviewsApi.accept(interview.id, slot),
    onSuccess: () => {
      toast.success('Interview time confirmed.');
      onDone();
    },
    onError: (e) => toastApiError(e, 'Could not confirm that time.'),
  });

  const propose = useMutation({
    mutationFn: () => interviewsApi.propose(interview.id, [new Date(altSlot).toISOString()]),
    onSuccess: () => {
      setProposing(false);
      toast.success('New time proposed.');
      onDone();
    },
    onError: (e) => toastApiError(e, 'Could not propose a new time.'),
  });

  const busy = accept.isPending || propose.isPending;

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <CardEyebrow>{labelFormat(interview.format)} interview</CardEyebrow>
        <Badge tone={toneForStatus(interview.status)}>{labelStatus(interview.status)}</Badge>
      </div>
      <CardTitle>
        {interview.confirmedSlot
          ? `Confirmed for ${new Date(interview.confirmedSlot).toLocaleString()}`
          : 'Awaiting a confirmed time'}
      </CardTitle>

      {interview.outcome ? (
        <p className="text-sm text-ink-600 mt-3">Outcome: {labelOutcome(interview.outcome)}</p>
      ) : null}

      {canRespond ? (
        <div className="mt-5 space-y-3">
          <p className="text-xs text-muted">Proposed times. Accept one:</p>
          <div className="flex flex-wrap gap-2">
            {interview.proposedSlots.map((slot) => (
              <Button
                key={slot}
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => accept.mutate(slot)}
              >
                {new Date(slot).toLocaleString()}
              </Button>
            ))}
          </div>
          <Button size="sm" variant="ghost" onClick={() => setProposing((v) => !v)} disabled={busy}>
            {proposing ? 'Cancel' : 'None of these work, propose another time'}
          </Button>
          {proposing ? (
            <div className="rounded-xl border border-ink/8 bg-cream-50 p-4 flex flex-wrap gap-3 items-end">
              <div>
                <p className="text-xs text-muted mb-1">Your preferred time</p>
                <Input
                  type="datetime-local"
                  value={altSlot}
                  onChange={(e) => setAltSlot(e.target.value)}
                />
              </div>
              <Button
                size="sm"
                onClick={() => propose.mutate()}
                disabled={busy || !altSlot}
              >
                {propose.isPending ? 'Sending…' : 'Propose this time'}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function labelFormat(f: InterviewRow['format']): string {
  switch (f) {
    case 'IN_PERSON':
      return 'In-person';
    case 'VIDEO':
      return 'Video';
    case 'PHONE':
      return 'Phone';
    default:
      return f;
  }
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

function labelStatus(s: InterviewRow['status']): string {
  switch (s) {
    case 'REQUESTED':
      return 'Action needed';
    case 'CONFIRMED':
      return 'Confirmed';
    case 'RESCHEDULE_PROPOSED':
      return 'Alternative proposed';
    case 'COMPLETED':
      return 'Completed';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return s;
  }
}

function labelOutcome(o: NonNullable<InterviewRow['outcome']>): string {
  switch (o) {
    case 'PROGRESSING':
      return 'Progressing';
    case 'NOT_PROGRESSING':
      return 'Not progressing';
    case 'ON_HOLD':
      return 'On hold';
    default:
      return o;
  }
}
