'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminShell } from '@/components/dashboard/AdminShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Field, Select, Textarea } from '@/app/(worker)/worker/profile/SectionFrame';
import { toast, toastApiError } from '@/lib/toast';
import { adminApi } from '@/lib/admin-api';
import { AgentActivityPanel } from './activity';
import {
  AGENT_SPECIALTY_OPTIONS,
  AGENT_SPECIALTY_LABELS,
  type AgentSpecialty,
} from '@oakvale/shared/enums/admin';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export function AdminAgentDetail({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const hydrated = useHydratedTokens();

  const detail = useQuery({
    queryKey: ['adminAgent', id],
    queryFn: () => adminApi.agents.get(id),
    enabled: hydrated,
  });

  const update = useMutation({
    mutationFn: (patch: { specialty?: AgentSpecialty; region?: string | null; bio?: string | null; isActive?: boolean }) =>
      adminApi.agents.update(id, patch),
    onSuccess: () => {
      toast.success('Agent updated.');
      queryClient.invalidateQueries({ queryKey: ['adminAgent', id] });
    },
    onError: (e) => toastApiError(e, 'Update failed.'),
  });

  const removeAssignment = useMutation({
    mutationFn: (assignmentId: string) => adminApi.assignments.remove(assignmentId),
    onSuccess: () => {
      toast.success('Assignment removed.');
      queryClient.invalidateQueries({ queryKey: ['adminAgent', id] });
    },
    onError: (e) => toastApiError(e, 'Could not remove the assignment.'),
  });

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin · agent"
        title={detail.data?.user.fullName ?? 'Agent'}
        description={
          detail.data
            ? `${AGENT_SPECIALTY_LABELS[detail.data.profile.specialty]} · ${detail.data.user.email}`
            : ''
        }
        actions={
          <Link
            href="/admin/agents"
            className="text-sm text-muted hover:text-ink underline underline-offset-4"
          >
            Back to roster
          </Link>
        }
      />

      {!detail.data ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <Card>
            <CardEyebrow>Profile</CardEyebrow>
            <CardTitle>Editable</CardTitle>
            <div className="mt-5 grid md:grid-cols-2 gap-4">
              <Field label="Specialty">
                <Select
                  defaultValue={detail.data.profile.specialty}
                  onChange={(e) => update.mutate({ specialty: e.target.value as AgentSpecialty })}
                  options={AGENT_SPECIALTY_OPTIONS.map((s) => ({
                    value: s,
                    label: AGENT_SPECIALTY_LABELS[s],
                  }))}
                />
              </Field>
              <Field label="Region">
                <Input
                  defaultValue={detail.data.profile.region ?? ''}
                  onBlur={(e) => update.mutate({ region: e.target.value || null })}
                />
              </Field>
              <Field label="Bio" className="md:col-span-2">
                <Textarea
                  rows={4}
                  defaultValue={detail.data.profile.bio ?? ''}
                  onBlur={(e) => update.mutate({ bio: e.target.value || null })}
                />
              </Field>
            </div>

            <hr className="my-6 border-ink/10" />

            <h3 className="h-display text-xl">Active assignments</h3>
            <ul className="mt-4 space-y-2">
              {detail.data.assignments
                .filter((a) => !a.removedAt)
                .map((a) => (
                  <li
                    key={a.id}
                    className="rounded-xl border border-ink/8 bg-cream-50 px-4 py-3 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm text-ink">
                        {a.placementId ? `Placement · ${a.placementId.slice(0, 8)}` : `Worker · ${a.workerId?.slice(0, 8)}`}
                      </p>
                      <p className="text-xs text-muted">
                        {a.roleOnAssignment} · since {new Date(a.assignedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAssignment.mutate(a.id)}
                      className="text-xs text-muted hover:text-terracotta-700 underline underline-offset-4"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              {detail.data.assignments.filter((a) => !a.removedAt).length === 0 ? (
                <li className="text-sm text-muted">No active assignments yet.</li>
              ) : null}
            </ul>
          </Card>

          <Card>
            <CardEyebrow>Status</CardEyebrow>
            <CardTitle>
              <Badge tone={detail.data.user.isActive ? 'sage' : 'neutral'}>
                {detail.data.user.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </CardTitle>
            <p className="text-sm text-ink-600 mt-3">
              Deactivating an agent disables login but preserves the placement history for audit.
            </p>
            <Button
              className="mt-5 w-full"
              variant="outline"
              onClick={() =>
                update.mutate({ isActive: !detail.data!.user.isActive })
              }
              disabled={update.isPending}
            >
              {detail.data.user.isActive ? 'Deactivate' : 'Reactivate'}
            </Button>
          </Card>
        </div>
      )}

      {detail.data ? <AgentActivityPanel agentId={id} /> : null}
    </AdminShell>
  );
}
