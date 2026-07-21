'use client';

import { TextLink } from '@/components/ui/Link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminShell } from '@/components/dashboard/AdminShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field } from '@/app/(worker)/worker/profile/SectionFrame';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api-client';
import { toast, toastApiError } from '@/lib/toast';
import { placementsApi, type ReplacementRequestRow } from '@/lib/placements-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

interface BrowseRow {
  id: string;
  fullName: string | null;
  stateOfOrigin: string | null;
}

export function AdminReplacements() {
  const hydrated = useHydratedTokens();

  const open = useQuery({
    queryKey: ['adminOpenReplacements'],
    queryFn: placementsApi.openReplacements,
    enabled: hydrated,
    refetchInterval: 30_000,
  });

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin · replacements"
        title="Replacement queue."
        description="Open requests sorted by SLA deadline. Diaspora: 5 business days. Corporate: 3 business days. Requests inside the 90-day guarantee have the fee waived."
        actions={<Badge tone="neutral">{open.data?.length ?? 0} open</Badge>}
      />

      <div className="space-y-4">
        {(open.data ?? []).map((r) => (
          <RequestRow key={r.id} row={r} />
        ))}
        {open.isSuccess && (open.data ?? []).length === 0 ? (
          <Card className="text-muted">No open replacement requests.</Card>
        ) : null}
      </div>
    </AdminShell>
  );
}

function RequestRow({ row }: { row: ReplacementRequestRow }) {
  const queryClient = useQueryClient();
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');

  const hoursLeft = Math.round((new Date(row.slaDeadline).getTime() - Date.now()) / 3_600_000);
  const slaTone: 'terracotta' | 'sage' | 'neutral' =
    hoursLeft < 0 ? 'terracotta' : hoursLeft <= 24 ? 'terracotta' : hoursLeft <= 48 ? 'neutral' : 'sage';

  const workers = useQuery({
    queryKey: ['adminWorkerPickerSearch', search],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (search) qs.set('q', search);
      qs.set('limit', '10');
      const r = await api.get<{
        data: BrowseRow[];
        meta: { total: number; page: number; limit: number };
      }>(`/workers?${qs.toString()}`);
      return r.data;
    },
    enabled: showPicker,
  });

  const fulfil = useMutation({
    mutationFn: (newWorkerId: string) => placementsApi.fulfilReplacement(row.id, newWorkerId),
    onSuccess: () => {
      toast.success('Replacement assigned.');
      setShowPicker(false);
      queryClient.invalidateQueries({ queryKey: ['adminOpenReplacements'] });
      queryClient.invalidateQueries({ queryKey: ['adminPlacements'] });
    },
    onError: (e) => toastApiError(e, 'Fulfil failed.'),
  });

  return (
    <Card>
      <div className="grid lg:grid-cols-[1fr_220px_220px] gap-5 items-start">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <TextLink href={`/admin/placements/${row.originalPlacementId}`}>
              Placement {row.originalPlacementId.slice(0, 8)}
            </TextLink>
            <Badge tone={row.replacementFeeWaived ? 'sage' : 'terracotta'}>
              {row.replacementFeeWaived ? 'Fee waived (in guarantee)' : 'Fee payable'}
            </Badge>
          </div>
          <p className="text-sm text-ink-600">{row.reason}</p>
          <p className="text-xs text-muted mt-2">
            Requested {new Date(row.requestedAt).toLocaleString()}
          </p>
        </div>

        <div>
          <p className="text-eyebrow text-muted">SLA deadline</p>
          <p className="text-ink mt-1">{new Date(row.slaDeadline).toLocaleString()}</p>
          <Badge tone={slaTone} className="mt-2">
            {hoursLeft < 0 ? `Overdue ${Math.abs(hoursLeft)}h` : `${hoursLeft}h remaining`}
          </Badge>
        </div>

        <div>
          {!showPicker ? (
            <Button size="sm" onClick={() => setShowPicker(true)}>Fulfil</Button>
          ) : (
            <div className="space-y-3">
              <Field label="Find a worker">
                <Input
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </Field>
              <ul className="max-h-48 overflow-auto rounded-xl border border-ink/8 bg-cream-50 divide-y divide-ink/8">
                {(workers.data ?? []).map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="text-sm text-ink">{w.fullName ?? w.id.slice(0, 8)}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fulfil.mutate(w.id)}
                      disabled={fulfil.isPending}
                    >
                      Assign
                    </Button>
                  </li>
                ))}
                {workers.isSuccess && (workers.data ?? []).length === 0 ? (
                  <li className="px-3 py-2 text-xs text-muted">No matches.</li>
                ) : null}
              </ul>
              <button
                type="button"
                className="text-xs text-muted hover:text-ink underline underline-offset-4"
                onClick={() => setShowPicker(false)}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
