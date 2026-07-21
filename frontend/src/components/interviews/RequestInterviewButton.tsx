'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/app/(worker)/worker/profile/SectionFrame';
import { interviewsApi } from '@/lib/interviews-api';
import { toastApiError } from '@/lib/toast';
import { INTERVIEW_FORMATS, type InterviewFormat } from '@oakvale/shared/enums/interview';

/**
 * Inline "Request interview" control. Pass `shortlistId` when requesting from a
 * shortlist context so a confirmed interview can advance the placement to
 * INTERVIEWING; pass `jobPostingId` when requesting from a job application.
 */
export function RequestInterviewButton({
  workerId,
  shortlistId,
  jobPostingId,
}: {
  workerId: string;
  shortlistId?: string;
  jobPostingId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<InterviewFormat>('VIDEO');
  const [slot1, setSlot1] = useState('');
  const [slot2, setSlot2] = useState('');
  const [done, setDone] = useState(false);

  const request = useMutation({
    mutationFn: () => {
      const proposedSlots = [slot1, slot2].filter((s) => s).map((s) => new Date(s).toISOString());
      return interviewsApi.request({ workerId, shortlistId, jobPostingId, format, proposedSlots });
    },
    onSuccess: () => {
      setDone(true);
      setOpen(false);
    },
    onError: (e) => toastApiError(e, 'Could not request interview.'),
  });

  if (done) return <Badge tone="sage">Interview requested</Badge>;

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Request interview
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-ink/8 bg-white p-3 flex flex-wrap items-end gap-2">
      <div>
        <p className="text-xs text-muted mb-1">Format</p>
        <Select
          value={format}
          onChange={(e) => setFormat(e.target.value as InterviewFormat)}
          options={INTERVIEW_FORMATS.map((f) => ({
            value: f,
            label: f.replace('_', '-').toLowerCase(),
          }))}
        />
      </div>
      <div>
        <p className="text-xs text-muted mb-1">Option 1</p>
        <Input type="datetime-local" value={slot1} onChange={(e) => setSlot1(e.target.value)} />
      </div>
      <div>
        <p className="text-xs text-muted mb-1">Option 2 (optional)</p>
        <Input type="datetime-local" value={slot2} onChange={(e) => setSlot2(e.target.value)} />
      </div>
      <Button size="sm" onClick={() => request.mutate()} disabled={request.isPending || !slot1}>
        {request.isPending ? 'Sending…' : 'Send'}
      </Button>
    </div>
  );
}
