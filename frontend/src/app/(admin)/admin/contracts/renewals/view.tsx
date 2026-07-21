'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminShell } from '@/components/dashboard/AdminShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast, toastApiError } from '@/lib/toast';
import { contractsApi } from '@/lib/contracts-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export function ContractRenewalsView() {
  const queryClient = useQueryClient();
  const hydrated = useHydratedTokens();
  const [draftById, setDraftById] = useState<Record<string, { start: string; end: string }>>({});

  const list = useQuery({
    queryKey: ['contractRenewalsDue'],
    queryFn: () => contractsApi.renewalsDue(60),
    enabled: hydrated,
  });

  const renew = useMutation({
    mutationFn: (vars: { id: string; start: string; end: string }) =>
      contractsApi.renew(vars.id, { newPeriodStart: vars.start, newPeriodEnd: vars.end }),
    onSuccess: () => {
      toast.success('Renewal generated.');
      queryClient.invalidateQueries({ queryKey: ['contractRenewalsDue'] });
    },
    onError: (e) => toastApiError(e, 'Could not generate renewal.'),
  });

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin · contracts"
        title="Partnership renewals due"
        description="Annual partnership agreements expiring within the next 60 days. Generate a renewal contract for the agent to walk the employer through."
      />

      <Card>
        <div className="space-y-4">
          {(list.data ?? []).map(({ contract: c, daysUntilExpiry }) => {
            const draft = draftById[c.id] ?? defaultDraft(c.expiresAt);
            return (
              <div key={c.id} className="rounded-xl border border-ink/8 bg-cream-50/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <Badge tone={daysUntilExpiry <= 14 ? 'terracotta' : 'brand'}>
                        {daysUntilExpiry}d to expiry
                      </Badge>
                      <span className="text-xs text-muted">
                        Contract {c.id.slice(0, 8)} · expires {c.expiresAt?.slice(0, 10) ?? '—'}
                      </span>
                    </div>
                    <Link
                      href={`/admin/contracts`}
                      className="text-xs text-muted underline underline-offset-2 hover:text-ink"
                    >
                      Open contract list
                    </Link>
                  </div>
                </div>
                <div className="mt-3 grid md:grid-cols-[1fr_1fr_auto] gap-2 items-center">
                  <Input
                    type="date"
                    value={draft.start}
                    onChange={(e) =>
                      setDraftById((s) => ({ ...s, [c.id]: { ...draft, start: e.target.value } }))
                    }
                  />
                  <Input
                    type="date"
                    value={draft.end}
                    onChange={(e) =>
                      setDraftById((s) => ({ ...s, [c.id]: { ...draft, end: e.target.value } }))
                    }
                  />
                  <Button
                    size="sm"
                    onClick={() =>
                      renew.mutate({ id: c.id, start: draft.start, end: draft.end })
                    }
                    disabled={renew.isPending || !draft.start || !draft.end}
                  >
                    Generate renewal
                  </Button>
                </div>
              </div>
            );
          })}
          {(list.data ?? []).length === 0 ? (
            <p className="text-sm text-muted text-center py-8">
              No partnership renewals due in the next 60 days.
            </p>
          ) : null}
        </div>
      </Card>
    </AdminShell>
  );
}

function defaultDraft(expiresAt: string | null): { start: string; end: string } {
  const base = expiresAt ? new Date(expiresAt) : new Date();
  const start = new Date(base.getTime() + 24 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 365 * 24 * 60 * 60 * 1000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}
