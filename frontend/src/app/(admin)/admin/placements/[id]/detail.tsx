'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminShell } from '@/components/dashboard/AdminShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Select, Textarea } from '@/app/(worker)/worker/profile/SectionFrame';
import { toast, toastApiError, toastFormErrors } from '@/lib/toast';
import { placementsApi, type WelfareCheck, type PlacementEvent } from '@/lib/placements-api';
import { adminApi } from '@/lib/admin-api';
import {
  END_REASONS,
  WELLBEING_LEVELS,
  type PlacementStatus,
} from '@oakvale/shared/enums/placement';
import {
  endPlacementSchema,
  welfareCheckLogSchema,
  type WelfareCheckLogInput,
} from '@oakvale/shared/schema/placement';
import type { z } from 'zod';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

type EndPlacementInput = z.infer<typeof endPlacementSchema>;

export function AdminPlacementDetail({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const hydrated = useHydratedTokens();

  const detail = useQuery({
    queryKey: ['placementDetail', id],
    queryFn: () => placementsApi.detail(id),
    enabled: hydrated,
    refetchInterval: (q) => {
      const data = q.state.data;
      if (data?.placement.status === 'PENDING_PAYMENT') return 5000;
      return 15_000;
    },
  });

  const activate = useMutation({
    mutationFn: () => placementsApi.activate(id),
    onSuccess: () => {
      toast.success('Placement activated.');
      queryClient.invalidateQueries({ queryKey: ['placementDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['adminPlacements'] });
    },
    onError: (e) => toastApiError(e, 'Activate failed.'),
  });

  const placement = detail.data?.placement;

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin · placement"
        title={placement ? `Placement ${placement.id.slice(0, 8)}` : 'Placement'}
        description="Lifecycle events, welfare logging, and admin overrides for activation and termination."
        actions={
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={() => adminApi.placementPdf(id)}>
              Download PDF
            </Button>
            <Link href="/admin/placements" className="text-sm text-muted hover:text-ink underline underline-offset-4">
              Back to board
            </Link>
          </div>
        }
      />

      {!placement ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          <div className="space-y-5">
            <Card>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardEyebrow>{placement.pipelineType.toLowerCase()} · placement</CardEyebrow>
                  <CardTitle>
                    <span className="inline-flex items-center gap-3">
                      <Badge tone={statusTone(placement.status)}>
                        {placement.status.replace('_', ' ').toLowerCase()}
                      </Badge>
                      <span className="text-muted text-sm font-normal">
                        worker {placement.workerId.slice(0, 8)} · employer {placement.employerId.slice(0, 8)}
                      </span>
                    </span>
                  </CardTitle>
                </div>
              </div>

              <dl className="mt-5 grid md:grid-cols-2 gap-4 text-sm">
                <Meta label="Created" value={new Date(placement.createdAt).toLocaleString()} />
                <Meta label="Activated" value={placement.activatedAt ? new Date(placement.activatedAt).toLocaleString() : '—'} />
                <Meta
                  label="Guarantee expires"
                  value={
                    placement.guaranteeExpiresAt
                      ? new Date(placement.guaranteeExpiresAt).toLocaleDateString()
                      : '—'
                  }
                />
                <Meta
                  label="Ended"
                  value={
                    placement.endedAt
                      ? `${new Date(placement.endedAt).toLocaleDateString()}${placement.endReason ? ` · ${placement.endReason}` : ''}`
                      : '—'
                  }
                />
              </dl>

              <div className="mt-6 flex flex-wrap gap-2">
                {placement.status === 'PENDING_PAYMENT' ? (
                  <Button size="sm" onClick={() => activate.mutate()} disabled={activate.isPending}>
                    {activate.isPending ? 'Activating…' : 'Activate'}
                  </Button>
                ) : null}
                <EndPlacementForm placementId={id} currentStatus={placement.status} />
              </div>

              {placement.status === 'PENDING_PAYMENT' ? (
                <p className="text-xs text-muted mt-4">
                  Manual activation; placements normally activate automatically on payment confirmation.
                </p>
              ) : null}
            </Card>

            <Card>
              <CardEyebrow>Lifecycle events</CardEyebrow>
              <ul className="mt-4 space-y-3">
                {(detail.data?.events ?? []).map((e: PlacementEvent) => (
                  <li key={e.id} className="flex items-start gap-4 text-sm">
                    <span className="h-display text-xs text-muted tabular-nums w-24 flex-shrink-0">
                      {new Date(e.occurredAt).toLocaleTimeString()}
                    </span>
                    <div>
                      <p className="text-ink">{e.eventType}</p>
                      {e.metadata ? (
                        <p className="text-xs text-muted">{JSON.stringify(e.metadata)}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
                {(detail.data?.events ?? []).length === 0 ? (
                  <li className="text-sm text-muted">No events recorded yet.</li>
                ) : null}
              </ul>
            </Card>
          </div>

          <div className="space-y-5">
            <Card>
              <CardEyebrow>Welfare checks</CardEyebrow>
              <CardTitle>Log a check</CardTitle>
              <WelfareLogForm placementId={id} />
              <hr className="my-5 border-ink/10" />
              <ul className="space-y-3">
                {(detail.data?.welfareChecks ?? []).map((w: WelfareCheck) => (
                  <li key={w.id} className="rounded-xl border border-ink/8 bg-cream-50 p-3 text-sm">
                    <p className="text-muted text-xs">
                      {w.completedAt
                        ? `Completed ${new Date(w.completedAt).toLocaleString()}`
                        : `Scheduled ${w.scheduledAt ? new Date(w.scheduledAt).toLocaleString() : 'TBC'}`}
                    </p>
                    {w.completedAt ? (
                      <p className="mt-1">
                        Recipient {w.recipientWellbeing} · Attendance {w.workerAttendance}
                      </p>
                    ) : null}
                    {w.notes ? <p className="text-ink-600 mt-1">{w.notes}</p> : null}
                    {w.issuesFlagged ? (
                      <Badge tone="terracotta" className="mt-2">Issues flagged</Badge>
                    ) : null}
                  </li>
                ))}
                {(detail.data?.welfareChecks ?? []).length === 0 ? (
                  <li className="text-sm text-muted">No welfare checks logged yet.</li>
                ) : null}
              </ul>
            </Card>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-eyebrow text-muted">{label}</dt>
      <dd className="text-ink mt-1">{value}</dd>
    </div>
  );
}

function WelfareLogForm({ placementId }: { placementId: string }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<WelfareCheckLogInput>({
    resolver: zodResolver(welfareCheckLogSchema),
    defaultValues: {
      recipientWellbeing: 'GOOD',
      workerAttendance: 'GOOD',
      issuesFlagged: false,
    },
  });
  const mut = useMutation({
    mutationFn: (input: WelfareCheckLogInput) => placementsApi.logWelfareCheck(placementId, input),
    onSuccess: () => {
      reset({ recipientWellbeing: 'GOOD', workerAttendance: 'GOOD', issuesFlagged: false, notes: '' });
      toast.success('Welfare check logged.');
      queryClient.invalidateQueries({ queryKey: ['placementDetail', placementId] });
    },
    onError: (e) => toastApiError(e, 'Could not log welfare check.'),
  });

  return (
    <form onSubmit={handleSubmit((v) => mut.mutate(v), toastFormErrors)} className="space-y-3 mt-4">
      <Field label="Recipient wellbeing">
        <Select
          {...register('recipientWellbeing')}
          options={WELLBEING_LEVELS.map((w) => ({ value: w, label: w.toLowerCase() }))}
        />
      </Field>
      <Field label="Worker attendance">
        <Select
          {...register('workerAttendance')}
          options={WELLBEING_LEVELS.map((w) => ({ value: w, label: w.toLowerCase() }))}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm text-ink-600">
        <input type="checkbox" {...register('issuesFlagged')} className="h-4 w-4 accent-terracotta-500" />
        Issues flagged
      </label>
      <Field label="Notes" error={errors.notes?.message}>
        <Textarea {...register('notes')} />
      </Field>
      <Button type="submit" size="sm" disabled={isSubmitting || mut.isPending} className="w-full">
        {mut.isPending ? 'Logging…' : 'Log welfare check'}
      </Button>
    </form>
  );
}

function EndPlacementForm({
  placementId,
  currentStatus,
}: {
  placementId: string;
  currentStatus: PlacementStatus;
}) {
  const queryClient = useQueryClient();
  const [show, setShow] = useState(false);
  const { register, handleSubmit, reset } = useForm<EndPlacementInput>({
    resolver: zodResolver(endPlacementSchema),
    defaultValues: { endReason: 'COMPLETED' },
  });
  const mut = useMutation({
    mutationFn: (input: EndPlacementInput) => placementsApi.end(placementId, input),
    onSuccess: () => {
      reset({ endReason: 'COMPLETED' });
      setShow(false);
      toast.success('Placement ended.');
      queryClient.invalidateQueries({ queryKey: ['placementDetail', placementId] });
      queryClient.invalidateQueries({ queryKey: ['adminPlacements'] });
    },
    onError: (e) => toastApiError(e, 'End placement failed.'),
  });

  if (currentStatus === 'COMPLETED' || currentStatus === 'TERMINATED') return null;

  return (
    <div className="w-full">
      {!show ? (
        <Button size="sm" variant="outline" onClick={() => setShow(true)}>
          End placement
        </Button>
      ) : (
        <form
          onSubmit={handleSubmit((v) => mut.mutate(v))}
          className="rounded-xl border border-ink/8 bg-cream-50 p-4 space-y-3 mt-3"
        >
          <Field label="End reason">
            <Select
              {...register('endReason')}
              options={END_REASONS.map((r) => ({ value: r, label: r.replace('_', ' ').toLowerCase() }))}
            />
          </Field>
          <Field label="Notes">
            <Textarea {...register('notes')} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setShow(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={mut.isPending}>
              {mut.isPending ? 'Ending…' : 'Confirm end'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function statusTone(s: PlacementStatus): 'sage' | 'terracotta' | 'neutral' | 'ink' {
  if (s === 'ACTIVE') return 'sage';
  if (s === 'SUSPENDED' || s === 'TERMINATED') return 'terracotta';
  if (s === 'PENDING_PAYMENT') return 'ink';
  return 'neutral';
}
