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
import { placementsApi } from '@/lib/placements-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export function WelfareEscalationsView() {
  const queryClient = useQueryClient();
  const hydrated = useHydratedTokens();
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  const list = useQuery({
    queryKey: ['welfareEscalationsOpen'],
    queryFn: placementsApi.openWelfareEscalations,
    enabled: hydrated,
  });

  const resolve = useMutation({
    mutationFn: (vars: { id: string; notes: string }) =>
      placementsApi.resolveWelfareEscalation(vars.id, vars.notes || undefined),
    onSuccess: () => {
      toast.success('Escalation resolved.');
      queryClient.invalidateQueries({ queryKey: ['welfareEscalationsOpen'] });
    },
    onError: (e) => toastApiError(e, 'Could not resolve.'),
  });

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin · welfare"
        title="Open welfare escalations"
        description="Welfare checks logged as FAIR or POOR. The 24-hour clock starts at creation; once it expires, all admins are paged."
      />

      <Card>
        <div className="space-y-4">
          {(list.data ?? []).map(({ escalation: e, placement }) => {
            const due = new Date(e.dueAt);
            const overdue = due.getTime() < Date.now();
            return (
              <div
                key={e.id}
                className="rounded-xl border border-ink/8 bg-cream-50/40 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <Badge tone={e.severity === 'POOR' ? 'terracotta' : 'brand'}>
                        {e.severity}
                      </Badge>
                      <span className="text-xs text-muted">
                        Placement {placement.id.slice(0, 8)} · {placement.pipelineType}
                      </span>
                      {overdue ? (
                        <Badge tone="terracotta" className="text-[10px]">
                          OVERDUE
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-ink">
                      Opened {new Date(e.createdAt).toLocaleString()} · due {due.toLocaleString()}
                    </p>
                    <Link
                      href={`/admin/placements/${placement.id}`}
                      className="text-xs text-muted underline underline-offset-2 hover:text-ink"
                    >
                      Open placement
                    </Link>
                  </div>
                </div>
                <div className="mt-3 flex flex-col md:flex-row gap-2">
                  <Input
                    type="text"
                    icon={null}
                    placeholder="Resolution notes (optional)"
                    value={notesById[e.id] ?? ''}
                    onChange={(ev) =>
                      setNotesById((s) => ({ ...s, [e.id]: ev.target.value }))
                    }
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={() =>
                      resolve.mutate({ id: e.id, notes: notesById[e.id] ?? '' })
                    }
                    disabled={resolve.isPending}
                  >
                    Resolve
                  </Button>
                </div>
              </div>
            );
          })}
          {(list.data ?? []).length === 0 ? (
            <p className="text-sm text-muted text-center py-8">
              No open welfare escalations.
            </p>
          ) : null}
        </div>
      </Card>
    </AdminShell>
  );
}
