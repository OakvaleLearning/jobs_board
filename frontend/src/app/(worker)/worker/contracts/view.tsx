'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { DashboardShell, PageHeader } from '@/components/dashboard/Shell';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { contractsApi, type ContractRow } from '@/lib/contracts-api';
import type { ContractStatus } from '@oakvale/shared/enums/contracts';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';
import { WORKER_NAV } from '@/lib/worker-nav';

export function WorkerContracts() {
  const hydrated = useHydratedTokens();

  const contracts = useQuery({
    queryKey: ['workerContracts'],
    queryFn: contractsApi.mine,
    enabled: hydrated,
  });

  const awaitingMe = (contracts.data ?? []).filter((c) => c.status === 'AWAITING_WORKER');

  return (
    <DashboardShell surface="Worker portal" nav={WORKER_NAV}>
      <PageHeader
        eyebrow="Worker · contracts"
        title="Your agreements."
        description="Placement agreements between you and Oakvale. Both parties must sign before a placement goes active."
        actions={awaitingMe.length > 0 ? <Badge tone="terracotta">{awaitingMe.length} awaiting your signature</Badge> : null}
      />

      {contracts.isLoading ? (
        <Card><p className="text-sm text-muted">Loading contracts…</p></Card>
      ) : (contracts.data ?? []).length === 0 ? (
        <Card>
          <CardEyebrow>No contracts yet</CardEyebrow>
          <CardTitle>Nothing to sign right now.</CardTitle>
          <p className="text-sm text-ink-600 mt-3">
            When you accept an offer, your placement agreement is generated and appears here for digital signing.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {(contracts.data ?? []).map((c) => (
            <Link key={c.id} href={`/worker/contracts/${c.id}`} className="block">
              <Card className="hover:border-ink/25 transition cursor-pointer">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardEyebrow>{labelForType(c)}</CardEyebrow>
                    <p className="text-sm text-ink-600 mt-2">
                      Created {new Date(c.createdAt).toLocaleDateString()}
                      {c.fullyExecutedAt ? ` · executed ${new Date(c.fullyExecutedAt).toLocaleDateString()}` : ''}
                      {c.expiresAt ? ` · expires ${new Date(c.expiresAt).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <Badge tone={toneForContract(c.status)}>{labelForContract(c.status)}</Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}

function labelForType(c: ContractRow): string {
  switch (c.type) {
    case 'WORKER_PLACEMENT': return 'Worker placement agreement';
    case 'EMPLOYER_SERVICE': return 'Employer service agreement';
    case 'ANNUAL_PARTNERSHIP': return 'Annual partnership agreement';
    default: return c.type;
  }
}

export function toneForContract(s: ContractStatus): 'neutral' | 'sage' | 'terracotta' | 'brand' {
  switch (s) {
    case 'FULLY_EXECUTED': return 'sage';
    case 'AWAITING_WORKER': return 'terracotta';
    case 'AWAITING_EMPLOYER': return 'brand';
    case 'TERMINATED':
    case 'DISPUTED': return 'terracotta';
    default: return 'neutral';
  }
}

export function labelForContract(s: ContractStatus): string {
  switch (s) {
    case 'AWAITING_WORKER': return 'Awaiting your signature';
    case 'AWAITING_EMPLOYER': return 'Awaiting employer signature';
    case 'FULLY_EXECUTED': return 'Fully executed';
    case 'SUPERSEDED': return 'Superseded';
    case 'TERMINATED': return 'Terminated';
    case 'DISPUTED': return 'Disputed';
    default: return 'Draft';
  }
}
