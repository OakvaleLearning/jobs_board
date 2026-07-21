'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminShell } from '@/components/dashboard/AdminShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Field } from '@/app/(worker)/worker/profile/SectionFrame';
import { api } from '@/lib/api-client';
import { toast, toastApiError } from '@/lib/toast';
import { placementsApi, type MatchedCandidate } from '@/lib/placements-api';
import { employersApi } from '@/lib/employers-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

interface BrowseRow {
  id: string;
  fullName: string | null;
  stateOfOrigin: string | null;
  profileCompletionPct: number;
}

export function ShortlistOverride({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const hydrated = useHydratedTokens();
  const [order, setOrder] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const shortlist = useQuery({
    queryKey: ['adminShortlist', id],
    queryFn: () => placementsApi.adminShortlist(id),
    enabled: hydrated,
  });

  useEffect(() => {
    if (shortlist.data) setOrder(shortlist.data.workerIds.map((m) => m.workerId));
  }, [shortlist.data?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const candidates = useQuery({
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
    enabled: hydrated,
  });

  const save = useMutation({
    mutationFn: () => placementsApi.overrideShortlist(id, order),
    onSuccess: () => {
      toast.success('Shortlist override saved.');
      queryClient.invalidateQueries({ queryKey: ['adminShortlist', id] });
      queryClient.invalidateQueries({ queryKey: ['adminShortlists'] });
    },
    onError: (e) => toastApiError(e, 'Save failed.'),
  });

  function move(workerId: string, direction: 'up' | 'down') {
    setOrder((prev) => {
      const idx = prev.indexOf(workerId);
      if (idx < 0) return prev;
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target] as string, next[idx] as string];
      return next;
    });
  }
  function add(workerId: string) {
    setOrder((prev) => (prev.includes(workerId) ? prev : [...prev, workerId]));
  }
  function remove(workerId: string) {
    setOrder((prev) => prev.filter((w) => w !== workerId));
  }

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin · shortlist override"
        title={`Shortlist ${id.slice(0, 8)}`}
        description="Reorder, add, or remove workers before the employer sees the shortlist."
        actions={
          <Link
            href="/admin/shortlists"
            className="text-sm text-muted hover:text-ink underline underline-offset-4"
          >
            Back to list
          </Link>
        }
      />

      {!shortlist.data ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          <Card>
            <CardEyebrow>Current order</CardEyebrow>
            <CardTitle>{order.length} candidates</CardTitle>
            <ol className="mt-5 space-y-2">
              {order.map((wid, i) => (
                <OrderRow
                  key={wid}
                  workerId={wid}
                  position={i + 1}
                  match={shortlist.data?.workerIds.find((m) => m.workerId === wid)}
                  isFirst={i === 0}
                  isLast={i === order.length - 1}
                  onMoveUp={() => move(wid, 'up')}
                  onMoveDown={() => move(wid, 'down')}
                  onRemove={() => remove(wid)}
                />
              ))}
              {order.length === 0 ? (
                <li className="text-sm text-muted">No candidates. Add some from the right.</li>
              ) : null}
            </ol>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                size="sm"
                onClick={() => save.mutate()}
                disabled={save.isPending || order.length === 0}
              >
                {save.isPending ? 'Saving…' : 'Save override'}
              </Button>
            </div>
            <p className="text-xs text-muted mt-3">
              Re-scoring runs against the visibility-gated pool. Workers who fall out of the gate are dropped.
            </p>
          </Card>

          <Card>
            <CardEyebrow>Add a candidate</CardEyebrow>
            <Field label="Search workers">
              <Input
                placeholder="Name or skill…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Field>
            <ul className="mt-4 max-h-[28rem] overflow-auto rounded-xl border border-ink/8 bg-cream-50 divide-y divide-ink/8">
              {(candidates.data ?? []).map((c) => (
                <li key={c.id} className="px-3 py-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-ink">{c.fullName ?? c.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted">
                      {c.stateOfOrigin ?? '—'} · {c.profileCompletionPct}%
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => add(c.id)}
                    disabled={order.includes(c.id)}
                  >
                    {order.includes(c.id) ? 'Added' : 'Add'}
                  </Button>
                </li>
              ))}
              {candidates.isSuccess && (candidates.data ?? []).length === 0 ? (
                <li className="px-3 py-2 text-xs text-muted">No matches.</li>
              ) : null}
            </ul>
          </Card>
        </div>
      )}
    </AdminShell>
  );
}

function OrderRow({
  workerId,
  position,
  match,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  workerId: string;
  position: number;
  match: MatchedCandidate | undefined;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const q = useQuery({
    queryKey: ['browsedWorker', workerId],
    queryFn: () => employersApi.getBrowsedWorker(workerId),
    retry: false,
  });
  const name = q.data?.personal.fullName ?? workerId.slice(0, 8);

  return (
    <li className="flex items-center gap-3 rounded-xl border border-ink/8 bg-cream-50 px-3 py-3">
      <span className="h-display text-base text-muted tabular-nums w-6 text-right">{position}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink truncate">{name}</p>
        {match ? (
          <p className="text-xs text-muted">
            Score {match.score} · skills {match.breakdown.skills} · exp {match.breakdown.experience}
          </p>
        ) : (
          <p className="text-xs text-muted">Pending re-score</p>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Badge tone="sage">CPD ✓</Badge>
        <button
          type="button"
          className="text-xs text-muted hover:text-ink px-2"
          onClick={onMoveUp}
          disabled={isFirst}
          aria-label="Move up"
        >
          ▲
        </button>
        <button
          type="button"
          className="text-xs text-muted hover:text-ink px-2"
          onClick={onMoveDown}
          disabled={isLast}
          aria-label="Move down"
        >
          ▼
        </button>
        <button
          type="button"
          className="text-xs text-muted hover:text-terracotta-700 px-2"
          onClick={onRemove}
          aria-label="Remove"
        >
          ×
        </button>
      </div>
    </li>
  );
}
