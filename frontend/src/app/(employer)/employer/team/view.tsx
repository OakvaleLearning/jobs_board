'use client';

import { useState } from 'react';
import { TextLink } from '@/components/ui/Link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EmployerShell } from '@/components/dashboard/EmployerShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/app/(worker)/worker/profile/SectionFrame';
import { toast, toastApiError } from '@/lib/toast';
import { placementsApi, type Placement } from '@/lib/placements-api';
import { RateWorkerForm } from '@/components/placements/WorkerRatings';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';
import { useEmployerConfig } from '@/lib/use-employer-config';

export function CorporateTeam() {
  const queryClient = useQueryClient();
  const hydrated = useHydratedTokens();
  const config = useEmployerConfig();
  const [replaceFor, setReplaceFor] = useState<Placement | null>(null);
  const [rateFor, setRateFor] = useState<Placement | null>(null);
  const [reason, setReason] = useState('');

  const q = useQuery({
    queryKey: ['employerPlacements'],
    queryFn: placementsApi.employerMe,
    enabled: hydrated,
  });

  const replace = useMutation({
    mutationFn: ({ placementId, reason }: { placementId: string; reason: string }) =>
      placementsApi.requestReplacement(placementId, reason),
    onSuccess: () => {
      toast.success('Replacement requested.');
      setReplaceFor(null);
      setReason('');
      queryClient.invalidateQueries({ queryKey: ['employerPlacements'] });
    },
    onError: (e) => toastApiError(e, 'Replacement request failed.'),
  });

  const active = (q.data ?? []).filter((p) => p.status === 'ACTIVE' || p.status === 'SUSPENDED');

  return (
    <EmployerShell config={config}>
      <PageHeader
        eyebrow="Corporate · team"
        title="Your placed team."
        description="Workers on active placements across all your postings. Replacement requests trigger a 3 business-day SLA."
        actions={<Badge tone="neutral">{active.length} active</Badge>}
      />

      <div className="space-y-4">
        {active.map((p) => (
          <TeamRow
            key={p.id}
            placement={p}
            onRequestReplace={() => {
              setReason('');
              setReplaceFor(p);
            }}
            onRate={() => setRateFor(p)}
          />
        ))}
        {active.length === 0 ? (
          <Card className="text-muted">No active placements yet.</Card>
        ) : null}
      </div>

      <Modal
        open={replaceFor !== null}
        onClose={() => setReplaceFor(null)}
        title="Request a replacement"
        description="This triggers a 3 business-day SLA with your Oakvale agent."
      >
        <Textarea
          placeholder="Reason (at least 8 characters)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="min-h-[120px]"
        />
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="outline" onClick={() => setReplaceFor(null)} disabled={replace.isPending}>
            Cancel
          </Button>
          <Button
            disabled={reason.trim().length < 8 || replace.isPending}
            onClick={() => replaceFor && replace.mutate({ placementId: replaceFor.id, reason })}
          >
            {replace.isPending ? 'Sending…' : 'Request replacement'}
          </Button>
        </div>
      </Modal>

      <Modal open={rateFor !== null} onClose={() => setRateFor(null)} title="Rate this worker">
        {rateFor ? (
          <RateWorkerForm
            placementId={rateFor.id}
            workerId={rateFor.workerId}
            onDone={() => setRateFor(null)}
          />
        ) : null}
      </Modal>
    </EmployerShell>
  );
}

function TeamRow({
  placement,
  onRequestReplace,
  onRate,
}: {
  placement: Placement;
  onRequestReplace: () => void;
  onRate: () => void;
}) {
  return (
    <Card>
      <div className="grid lg:grid-cols-[1fr_1fr_auto] gap-5 items-start">
        <div>
          <p className="text-eyebrow text-muted">Placement</p>
          <p className="h-display text-2xl mt-1">{placement.id.slice(0, 8)}</p>
          <p className="text-sm text-muted mt-2">
            {placement.activatedAt
              ? `Active since ${new Date(placement.activatedAt).toLocaleDateString()}`
              : 'Awaiting activation'}
          </p>
          {placement.guaranteeExpiresAt ? (
            <p className="text-xs text-muted mt-1">
              Guarantee until {new Date(placement.guaranteeExpiresAt).toLocaleDateString()}
            </p>
          ) : null}
          {placement.status === 'SUSPENDED' ? (
            <Badge tone="terracotta" className="mt-3">SUSPENDED</Badge>
          ) : null}
        </div>

        <div>
          <p className="text-eyebrow text-muted">Detail</p>
          <TextLink
            href={`/employer/workers/${placement.workerId}`}
            className="text-sm mt-1 inline-block"
          >
            View worker profile →
          </TextLink>
        </div>

        <div className="flex flex-col gap-2">
          {placement.status === 'ACTIVE' ? (
            <Button size="sm" variant="outline" onClick={onRate}>
              Rate worker
            </Button>
          ) : null}
          <Button size="sm" variant="outline" onClick={onRequestReplace}>
            Request replacement
          </Button>
        </div>
      </div>
    </Card>
  );
}
