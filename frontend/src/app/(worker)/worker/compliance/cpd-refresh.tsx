'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { complianceApi, type CpdEnrolment } from '@/lib/compliance-api';
import { toast, toastApiError } from '@/lib/toast';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

/** §14.2 — enrol in an Oakvale CPD refresh programme straight from the portal. */
export function CpdRefreshPanel() {
  const hydrated = useHydratedTokens();
  const queryClient = useQueryClient();

  const programmes = useQuery({
    queryKey: ['cpdProgrammes'],
    queryFn: complianceApi.cpdProgrammes,
    enabled: hydrated,
  });
  const enrolments = useQuery({
    queryKey: ['cpdEnrolments'],
    queryFn: complianceApi.cpdEnrolments,
    enabled: hydrated,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['cpdEnrolments'] });
    queryClient.invalidateQueries({ queryKey: ['complianceStatus'] });
  };

  const enrol = useMutation({
    mutationFn: (programmeId: string) => complianceApi.enrolCpd(programmeId),
    onSuccess: () => {
      toast.success('Enrolled. You’ll find the course in your LMS.');
      invalidate();
    },
    onError: (e) => toastApiError(e, 'Could not enrol.'),
  });

  const complete = useMutation({
    mutationFn: (id: string) => complianceApi.completeCpdEnrolment(id),
    onSuccess: () => {
      toast.success('Marked complete — a CPD record has been added.');
      invalidate();
    },
    onError: (e) => toastApiError(e, 'Could not complete.'),
  });

  const byProgramme = new Map<string, CpdEnrolment>();
  for (const e of enrolments.data ?? []) {
    // Keep the most recent enrolment per programme (list is newest-first).
    if (!byProgramme.has(e.programmeId)) byProgramme.set(e.programmeId, e);
  }

  return (
    <Card className="lg:col-span-2">
      <CardEyebrow>CPD refresh</CardEyebrow>
      <CardTitle>Enrol in an Oakvale refresher</CardTitle>
      <p className="text-sm text-ink-600 mt-2 max-w-xl">
        Keep your certification current. Enrol here and the course opens in the Oakvale LMS; once
        you finish, mark it complete to add it to your CPD record.
      </p>
      <ul className="mt-5 space-y-3">
        {(programmes.data ?? []).map((p) => {
          const enrolment = byProgramme.get(p.id);
          const done = enrolment?.status === 'COMPLETED';
          const active = enrolment && !done;
          return (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-ink/8 bg-cream-50 p-4"
            >
              <div>
                <p className="text-sm font-medium text-ink">{p.name}</p>
                <p className="text-xs text-muted mt-1">{p.hours} CPD hours</p>
              </div>
              {done ? (
                <Badge tone="sage">Completed</Badge>
              ) : active ? (
                <div className="flex items-center gap-2">
                  <Badge tone="neutral">Enrolled</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={complete.isPending}
                    onClick={() => complete.mutate(enrolment!.id)}
                  >
                    Mark complete
                  </Button>
                </div>
              ) : (
                <Button size="sm" disabled={enrol.isPending} onClick={() => enrol.mutate(p.id)}>
                  Enrol
                </Button>
              )}
            </li>
          );
        })}
        {(programmes.data ?? []).length === 0 ? (
          <li className="text-sm text-muted">No CPD programmes available right now.</li>
        ) : null}
      </ul>
    </Card>
  );
}
