'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardShell, PageHeader } from '@/components/dashboard/Shell';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { offersApi, type OfferRow } from '@/lib/offers-api';
import { formatMoney } from '@/lib/payments-api';
import { isWorkerRespondable, type OfferStatus } from '@oakvale/shared/enums/offer';
import { toast, toastApiError } from '@/lib/toast';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';
import { WORKER_NAV } from '@/lib/worker-nav';

export function WorkerOffers() {
  const hydrated = useHydratedTokens();

  const offers = useQuery({
    queryKey: ['workerOffers'],
    queryFn: () => offersApi.myWorkerList().then((r) => r.data),
    enabled: hydrated,
  });

  const open = (offers.data ?? []).filter((o) => isWorkerRespondable(o.status));
  const past = (offers.data ?? []).filter((o) => !isWorkerRespondable(o.status));

  return (
    <DashboardShell surface="Worker portal" nav={WORKER_NAV}>
      <PageHeader
        eyebrow="Worker · offers"
        title="Your offers."
        description="Offers arrive here once our agents have reviewed them. Accept, decline, or propose different terms."
        actions={open.length > 0 ? <Badge tone="brand">{open.length} awaiting your response</Badge> : null}
      />

      {offers.isLoading ? (
        <Card><p className="text-sm text-muted">Loading offers…</p></Card>
      ) : (offers.data ?? []).length === 0 ? (
        <Card>
          <CardEyebrow>No offers yet</CardEyebrow>
          <CardTitle>Nothing to respond to right now.</CardTitle>
          <p className="text-sm text-ink-600 mt-3">
            When an employer makes you an offer and our agents approve it, it will appear here and
            we&rsquo;ll notify you by SMS and in-app.
          </p>
        </Card>
      ) : (
        <div className="space-y-8">
          {open.length > 0 ? (
            <section className="space-y-4">
              <h2 className="text-eyebrow text-muted">Awaiting your response</h2>
              {open.map((o) => <OfferCard key={o.id} offer={o} />)}
            </section>
          ) : null}
          {past.length > 0 ? (
            <section className="space-y-4">
              <h2 className="text-eyebrow text-muted">History</h2>
              {past.map((o) => <OfferCard key={o.id} offer={o} />)}
            </section>
          ) : null}
        </div>
      )}
    </DashboardShell>
  );
}

function OfferCard({ offer }: { offer: OfferRow }) {
  const queryClient = useQueryClient();
  const [countering, setCountering] = useState(false);
  const [counterSalary, setCounterSalary] = useState(String(offer.salaryAmountMinor / 100));
  const [counterNotes, setCounterNotes] = useState('');

  const respondable = isWorkerRespondable(offer.status);

  function onDone() {
    void queryClient.invalidateQueries({ queryKey: ['workerOffers'] });
    void queryClient.invalidateQueries({ queryKey: ['workerPlacements'] });
  }

  const accept = useMutation({
    mutationFn: () => offersApi.accept(offer.id),
    onSuccess: () => {
      toast.success('Offer accepted.');
      onDone();
    },
    onError: (e) => toastApiError(e, 'Could not accept the offer.'),
  });
  const decline = useMutation({
    mutationFn: (reason: string) => offersApi.decline(offer.id, reason),
    onSuccess: () => {
      toast.success('Offer declined.');
      onDone();
    },
    onError: (e) => toastApiError(e, 'Could not decline the offer.'),
  });
  const counter = useMutation({
    mutationFn: () =>
      offersApi.counter(offer.id, {
        salaryAmountMinor: Math.round(Number(counterSalary) * 100),
        notes: counterNotes,
      }),
    onSuccess: () => {
      setCountering(false);
      toast.success('Counter-offer sent.');
      onDone();
    },
    onError: (e) => toastApiError(e, 'Could not send your counter-offer.'),
  });

  function onAccept() {
    if (window.confirm('Accept this offer? This starts the contract and placement process.')) {
      accept.mutate();
    }
  }

  function onDecline() {
    const reason = window.prompt('Tell the employer briefly why you are declining:');
    if (reason && reason.trim().length > 0) {
      decline.mutate(reason.trim());
    }
  }

  const busy = accept.isPending || decline.isPending || counter.isPending;

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <CardEyebrow>{offer.pipelineType === 'INDIVIDUAL_EMPLOYER' ? 'Diaspora placement' : 'Corporate crèche'}</CardEyebrow>
        <Badge tone={toneForOffer(offer.status)}>{labelForOffer(offer.status)}</Badge>
      </div>
      <CardTitle>{formatMoney(offer.salaryAmountMinor, offer.salaryCurrency)} · starts {new Date(offer.startDate).toLocaleDateString()}</CardTitle>
      <div className="text-sm text-ink-600 mt-3 space-y-1">
        {offer.schedule ? <p>Schedule: {offer.schedule}</p> : null}
        {offer.accommodationType ? <p>Accommodation: {offer.accommodationType.replace('_', '-').toLowerCase()}</p> : null}
        {offer.endDate ? <p>Fixed term until {new Date(offer.endDate).toLocaleDateString()}</p> : null}
        {offer.notes ? <p className="text-muted">“{offer.notes}”</p> : null}
        {offer.declinedReason ? <p className="text-terracotta-700">Declined: {offer.declinedReason}</p> : null}
      </div>

      {respondable ? (
        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={onAccept} disabled={busy}>
              {accept.isPending ? 'Accepting…' : 'Accept offer'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCountering((v) => !v)} disabled={busy}>
              Propose different terms
            </Button>
            <Button size="sm" variant="outline" onClick={onDecline} disabled={busy}>
              {decline.isPending ? 'Declining…' : 'Decline'}
            </Button>
          </div>
          {countering ? (
            <div className="rounded-xl border border-ink/8 bg-cream-50 p-4 grid md:grid-cols-[200px_1fr_auto] gap-3 items-end">
              <div>
                <p className="text-xs text-muted mb-1">Proposed salary ({offer.salaryCurrency})</p>
                <Input type="number" min={0} step="any" value={counterSalary} onChange={(e) => setCounterSalary(e.target.value)} />
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Message to the employer</p>
                <Input value={counterNotes} onChange={(e) => setCounterNotes(e.target.value)} placeholder="e.g. I can start a week later at this rate" />
              </div>
              <Button size="sm" onClick={() => counter.mutate()} disabled={busy || counterNotes.trim().length === 0 || !(Number(counterSalary) > 0)}>
                {counter.isPending ? 'Sending…' : 'Send counter-offer'}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function toneForOffer(s: OfferStatus): 'neutral' | 'sage' | 'terracotta' | 'brand' {
  switch (s) {
    case 'ACCEPTED': return 'sage';
    case 'SENT_TO_WORKER': return 'brand';
    case 'DECLINED':
    case 'WITHDRAWN': return 'terracotta';
    default: return 'neutral';
  }
}

function labelForOffer(s: OfferStatus): string {
  switch (s) {
    case 'SENT_TO_WORKER': return 'Awaiting your response';
    case 'AGENT_REVIEW': return 'In agent review';
    case 'COUNTERED': return 'Counter-offer sent';
    case 'ACCEPTED': return 'Accepted';
    case 'DECLINED': return 'Declined';
    case 'WITHDRAWN': return 'Withdrawn';
    default: return s.toLowerCase();
  }
}
