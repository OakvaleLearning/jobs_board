'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EmployerShell } from '@/components/dashboard/EmployerShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/app/(worker)/worker/profile/SectionFrame';
import { downloadBlob } from '@/lib/api-client';
import { toast, toastApiError } from '@/lib/toast';

function downloadIndividualEmployerPlacementPdf(placementId: string) {
  const filename = `placement_${placementId.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.pdf`;
  return downloadBlob(`/placements/${placementId}/record.pdf`, filename);
}
import { placementsApi, type Placement, type WelfareCheck } from '@/lib/placements-api';
import { paymentsApi } from '@/lib/payments-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';
import { useEmployerConfig } from '@/lib/use-employer-config';

export function IndividualEmployerPlacementView() {
  const queryClient = useQueryClient();
  const hydrated = useHydratedTokens();
  const config = useEmployerConfig();

  const list = useQuery({
    queryKey: ['employerPlacements'],
    queryFn: placementsApi.employerMe,
    enabled: hydrated,
    refetchInterval: (q) => {
      const data = q.state.data as Placement[] | undefined;
      if (data?.some((p) => p.status === 'PENDING_PAYMENT')) return 10_000;
      return false;
    },
  });

  const current = (list.data ?? []).find((p) => p.status === 'ACTIVE' || p.status === 'PENDING_PAYMENT' || p.status === 'SUSPENDED');

  return (
    <EmployerShell config={config}>
      <PageHeader
        eyebrow="Diaspora · placement"
        title={current?.status === 'ACTIVE' ? 'Active placement.' : 'Awaiting activation.'}
        actions={
          current ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => downloadIndividualEmployerPlacementPdf(current.id)}
            >
              Download PDF
            </Button>
          ) : undefined
        }
      />

      {!current ? (
        <Card className="text-muted">
          No placement yet. Open your shortlist and select a carer.
        </Card>
      ) : current.status === 'PENDING_PAYMENT' ? (
        <PendingPaymentCard placement={current} />
      ) : (
        <ActivePlacementCard
          placement={current}
          onReplacement={() => queryClient.invalidateQueries({ queryKey: ['employerPlacements'] })}
        />
      )}
    </EmployerShell>
  );
}

function PendingPaymentCard({ placement }: { placement: Placement }) {
  const checkout = useMutation({
    mutationFn: () => paymentsApi.createPlacementCheckout(placement.id),
    onSuccess: (data) => {
      window.location.href = data.checkoutUrl;
    },
    onError: (e) => toastApiError(e, 'Could not start checkout.'),
  });
  return (
    <Card>
      <Badge tone="terracotta">PENDING_PAYMENT</Badge>
      <CardTitle>Awaiting activation</CardTitle>
      <p className="text-sm text-ink-600 mt-3 max-w-xl">
        Activation happens the moment Stripe confirms the placement fee. You&rsquo;ll be redirected to a
        secure checkout, then back here once the carer is on board.
      </p>
      <div className="mt-5 flex items-center gap-3">
        <Button onClick={() => checkout.mutate()} disabled={checkout.isPending}>
          {checkout.isPending ? 'Opening checkout…' : 'Pay now'}
        </Button>
        <p className="text-xs text-muted">Placement id: {placement.id.slice(0, 8)}</p>
      </div>
    </Card>
  );
}

function ActivePlacementCard({ placement, onReplacement }: { placement: Placement; onReplacement: () => void }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');

  const detail = useQuery({
    queryKey: ['placementDetail', placement.id],
    queryFn: () => placementsApi.detail(placement.id),
  });

  const reports = useQuery({
    queryKey: ['welfareReports', placement.id],
    queryFn: () => placementsApi.welfareReports(placement.id),
  });

  const escalations = useQuery({
    queryKey: ['welfareEscalations', placement.id],
    queryFn: () => placementsApi.welfareEscalationsForPlacement(placement.id),
  });
  const openEscalation = (escalations.data ?? []).find((e) => !e.resolvedAt);

  const replace = useMutation({
    mutationFn: () => placementsApi.requestReplacement(placement.id, reason),
    onSuccess: () => {
      setReason('');
      toast.success('Replacement requested.');
      queryClient.invalidateQueries({ queryKey: ['placementDetail', placement.id] });
      onReplacement();
    },
    onError: (e) => toastApiError(e, 'Could not request replacement.'),
  });

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6">
      <Card>
        <CardEyebrow>{placement.pipelineType.toLowerCase()} · placement</CardEyebrow>
        <CardTitle>
          {placement.status === 'SUSPENDED' ? 'Suspended for safeguarding review' : 'Active'}
        </CardTitle>
        <p className="text-sm text-muted mt-2">
          {placement.activatedAt
            ? `Activated ${new Date(placement.activatedAt).toLocaleString()}`
            : ''}
        </p>
        {placement.guaranteeExpiresAt ? (
          <p className="text-sm text-muted mt-1">
            90-day guarantee through {new Date(placement.guaranteeExpiresAt).toLocaleDateString()}
          </p>
        ) : null}

        {openEscalation ? (
          <div className="mt-6 rounded-xl border border-terracotta-300 bg-terracotta-50 p-4">
            <p className="text-sm font-medium text-terracotta-700">
              Welfare flagged {openEscalation.severity}
            </p>
            <p className="text-xs text-terracotta-700 mt-1">
              Your account manager has 24h to action — due {new Date(openEscalation.dueAt).toLocaleString()}.
            </p>
          </div>
        ) : null}

        <hr className="my-6 border-ink/10" />

        <h3 className="h-display text-xl">Welfare reports</h3>
        <ul className="mt-4 space-y-3">
          {(detail.data?.welfareChecks ?? []).map((w: WelfareCheck) => {
            const report = (reports.data ?? []).find((r) => r.welfareCheckId === w.id);
            return (
              <li key={w.id} className="rounded-xl border border-ink/8 bg-cream-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-muted">
                    {w.completedAt
                      ? `Completed ${new Date(w.completedAt).toLocaleString()}`
                      : `Scheduled ${w.scheduledAt ? new Date(w.scheduledAt).toLocaleString() : 'TBC'}`}
                  </p>
                  {report ? (
                    <a
                      href={placementsApi.welfareReportDownloadUrl(placement.id, report.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-ink/15 px-3 py-1 text-xs text-ink hover:bg-ink/5"
                    >
                      Download PDF
                    </a>
                  ) : null}
                </div>
                {w.completedAt ? (
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <p>Recipient: {w.recipientWellbeing}</p>
                    <p>Attendance: {w.workerAttendance}</p>
                  </div>
                ) : null}
                {w.notes ? <p className="text-sm text-ink-600 mt-2">{w.notes}</p> : null}
              </li>
            );
          })}
          {(detail.data?.welfareChecks ?? []).length === 0 ? (
            <li className="text-sm text-muted">No welfare reports yet.</li>
          ) : null}
        </ul>
      </Card>

      <Card>
        <CardEyebrow>Need a change?</CardEyebrow>
        <CardTitle>Request a replacement</CardTitle>
        <p className="text-sm text-ink-600 mt-3">
          Within the 90-day guarantee window, no replacement fee applies. SLA: 5 business days.
        </p>
        <Textarea
          placeholder="Why are you requesting a replacement?"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-4"
        />
        <Button
          className="mt-4 w-full"
          variant="outline"
          disabled={reason.trim().length < 8 || replace.isPending}
          onClick={() => replace.mutate()}
        >
          {replace.isPending ? 'Submitting…' : 'Request replacement'}
        </Button>
      </Card>
    </div>
  );
}
