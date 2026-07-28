'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminShell } from '@/components/dashboard/AdminShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { toast, toastApiError } from '@/lib/toast';
import { messagingApi } from '@/lib/messaging-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export function FlaggedMessagesView() {
  const queryClient = useQueryClient();
  const hydrated = useHydratedTokens();

  const list = useQuery({
    queryKey: ['adminFlaggedMessages'],
    queryFn: () => messagingApi.adminFlagged({ limit: 100 }),
    enabled: hydrated,
  });

  const release = useMutation({
    mutationFn: (id: string) => messagingApi.adminRelease(id),
    onSuccess: () => {
      toast.success('Reviewed.');
      queryClient.invalidateQueries({ queryKey: ['adminFlaggedMessages'] });
    },
    onError: (e) => toastApiError(e, 'Could not update.'),
  });
  const lock = useMutation({
    mutationFn: (id: string) => messagingApi.adminLock(id),
    onSuccess: () => {
      toast.success('Conversation locked.');
      queryClient.invalidateQueries({ queryKey: ['adminFlaggedMessages'] });
    },
    onError: (e) => toastApiError(e, 'Could not lock.'),
  });

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin · messaging"
        title="Flagged messages"
        description="Attempts to share off-platform contact details. These messages were blocked and never delivered. Review them, dismiss once seen, or lock the whole conversation."
      />

      <Card>
        <div className="space-y-4">
          {(list.data?.data ?? []).map((m) => (
            <div key={m.id} className="rounded-xl border border-ink/8 bg-cream-50/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1.5">
                    {m.blockedAt ? (
                      <Badge tone="terracotta" className="text-[10px]">Blocked, not delivered</Badge>
                    ) : null}
                    {m.flaggedReasons.map((r) => (
                      <Badge key={r} tone="terracotta" className="text-[10px]">{r}</Badge>
                    ))}
                  </div>
                  <p className="text-sm text-ink">{m.body}</p>
                  {m.blockedAt ? (
                    <p className="text-xs text-muted">Not delivered to the recipient.</p>
                  ) : m.redactedBody ? (
                    <p className="text-xs text-muted">
                      <span className="font-medium">Recipient sees:</span> {m.redactedBody}
                    </p>
                  ) : null}
                  <p className="text-[10px] text-muted">
                    {m.blockedAt ? 'Attempted' : 'Sent'} {new Date(m.createdAt).toLocaleString()} · conv {m.conversationId.slice(0, 8)}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => release.mutate(m.id)}
                    disabled={release.isPending}
                  >
                    {m.blockedAt ? 'Dismiss' : 'Release'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => lock.mutate(m.conversationId)}
                    disabled={lock.isPending}
                  >
                    Lock conversation
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {(list.data?.data ?? []).length === 0 ? (
            <p className="text-sm text-muted text-center py-8">No flagged messages.</p>
          ) : null}
        </div>
      </Card>
    </AdminShell>
  );
}
