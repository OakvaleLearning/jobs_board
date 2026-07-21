'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardShell, PageHeader } from '@/components/dashboard/Shell';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { contractsApi } from '@/lib/contracts-api';
import { toast, toastApiError } from '@/lib/toast';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';
import { WORKER_NAV } from '@/lib/worker-nav';
import { labelForContract, toneForContract } from '../view';

export function WorkerContractDetail({ contractId }: { contractId: string }) {
  const hydrated = useHydratedTokens();
  const queryClient = useQueryClient();
  const [consent, setConsent] = useState(false);
  const [typedName, setTypedName] = useState('');
  const [password, setPassword] = useState('');

  const detail = useQuery({
    queryKey: ['workerContract', contractId],
    queryFn: () => contractsApi.detail(contractId),
    enabled: hydrated,
  });

  const sign = useMutation({
    mutationFn: () =>
      contractsApi.sign(contractId, { party: 'WORKER', typedName: typedName.trim(), password }),
    onSuccess: () => {
      setPassword('');
      toast.success('Agreement signed.');
      void queryClient.invalidateQueries({ queryKey: ['workerContract', contractId] });
      void queryClient.invalidateQueries({ queryKey: ['workerContracts'] });
      void queryClient.invalidateQueries({ queryKey: ['workerPlacements'] });
    },
    onError: (e) => toastApiError(e, 'Signing failed. Check your password and try again.'),
  });

  const contract = detail.data?.contract;
  const signatures = detail.data?.signatures ?? [];
  const myTurn = contract?.status === 'AWAITING_WORKER';
  const workerSignature = signatures.find((s) => s.party === 'WORKER');

  return (
    <DashboardShell surface="Worker portal" nav={WORKER_NAV}>
      <PageHeader
        eyebrow="Worker · contract"
        title="Placement agreement."
        description="Read the full agreement below. Signing is a binding action recorded with your account and a timestamp."
        actions={
          <Link href="/worker/contracts" className="text-sm text-muted hover:text-ink underline underline-offset-4">
            Back to contracts
          </Link>
        }
      />

      {detail.isLoading ? (
        <Card><p className="text-sm text-muted">Loading contract…</p></Card>
      ) : !contract ? (
        <Card><p className="text-sm text-terracotta-700">Contract not found.</p></Card>
      ) : (
        <div className="grid lg:grid-cols-[1fr_340px] gap-6">
          <Card>
            <div className="flex items-center justify-between gap-3">
              <CardEyebrow>Agreement text</CardEyebrow>
              <Badge tone={toneForContract(contract.status)}>{labelForContract(contract.status)}</Badge>
            </div>
            <div className="mt-5 rounded-xl border border-ink/8 bg-cream-50 p-6 max-h-[60vh] overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm text-ink-600 font-sans">{contract.bodyRendered}</pre>
            </div>
          </Card>

          <div className="space-y-5">
            <Card>
              <CardEyebrow>Signatures</CardEyebrow>
              <ul className="mt-4 space-y-3 text-sm">
                {signatures.length === 0 ? <li className="text-muted">No signatures yet.</li> : null}
                {signatures.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3">
                    <span className="text-ink-600">{s.party.toLowerCase()} · {s.signerName}</span>
                    <Badge tone="sage">{new Date(s.signedAt).toLocaleDateString()}</Badge>
                  </li>
                ))}
              </ul>
            </Card>

            {myTurn && !workerSignature ? (
              <Card>
                <CardEyebrow>Sign this agreement</CardEyebrow>
                <CardTitle>Your signature is required.</CardTitle>
                <div className="mt-4 space-y-3">
                  <label className="flex items-start gap-3 text-sm text-ink-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-terracotta-500"
                    />
                    I have read and agree to the terms of this agreement. I understand this is a
                    binding digital signature.
                  </label>
                  <div>
                    <p className="text-xs text-muted mb-1">Type your full legal name</p>
                    <Input value={typedName} onChange={(e) => setTypedName(e.target.value)} placeholder="Full name" />
                  </div>
                  <div>
                    <p className="text-xs text-muted mb-1">Confirm with your account password</p>
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => sign.mutate()}
                    disabled={!consent || typedName.trim().length < 2 || password.length === 0 || sign.isPending}
                  >
                    {sign.isPending ? 'Signing…' : 'Sign agreement'}
                  </Button>
                </div>
              </Card>
            ) : null}

            {contract.status === 'FULLY_EXECUTED' ? (
              <Card>
                <CardEyebrow>All signed</CardEyebrow>
                <p className="text-sm text-ink-600 mt-3">
                  This agreement is fully executed{contract.fullyExecutedAt ? ` as of ${new Date(contract.fullyExecutedAt).toLocaleString()}` : ''}. Your placement can now go active.
                </p>
              </Card>
            ) : null}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
