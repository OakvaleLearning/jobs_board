'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminShell } from '@/components/dashboard/AdminShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { RotateCcw } from 'lucide-react';
import { Table, THead, TBody, TR, TH, TD, TableEmpty } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { IconButton } from '@/components/ui/IconButton';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { toast, toastApiError } from '@/lib/toast';
import { adminApi } from '@/lib/admin-api';
import {
  paymentsApi,
  formatMoney,
  type Invoice,
  type PaymentRow,
  type Subscription,
} from '@/lib/payments-api';
import type { InvoiceStatus } from '@oakvale/shared/enums/payment';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

type Tab = 'invoices' | 'payments' | 'subscriptions';

export function AdminFinance() {
  const hydrated = useHydratedTokens();
  const [tab, setTab] = useState<Tab>('invoices');

  return (
    <AdminShell>
      <PageHeader
        eyebrow="Admin · finance"
        title="Money ledger"
        description="Invoices and payments are isolated by pipeline. Stripe never sees NGN; Paystack never sees GBP."
        actions={
          tab === 'invoices' ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => adminApi.exportCsv('invoices')}
            >
              Export CSV
            </Button>
          ) : null
        }
      />

      <div className="flex gap-2 mb-6">
        {(['invoices', 'payments', 'subscriptions'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={
              tab === t
                ? 'rounded-full bg-brand-500 text-white px-4 py-1.5 text-xs uppercase tracking-wide'
                : 'rounded-full border border-ink/15 text-muted px-4 py-1.5 text-xs uppercase tracking-wide hover:text-ink'
            }
          >
            {t}
          </button>
        ))}
      </div>

      {hydrated && tab === 'invoices' ? <InvoicesTab /> : null}
      {hydrated && tab === 'payments' ? <PaymentsTab /> : null}
      {hydrated && tab === 'subscriptions' ? <SubscriptionsTab /> : null}
    </AdminShell>
  );
}

function InvoicesTab() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<InvoiceStatus | ''>('');
  const [pipeline, setPipeline] = useState<'INDIVIDUAL_EMPLOYER' | 'CORPORATE' | ''>('');
  const [refundFor, setRefundFor] = useState<Invoice | null>(null);
  const [reason, setReason] = useState('');

  const list = useQuery({
    queryKey: ['adminInvoices', status, pipeline],
    queryFn: () =>
      paymentsApi.adminInvoices({
        status: (status || undefined) as InvoiceStatus | undefined,
        pipeline: (pipeline || undefined) as 'INDIVIDUAL_EMPLOYER' | 'CORPORATE' | undefined,
      }),
  });

  const refund = useMutation({
    mutationFn: () => paymentsApi.refund(refundFor!.id, reason),
    onSuccess: () => {
      toast.success('Refund processed.');
      setRefundFor(null);
      setReason('');
      queryClient.invalidateQueries({ queryKey: ['adminInvoices'] });
    },
    onError: (e) => toastApiError(e, 'Refund failed.'),
  });

  const pager = usePagination<Invoice>(list.data?.data ?? []);

  return (
    <Card>
      <CardEyebrow>Invoices</CardEyebrow>
      <CardTitle>{list.data?.data.length ?? 0} rows</CardTitle>
      <div className="mt-4 flex gap-3">
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as InvoiceStatus | '')}
          className="w-auto"
        >
          <option value="">Any status</option>
          {['OPEN', 'PAID', 'VOID', 'REFUNDED', 'FAILED'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
        <Select
          value={pipeline}
          onChange={(e) => setPipeline(e.target.value as 'INDIVIDUAL_EMPLOYER' | 'CORPORATE' | '')}
          className="w-auto"
        >
          <option value="">Any pipeline</option>
          <option value="INDIVIDUAL_EMPLOYER">Diaspora</option>
          <option value="CORPORATE">Corporate</option>
        </Select>
      </div>

      <div className="mt-5">
        <Table>
          <THead>
            <TR>
              <TH>Created</TH>
              <TH>Pipeline</TH>
              <TH>Purpose</TH>
              <TH>Amount</TH>
              <TH>Provider</TH>
              <TH>Status</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {pager.pageRows.map((inv: Invoice) => (
              <TR key={inv.id}>
                <TD>{new Date(inv.createdAt).toLocaleDateString()}</TD>
                <TD>{inv.pipeline}</TD>
                <TD>{inv.purpose}</TD>
                <TD>{formatMoney(inv.amountMinor, inv.currency)}</TD>
                <TD muted>{inv.provider}</TD>
                <TD>
                  <Badge tone={inv.status === 'PAID' ? 'sage' : inv.status === 'REFUNDED' ? 'terracotta' : 'neutral'}>
                    {inv.status}
                  </Badge>
                </TD>
                <TD>
                  <div className="flex items-center justify-end gap-1">
                    {inv.status === 'PAID' ? (
                      <IconButton icon={RotateCcw} label="Refund" tone="danger" onClick={() => setRefundFor(inv)} />
                    ) : null}
                  </div>
                </TD>
              </TR>
            ))}
            {(list.data?.data ?? []).length === 0 ? (
              <TableEmpty colSpan={7}>No invoices match these filters.</TableEmpty>
            ) : null}
          </TBody>
        </Table>
      </div>
      <Pagination state={pager} />

      {refundFor ? (
        <div className="mt-6 rounded-xl border border-terracotta-200 bg-terracotta-50/40 p-4">
          <CardEyebrow>Refund invoice {refundFor.id.slice(0, 8)}</CardEyebrow>
          <p className="text-sm text-ink-600 mt-2">
            This will call the provider refund API. Reason is required for the audit log.
          </p>
          <Input
            type="text"
            icon={null}
            placeholder="Reason for refund"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-3"
          />
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => refund.mutate()} disabled={reason.trim().length < 4 || refund.isPending}>
              {refund.isPending ? 'Refunding…' : 'Confirm refund'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setRefundFor(null); setReason(''); }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function PaymentsTab() {
  const list = useQuery({ queryKey: ['adminPayments'], queryFn: paymentsApi.adminPayments });
  const pager = usePagination<PaymentRow>(list.data?.data ?? []);
  return (
    <Card>
      <CardEyebrow>Payments</CardEyebrow>
      <CardTitle>{list.data?.data.length ?? 0} rows</CardTitle>
      <div className="mt-5">
        <Table>
          <THead>
            <TR>
              <TH>Captured</TH>
              <TH>Provider</TH>
              <TH>Reference</TH>
              <TH>Amount</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {pager.pageRows.map((p: PaymentRow) => (
              <TR key={p.id}>
                <TD>{p.capturedAt ? new Date(p.capturedAt).toLocaleString() : '—'}</TD>
                <TD muted>{p.provider}</TD>
                <TD className="font-mono text-xs">{p.providerPaymentId.slice(0, 24)}</TD>
                <TD>{formatMoney(p.amountMinor, p.currency)}</TD>
                <TD>
                  <Badge tone={p.status === 'SUCCEEDED' ? 'sage' : p.status === 'REFUNDED' ? 'terracotta' : 'neutral'}>
                    {p.status}
                  </Badge>
                </TD>
              </TR>
            ))}
            {(list.data?.data ?? []).length === 0 ? (
              <TableEmpty colSpan={5}>No payments yet.</TableEmpty>
            ) : null}
          </TBody>
        </Table>
      </div>
      <Pagination state={pager} />
    </Card>
  );
}

function SubscriptionsTab() {
  const list = useQuery({ queryKey: ['adminSubscriptions'], queryFn: paymentsApi.adminSubscriptions });
  const pager = usePagination<Subscription>(list.data?.data ?? []);
  return (
    <Card>
      <CardEyebrow>Subscriptions</CardEyebrow>
      <CardTitle>{list.data?.data.length ?? 0} rows</CardTitle>
      <div className="mt-5">
        <Table>
          <THead>
            <TR>
              <TH>Created</TH>
              <TH>Plan</TH>
              <TH>Provider</TH>
              <TH>Status</TH>
              <TH>Renews</TH>
            </TR>
          </THead>
          <TBody>
            {pager.pageRows.map((s: Subscription) => (
              <TR key={s.id}>
                <TD>{new Date(s.createdAt).toLocaleDateString()}</TD>
                <TD>{s.plan}</TD>
                <TD muted>{s.provider}</TD>
                <TD>
                  <Badge tone={s.status === 'ACTIVE' ? 'sage' : 'neutral'}>{s.status}</Badge>
                </TD>
                <TD>
                  {s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString() : '—'}
                </TD>
              </TR>
            ))}
            {(list.data?.data ?? []).length === 0 ? (
              <TableEmpty colSpan={5}>No subscriptions yet.</TableEmpty>
            ) : null}
          </TBody>
        </Table>
      </div>
      <Pagination state={pager} />
    </Card>
  );
}
