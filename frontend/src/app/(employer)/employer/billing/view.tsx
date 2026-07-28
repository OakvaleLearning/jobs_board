'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EmployerShell } from '@/components/dashboard/EmployerShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Table, THead, TBody, TR, TH, TD, TableEmpty } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { toast, toastApiError } from '@/lib/toast';
import { employersApi } from '@/lib/employers-api';
import { paymentsApi, formatMoney, type Invoice, type Subscription } from '@/lib/payments-api';
import type { SubscriptionPlan } from '@oakvale/shared/enums/payment';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export function EmployerBillingView() {
  const queryClient = useQueryClient();
  const hydrated = useHydratedTokens();

  const profile = useQuery({
    queryKey: ['employerProfile'],
    queryFn: employersApi.me,
    enabled: hydrated,
  });
  const config = profile.data?.employerTypeConfig ?? null;
  const pipeline = config?.pipeline ?? 'INDIVIDUAL_EMPLOYER';

  const invoices = useQuery({
    queryKey: ['employerInvoices'],
    queryFn: paymentsApi.invoices,
    enabled: hydrated,
  });
  const subscription = useQuery({
    queryKey: ['employerSubscription'],
    queryFn: paymentsApi.subscription,
    enabled: hydrated,
  });

  const subscribe = useMutation({
    mutationFn: (plan: SubscriptionPlan) => paymentsApi.subscribe(plan),
    onSuccess: (data) => {
      window.location.href = data.checkoutUrl;
    },
    onError: (e) => toastApiError(e, 'Subscribe failed.'),
  });

  const cancel = useMutation({
    mutationFn: () => paymentsApi.cancelSubscription(),
    onSuccess: () => {
      toast.success('Subscription will cancel at period end.');
      queryClient.invalidateQueries({ queryKey: ['employerSubscription'] });
    },
    onError: (e) => toastApiError(e, 'Cancel failed.'),
  });

  const invoicePager = usePagination<Invoice>(invoices.data ?? []);

  const plan: SubscriptionPlan =
    pipeline === 'INDIVIDUAL_EMPLOYER' ? 'INDIVIDUAL_EMPLOYER_ANNUAL' : 'CORPORATE_ANNUAL';

  return (
    <EmployerShell config={config}>
      <PageHeader
        eyebrow={`${(config?.name ?? 'employer').toLowerCase()} · billing`}
        title="Billing & invoices"
        description="Manage your subscription and review every invoice on the account."
      />

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <Card>
          <CardEyebrow>Invoices</CardEyebrow>
          <CardTitle>{(invoices.data ?? []).length} on file</CardTitle>
          <div className="mt-5">
            <Table>
              <THead>
                <TR>
                  <TH>Created</TH>
                  <TH>Purpose</TH>
                  <TH>Amount</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {invoicePager.pageRows.map((inv: Invoice) => (
                  <TR key={inv.id}>
                    <TD>{new Date(inv.createdAt).toLocaleDateString()}</TD>
                    <TD>{inv.purpose}</TD>
                    <TD>{formatMoney(inv.amountMinor, inv.currency)}</TD>
                    <TD>
                      <Badge tone={inv.status === 'PAID' ? 'sage' : inv.status === 'REFUNDED' ? 'terracotta' : 'neutral'}>
                        {inv.status}
                      </Badge>
                    </TD>
                  </TR>
                ))}
                {(invoices.data ?? []).length === 0 ? (
                  <TableEmpty colSpan={4}>No invoices yet.</TableEmpty>
                ) : null}
              </TBody>
            </Table>
          </div>
          <Pagination state={invoicePager} />
        </Card>

        <Card>
          <CardEyebrow>Subscription</CardEyebrow>
          {subscription.data ? (
            <ActiveSubscriptionCard
              sub={subscription.data}
              onCancel={() => cancel.mutate()}
              isCancelling={cancel.isPending}
            />
          ) : (
            <div>
              <CardTitle>Annual access</CardTitle>
              <p className="text-sm text-ink-600 mt-3">
                Unlock unlimited shortlists, priority replacement SLAs, and revenue-tier dashboards.
              </p>
              <Button
                className="mt-5 w-full"
                onClick={() => subscribe.mutate(plan)}
                disabled={subscribe.isPending}
              >
                {subscribe.isPending ? 'Opening checkout…' : `Subscribe to ${plan}`}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </EmployerShell>
  );
}

function ActiveSubscriptionCard({
  sub,
  onCancel,
  isCancelling,
}: {
  sub: Subscription;
  onCancel: () => void;
  isCancelling: boolean;
}) {
  return (
    <div>
      <Badge tone={sub.status === 'ACTIVE' ? 'sage' : 'neutral'}>{sub.status}</Badge>
      <CardTitle>{sub.plan}</CardTitle>
      <p className="text-sm text-muted mt-2">
        {sub.currentPeriodEnd
          ? `Renews ${new Date(sub.currentPeriodEnd).toLocaleDateString()}`
          : 'Awaiting first webhook confirmation…'}
      </p>
      {sub.cancelAtPeriodEnd ? (
        <p className="text-xs text-terracotta-700 mt-3">Will cancel at end of period.</p>
      ) : sub.status === 'ACTIVE' ? (
        <Button className="mt-5 w-full" variant="outline" onClick={onCancel} disabled={isCancelling}>
          {isCancelling ? 'Cancelling…' : 'Cancel at period end'}
        </Button>
      ) : null}
    </div>
  );
}
