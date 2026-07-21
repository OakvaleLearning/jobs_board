'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardShell, PageHeader } from '@/components/dashboard/Shell';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, Textarea } from '@/app/(worker)/worker/profile/SectionFrame';
import { complaintsApi, type ComplaintRow } from '@/lib/complaints-api';
import { placementsApi } from '@/lib/placements-api';
import {
  COMPLAINT_CATEGORIES,
  type ComplaintCategory,
  type ComplaintStatus,
} from '@oakvale/shared/enums/complaints';
import { toast, toastApiError } from '@/lib/toast';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';
import { WORKER_NAV } from '@/lib/worker-nav';

const CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  SAFEGUARDING: 'Safeguarding concern',
  MISCONDUCT: 'Misconduct',
  NON_PAYMENT: 'Non-payment / payment dispute',
  CONTRACT_DISPUTE: 'Contract dispute',
  SERVICE_QUALITY: 'Service quality',
  ABSENTEEISM: 'Absenteeism',
  COMMUNICATION: 'Communication problem',
  OTHER: 'Other',
};

export function WorkerComplaints() {
  const hydrated = useHydratedTokens();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [openCase, setOpenCase] = useState<string | null>(null);

  const mine = useQuery({
    queryKey: ['workerComplaints'],
    queryFn: complaintsApi.mine,
    enabled: hydrated,
  });

  return (
    <DashboardShell surface="Worker portal" nav={WORKER_NAV}>
      <PageHeader
        eyebrow="Worker · complaints"
        title="Raise a concern."
        description="Unfair treatment, payment problems, or anything that worries you on a placement. Every case gets a reference number and a response deadline."
        actions={
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Close form' : 'Raise a complaint'}
          </Button>
        }
      />

      {showForm ? (
        <div className="mb-6">
          <RaiseForm
            onRaised={(c) => {
              setShowForm(false);
              setOpenCase(c.id);
              void queryClient.invalidateQueries({ queryKey: ['workerComplaints'] });
            }}
          />
        </div>
      ) : null}

      {mine.isLoading ? (
        <Card><p className="text-sm text-muted">Loading your cases…</p></Card>
      ) : (mine.data ?? []).length === 0 ? (
        <Card>
          <CardEyebrow>No cases</CardEyebrow>
          <p className="text-sm text-ink-600 mt-3">You haven&rsquo;t raised any complaints. We hope it stays that way.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {(mine.data ?? []).map((c) => (
            <div key={c.id}>
              <button type="button" className="w-full text-left" onClick={() => setOpenCase(openCase === c.id ? null : c.id)}>
                <Card className="hover:border-ink/25 transition">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardEyebrow>{c.caseRef}</CardEyebrow>
                      <p className="text-sm text-ink mt-1 font-medium">{c.subject}</p>
                      <p className="text-xs text-muted mt-1">
                        {CATEGORY_LABELS[c.category]} · raised {new Date(c.createdAt).toLocaleDateString()}
                        {c.slaDeadline ? ` · response due ${new Date(c.slaDeadline).toLocaleString()}` : ''}
                      </p>
                    </div>
                    <Badge tone={toneForComplaint(c.status)}>{labelForComplaint(c.status)}</Badge>
                  </div>
                </Card>
              </button>
              {openCase === c.id ? <CaseDetail id={c.id} /> : null}
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}

function RaiseForm({ onRaised }: { onRaised: (c: ComplaintRow) => void }) {
  const [category, setCategory] = useState<ComplaintCategory | ''>('');
  const [subject, setSubject] = useState('');
  const [narrative, setNarrative] = useState('');
  const [placementId, setPlacementId] = useState('');

  const placements = useQuery({
    queryKey: ['workerPlacements'],
    queryFn: placementsApi.me,
  });

  const raise = useMutation({
    mutationFn: () =>
      complaintsApi
        .raise({
          category: category as ComplaintCategory,
          // Urgency is assessed and may be escalated by our agents per category SLA rules.
          urgency: category === 'SAFEGUARDING' ? 'CRITICAL' : category === 'NON_PAYMENT' ? 'HIGH' : 'MEDIUM',
          subject: subject.trim(),
          narrative: narrative.trim(),
          placementId: placementId || undefined,
        })
        .then((r) => r.data),
    onSuccess: (c) => {
      toast.success('Complaint submitted. We’ll be in touch.');
      onRaised(c);
    },
    onError: (e) => toastApiError(e, 'Could not submit the complaint.'),
  });

  const valid = category !== '' && subject.trim().length >= 4 && narrative.trim().length >= 50;

  return (
    <Card>
      <CardEyebrow>New complaint</CardEyebrow>
      <CardTitle>Tell us what happened.</CardTitle>
      <div className="mt-5 grid md:grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted mb-1">Category</p>
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
            options={COMPLAINT_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
          />
        </div>
        <div>
          <p className="text-xs text-muted mb-1">Related placement (optional)</p>
          <Select
            value={placementId}
            onChange={(e) => setPlacementId(e.target.value)}
            options={(placements.data ?? []).map((p) => ({
              value: p.id,
              label: `${p.status.toLowerCase()} placement · started ${p.activatedAt ? new Date(p.activatedAt).toLocaleDateString() : '—'}`,
            }))}
          />
        </div>
        <div className="md:col-span-2">
          <p className="text-xs text-muted mb-1">Subject</p>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="One line summary" />
        </div>
        <div className="md:col-span-2">
          <p className="text-xs text-muted mb-1">
            What happened? Include dates and anything that helps us investigate (minimum 50 characters).
          </p>
          <Textarea rows={5} value={narrative} onChange={(e) => setNarrative(e.target.value)} />
          <p className="text-[11px] text-muted mt-1">{narrative.trim().length}/50 characters minimum</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button size="sm" onClick={() => raise.mutate()} disabled={!valid || raise.isPending}>
          {raise.isPending ? 'Submitting…' : 'Submit complaint'}
        </Button>
      </div>
    </Card>
  );
}

function CaseDetail({ id }: { id: string }) {
  const detail = useQuery({
    queryKey: ['workerComplaint', id],
    queryFn: () => complaintsApi.detail(id),
  });

  if (detail.isLoading) return <Card className="mt-2"><p className="text-sm text-muted">Loading case…</p></Card>;
  if (!detail.data) return null;

  const { complaint, events } = detail.data;
  return (
    <Card className="mt-2 !bg-cream-50/60">
      <CardEyebrow>Case timeline</CardEyebrow>
      <p className="text-sm text-ink-600 mt-3 whitespace-pre-wrap">{complaint.narrative}</p>
      {complaint.resolutionNote ? (
        <p className="text-sm text-sage-600 mt-3">Resolution: {complaint.resolutionNote}</p>
      ) : null}
      <ul className="mt-4 space-y-2 text-sm">
        {events.map((e) => (
          <li key={e.id} className="flex items-baseline justify-between gap-4 text-ink-600">
            <span>
              {e.kind.replace(/_/g, ' ').toLowerCase()}
              {e.notes ? ` — ${e.notes}` : ''}
            </span>
            <span className="text-xs text-muted shrink-0">{new Date(e.occurredAt).toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function toneForComplaint(s: ComplaintStatus): 'neutral' | 'sage' | 'terracotta' | 'brand' {
  switch (s) {
    case 'RESOLVED':
    case 'CLOSED': return 'sage';
    case 'IN_INVESTIGATION':
    case 'RESPONSE_DRAFTED':
    case 'ACKNOWLEDGED': return 'brand';
    default: return 'terracotta';
  }
}

function labelForComplaint(s: ComplaintStatus): string {
  switch (s) {
    case 'SUBMITTED': return 'Submitted';
    case 'ACKNOWLEDGED': return 'Acknowledged';
    case 'IN_INVESTIGATION': return 'Being investigated';
    case 'RESPONSE_DRAFTED': return 'Response drafted';
    case 'RESOLVED': return 'Resolved';
    case 'CLOSED': return 'Closed';
    default: return s;
  }
}
