export const PAYMENT_PROVIDERS = ['STRIPE', 'PAYSTACK'] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const CURRENCIES = ['GBP', 'USD', 'NGN'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const INVOICE_STATUSES = ['OPEN', 'PAID', 'VOID', 'REFUNDED', 'FAILED', 'PAST_DUE'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_PURPOSES = [
  'PLACEMENT_FEE',
  'REPLACEMENT_FEE',
  'SUBSCRIPTION',
] as const;
export type InvoicePurpose = (typeof INVOICE_PURPOSES)[number];

export const PAYMENT_STATUSES = [
  'SUCCEEDED',
  'FAILED',
  'REFUNDED',
  'PARTIAL_REFUND',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const SUBSCRIPTION_STATUSES = ['ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const SUBSCRIPTION_PLANS = ['INDIVIDUAL_EMPLOYER_ANNUAL', 'CORPORATE_ANNUAL'] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

export const PLAN_PRICING: Record<
  SubscriptionPlan,
  { amountMinor: number; currency: Currency; provider: PaymentProvider }
> = {
  INDIVIDUAL_EMPLOYER_ANNUAL: { amountMinor: 19900, currency: 'GBP', provider: 'STRIPE' },
  CORPORATE_ANNUAL: { amountMinor: 50000000, currency: 'NGN', provider: 'PAYSTACK' },
};

export const PLACEMENT_FEE_BY_PIPELINE: Record<
  'INDIVIDUAL_EMPLOYER' | 'CORPORATE',
  { amountMinor: number; currency: Currency; provider: PaymentProvider }
> = {
  INDIVIDUAL_EMPLOYER: { amountMinor: 75000, currency: 'GBP', provider: 'STRIPE' },
  CORPORATE: { amountMinor: 25000000, currency: 'NGN', provider: 'PAYSTACK' },
};
