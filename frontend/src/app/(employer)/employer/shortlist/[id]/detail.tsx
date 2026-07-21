'use client';

import Link from 'next/link';
import { TextLink } from '@/components/ui/Link';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EmployerShell } from '@/components/dashboard/EmployerShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { toast, toastApiError } from '@/lib/toast';
import { RequestInterviewButton } from '@/components/interviews/RequestInterviewButton';
import { SendOfferModal } from '@/components/offers/SendOfferModal';
import { placementsApi, type MatchedCandidate } from '@/lib/placements-api';
import { employersApi, type PublicWorkerProfile } from '@/lib/employers-api';
import { offersApi, type OfferRow } from '@/lib/offers-api';
import { isLiveOffer, labelForOffer, toneForOffer } from '@/lib/offer-status';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';
import { useEmployerConfig } from '@/lib/use-employer-config';
import type { PipelineType } from '@oakvale/shared/enums/placement';
import { useState } from 'react';

const EMPTY_BREAKDOWN = { skills: 0, experience: 0, certification: 0, rating: 0 };

export function ShortlistDetailView({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const hydrated = useHydratedTokens();
  const config = useEmployerConfig();
  const accountManaged = config?.isAccountManaged ?? true;

  const shortlist = useQuery({
    queryKey: ['employerShortlist', id],
    queryFn: () => placementsApi.shortlist(id),
    enabled: hydrated,
  });

  const offers = useQuery({
    queryKey: ['employerOffers', id],
    queryFn: () => offersApi.myEmployerList().then((r) => r.data),
    enabled: hydrated,
  });

  // Latest live offer per worker on THIS shortlist, so we don't offer to
  // re-send once terms are already with an agent/worker.
  const liveOfferByWorker = new Map<string, OfferRow>();
  for (const o of offers.data ?? []) {
    if (o.shortlistId === id && isLiveOffer(o.status)) liveOfferByWorker.set(o.workerId, o);
  }

  const select = useMutation({
    mutationFn: (workerId: string) => placementsApi.select(id, workerId),
    onSuccess: () => {
      toast.success('Carer selected.');
      queryClient.invalidateQueries({ queryKey: ['employerPlacements'] });
      router.push(accountManaged ? '/employer/placement' : '/employer/dashboard');
    },
    onError: (e) => toastApiError(e, 'Select failed.'),
  });

  return (
    <EmployerShell config={config}>
      <Link
        href={accountManaged ? '/employer/shortlist' : '/employer/jobs'}
        className="mb-4 inline-flex items-center gap-2 rounded-full border border-ink/12 bg-white px-4 h-9 text-sm font-medium text-ink transition hover:border-brand-500/40 hover:bg-cream-50"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back
      </Link>
      <PageHeader
        eyebrow="Shortlist"
        title="Choose a carer."
        description="Each candidate is gated by the visibility rules: identity verified, background CLEAR, Oakvale CPD active, no safeguarding flags."
      />

      {!shortlist.data ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {(shortlist.data.workerIds as Array<MatchedCandidate | string>).map((raw) => {
            // Legacy/seeded shortlists may store a bare worker-id string instead
            // of a MatchedCandidate object — normalise so the card never crashes.
            const m =
              typeof raw === 'string'
                ? { workerId: raw, score: 0, breakdown: EMPTY_BREAKDOWN }
                : { ...raw, breakdown: raw.breakdown ?? EMPTY_BREAKDOWN };
            return (
              <CandidateCard
                key={m.workerId}
                workerId={m.workerId}
                shortlistId={id}
                pipelineType={shortlist.data.requestType}
                score={m.score}
                breakdown={m.breakdown}
                existingOffer={liveOfferByWorker.get(m.workerId) ?? null}
                disabled={shortlist.data?.decidedAt != null || select.isPending}
                onSelect={() => select.mutate(m.workerId)}
              />
            );
          })}
        </div>
      )}
    </EmployerShell>
  );
}

function CandidateCard({
  workerId,
  shortlistId,
  pipelineType,
  score,
  breakdown,
  existingOffer,
  disabled,
  onSelect,
}: {
  workerId: string;
  shortlistId: string;
  pipelineType: PipelineType;
  score: number;
  breakdown: { skills: number; experience: number; certification: number; rating: number };
  existingOffer: OfferRow | null;
  disabled: boolean;
  onSelect: () => void;
}) {
  const [offerOpen, setOfferOpen] = useState(false);
  const q = useQuery({
    queryKey: ['browsedWorker', workerId],
    queryFn: () => employersApi.getBrowsedWorker(workerId),
  });
  const p = q.data as PublicWorkerProfile | undefined;

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <CardEyebrow>Match score</CardEyebrow>
        <span className="h-display text-3xl tabular-nums">{score}</span>
      </div>
      <CardTitle>{p?.personal.fullName ?? 'Loading…'}</CardTitle>
      {p?.personal.stateOfOrigin ? (
        <p className="text-sm text-muted">{p.personal.stateOfOrigin}</p>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted">
        <Breakdown label="Skills" value={breakdown.skills} />
        <Breakdown label="Experience" value={breakdown.experience} />
        <Breakdown label="Certification" value={breakdown.certification} />
        <Breakdown label="Rating" value={breakdown.rating} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Badge tone="sage">Identity ✓</Badge>
        <Badge tone="sage">Background ✓</Badge>
        <Badge tone="sage">CPD ✓</Badge>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <TextLink href={`/employer/workers/${workerId}`} className="self-center">
          Full profile
        </TextLink>
        <div className="flex-1" />
        {existingOffer ? (
          <Badge tone={toneForOffer(existingOffer.status)}>{labelForOffer(existingOffer.status)}</Badge>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setOfferOpen(true)} disabled={disabled}>
            Send offer
          </Button>
        )}
        <Button size="sm" onClick={onSelect} disabled={disabled}>
          Select
        </Button>
      </div>
      <div className="mt-4">
        <RequestInterviewButton workerId={workerId} shortlistId={shortlistId} />
      </div>

      <SendOfferModal
        open={offerOpen}
        onClose={() => setOfferOpen(false)}
        shortlistId={shortlistId}
        workerId={workerId}
        workerName={p?.personal.fullName ?? 'this carer'}
        pipelineType={pipelineType}
      />
    </Card>
  );
}

function Breakdown({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-eyebrow text-muted">{label}</p>
      <p className="text-ink tabular-nums">{value}</p>
    </div>
  );
}
