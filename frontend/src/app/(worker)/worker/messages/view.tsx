'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardShell, PageHeader } from '@/components/dashboard/Shell';
import { Card, CardEyebrow } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { messagingApi, type ConversationRow, type MessageRow } from '@/lib/messaging-api';
import { useAuth } from '@/lib/auth-store';
import { ApiError } from '@/lib/api-client';
import { toast, toastApiError } from '@/lib/toast';
import { cn } from '@/lib/cn';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';
import { WORKER_NAV } from '@/lib/worker-nav';

export function WorkerMessages() {
  const hydrated = useHydratedTokens();
  const [activeId, setActiveId] = useState<string | null>(null);

  const conversations = useQuery({
    queryKey: ['workerConversations'],
    queryFn: messagingApi.conversations,
    enabled: hydrated,
    refetchInterval: 15000,
  });

  const list = conversations.data ?? [];
  const active = list.find((c) => c.id === activeId) ?? list[0] ?? null;

  return (
    <DashboardShell surface="Worker portal" nav={WORKER_NAV}>
      <PageHeader
        eyebrow="Worker · messages"
        title="Your conversations."
        description="All contact with employers happens here. Messages that contain phone numbers, emails or social handles are blocked until a contract is signed — that keeps everyone protected."
      />

      {conversations.isLoading ? (
        <Card><p className="text-sm text-muted">Loading conversations…</p></Card>
      ) : list.length === 0 ? (
        <Card>
          <CardEyebrow>No conversations yet</CardEyebrow>
          <p className="text-sm text-ink-600 mt-3">
            When an employer shortlists you and opens a conversation, it appears here and we notify you.
          </p>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-[300px_1fr] gap-6 items-start">
          <Card className="!p-3">
            <ul className="divide-y divide-ink/8">
              {list.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(c.id)}
                    className={cn(
                      'w-full text-left px-3 py-3 rounded-xl transition text-sm',
                      active?.id === c.id ? 'bg-ink text-cream-50' : 'hover:bg-ink/5 text-ink-600',
                    )}
                  >
                    <span className="block font-medium">Employer conversation</span>
                    <span className={cn('block text-xs mt-0.5', active?.id === c.id ? 'text-cream-200/70' : 'text-muted')}>
                      {c.lastMessageAt ? `Last message ${new Date(c.lastMessageAt).toLocaleString()}` : 'No messages yet'}
                      {c.status === 'LOCKED' ? ' · locked' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          {active ? <Thread conversation={active} /> : null}
        </div>
      )}
    </DashboardShell>
  );
}

function Thread({ conversation }: { conversation: ConversationRow }) {
  const queryClient = useQueryClient();
  const me = useAuth((s) => s.user?.id ?? null);
  const [draft, setDraft] = useState('');
  const [blockedHint, setBlockedHint] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = useQuery({
    queryKey: ['workerMessages', conversation.id],
    queryFn: () => messagingApi.messages(conversation.id),
    refetchInterval: 5000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.data?.length]);

  const send = useMutation({
    mutationFn: () => messagingApi.send(conversation.id, draft.trim()),
    onSuccess: () => {
      setDraft('');
      setBlockedHint(null);
      void queryClient.invalidateQueries({ queryKey: ['workerMessages', conversation.id] });
      void queryClient.invalidateQueries({ queryKey: ['workerConversations'] });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'CONTACT_DETAILS_BLOCKED') {
        // Draft is kept so the worker can edit and resend.
        setBlockedHint('Message not sent — please remove phone numbers, emails or social handles.');
        toast.error('Message not sent — remove contact details and try again.');
        return;
      }
      setBlockedHint(null);
      toastApiError(e, 'Message failed to send.');
    },
  });

  const locked = conversation.status === 'LOCKED';

  return (
    <Card className="flex flex-col max-h-[70vh]">
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-ink/8">
        <CardEyebrow>Conversation</CardEyebrow>
        {locked ? <Badge tone="terracotta">Locked by Oakvale</Badge> : <Badge tone="neutral">Monitored by Oakvale</Badge>}
      </div>

      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        {(messages.data ?? []).map((m) => (
          <Bubble key={m.id} message={m} mine={m.senderUserId === me} />
        ))}
        {(messages.data ?? []).length === 0 ? (
          <p className="text-sm text-muted text-center py-8">No messages yet — say hello.</p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <div className="pt-3 border-t border-ink/8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim().length > 0 && !send.isPending) send.mutate();
          }}
          className="flex gap-2"
        >
          <input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (blockedHint) setBlockedHint(null);
            }}
            disabled={locked}
            placeholder={locked ? 'This conversation has been locked by an Oakvale agent.' : 'Write a message…'}
            className="flex-1 rounded-xl border border-ink/12 bg-white px-4 h-11 text-sm text-ink shadow-edge focus:outline-none focus:border-ink/40 transition"
          />
          <Button size="sm" type="submit" disabled={locked || draft.trim().length === 0 || send.isPending}>
            {send.isPending ? 'Sending…' : 'Send'}
          </Button>
        </form>
        {blockedHint ? <p className="text-xs text-terracotta-600 mt-2">{blockedHint}</p> : null}
      </div>
    </Card>
  );
}

function Bubble({ message, mine }: { message: MessageRow; mine: boolean }) {
  const text = message.redactedBody ?? message.body;
  return (
    <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm',
          mine ? 'bg-ink text-cream-50' : 'bg-cream-200/60 text-ink-600',
        )}
      >
        <p className="whitespace-pre-wrap">{text}</p>
        <p className={cn('text-[10px] mt-1', mine ? 'text-cream-200/60' : 'text-muted')}>
          {new Date(message.createdAt).toLocaleString()}
          {message.redactedBody ? ' · contact details removed' : ''}
        </p>
      </div>
    </div>
  );
}
