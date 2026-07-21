'use client';

import { api } from './api-client';
import type {
  Currency,
  InvoicePurpose,
  InvoiceStatus,
  PaymentProvider,
  PaymentStatus,
  SubscriptionPlan,
  SubscriptionStatus,
} from '@oakvale/shared/enums/payment';

export interface Invoice {
  id: string;
  employerId: string;
  placementId: string | null;
  subscriptionId: string | null;
  pipeline: 'INDIVIDUAL_EMPLOYER' | 'CORPORATE';
  purpose: InvoicePurpose;
  status: InvoiceStatus;
  currency: Currency;
  amountMinor: number;
  dueAt: string | null;
  paidAt: string | null;
  provider: PaymentProvider;
  providerInvoiceId: string | null;
  createdAt: string;
}

export interface PaymentRow {
  id: string;
  invoiceId: string;
  provider: PaymentProvider;
  providerPaymentId: string;
  amountMinor: number;
  currency: Currency;
  status: PaymentStatus;
  capturedAt: string | null;
  createdAt: string;
}

export interface Subscription {
  id: string;
  employerId: string;
  plan: SubscriptionPlan;
  provider: PaymentProvider;
  providerSubscriptionId: string | null;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
}

export const paymentsApi = {
  createPlacementCheckout: (placementId: string) =>
    api
      .post<{ data: { invoiceId: string; checkoutUrl: string } }>(
        `/payments/placements/${placementId}/checkout`,
        {},
      )
      .then((r) => r.data),

  invoices: () => api.get<{ data: Invoice[] }>('/payments/invoices/me').then((r) => r.data),

  subscription: () =>
    api.get<{ data: Subscription | null }>('/payments/subscriptions/me').then((r) => r.data),

  subscribe: (plan: SubscriptionPlan) =>
    api
      .post<{ data: { subscriptionId: string; checkoutUrl: string } }>(
        '/payments/subscriptions/checkout',
        { plan },
      )
      .then((r) => r.data),

  cancelSubscription: () => api.post('/payments/subscriptions/me/cancel', {}),

  adminInvoices: (params: {
    status?: InvoiceStatus;
    pipeline?: 'INDIVIDUAL_EMPLOYER' | 'CORPORATE';
    provider?: PaymentProvider;
    page?: number;
  }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) qs.set(k, String(v));
    });
    return api
      .get<{ data: Invoice[]; meta: { total: number; page: number; limit: number } }>(
        `/payments/admin/invoices${qs.toString() ? `?${qs}` : ''}`,
      )
      .then((r) => r);
  },
  adminPayments: () =>
    api
      .get<{ data: PaymentRow[]; meta: { total: number; page: number; limit: number } }>(
        '/payments/admin/payments',
      )
      .then((r) => r),
  adminSubscriptions: () =>
    api
      .get<{ data: Subscription[]; meta: { total: number; page: number; limit: number } }>(
        '/payments/admin/subscriptions',
      )
      .then((r) => r),
  refund: (invoiceId: string, reason: string) =>
    api.post(`/payments/admin/invoices/${invoiceId}/refund`, { reason }),
};

export function formatMoney(amountMinor: number, currency: Currency): string {
  const major = amountMinor / 100;
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(major);
  } catch {
    return `${currency} ${major.toFixed(2)}`;
  }
}
