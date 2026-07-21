'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { adminApi } from '@/lib/admin-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

function relative(date: string): string {
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function AgentActivityPanel({ agentId }: { agentId: string }) {
  const hydrated = useHydratedTokens();
  const list = useQuery({
    queryKey: ['agentActivity', agentId],
    queryFn: () => adminApi.agentActivity(agentId, { limit: 50 }),
    enabled: hydrated,
  });

  return (
    <Card className="mt-5">
      <CardEyebrow>Activity</CardEyebrow>
      <CardTitle>Recent actions</CardTitle>
      <ul className="mt-4 divide-y divide-ink/8 rounded-xl border border-ink/8 overflow-hidden">
        {(list.data?.data ?? []).map((item) => (
          <li key={`${item.refType}:${item.refId}:${item.occurredAt}`} className="px-4 py-3 bg-cream-50">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge tone="neutral">{item.kind}</Badge>
              <span className="text-xs text-muted">· {item.refType}</span>
              <span className="text-xs text-muted">· {relative(item.occurredAt)}</span>
            </div>
            <p className="text-sm text-ink mt-1.5">{item.summary}</p>
          </li>
        ))}
        {(list.data?.data ?? []).length === 0 ? (
          <li className="px-4 py-6 text-center text-muted text-sm">No activity yet.</li>
        ) : null}
      </ul>
    </Card>
  );
}
