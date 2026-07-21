import Stripe from 'stripe';
import { loadEnv } from '@/shared/config/env.js';
import { AppError } from '@/shared/errors/app-error.js';
import type { Currency } from '@oakvale/shared/enums/payment.js';

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const env = loadEnv();
  if (!env.STRIPE_SECRET_KEY) {
    throw new AppError({
      code: 'PAYMENT_PROVIDER_ERROR',
      message: 'Stripe is not configured.',
      statusCode: 503,
    });
  }
  // Checkout-session creation runs in the request path (the redirect URL must
  // be returned synchronously), so bound it: SDK default timeout is 80s.
  cached = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
    timeout: 15_000,
    maxNetworkRetries: 1,
  });
  return cached;
}

export function assertStripeCurrency(currency: Currency): void {
  if (currency !== 'GBP' && currency !== 'USD') {
    throw new AppError({
      code: 'PIPELINE_CURRENCY_MISMATCH',
      message: `Stripe cannot charge in ${currency}.`,
      statusCode: 400,
    });
  }
}

export interface StripeCheckoutInput {
  invoiceId: string;
  amountMinor: number;
  currency: Currency;
  customerEmail: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}

export async function createCheckoutSession(input: StripeCheckoutInput): Promise<{
  id: string;
  url: string;
}> {
  assertStripeCurrency(input.currency);
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: input.customerEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: input.currency.toLowerCase(),
          unit_amount: input.amountMinor,
          product_data: { name: input.description },
        },
      },
    ],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: { ...input.metadata, invoiceId: input.invoiceId },
    payment_intent_data: {
      metadata: { ...input.metadata, invoiceId: input.invoiceId },
    },
  });
  if (!session.url) {
    throw new AppError({
      code: 'PAYMENT_PROVIDER_ERROR',
      message: 'Stripe did not return a checkout URL.',
      statusCode: 502,
    });
  }
  return { id: session.id, url: session.url };
}

export interface StripeSubscriptionInput {
  invoiceId: string;
  subscriptionId: string;
  priceId: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}

export async function createSubscriptionSession(
  input: StripeSubscriptionInput,
): Promise<{ id: string; url: string }> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: input.customerEmail,
    line_items: [{ price: input.priceId, quantity: 1 }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: {
      ...input.metadata,
      invoiceId: input.invoiceId,
      subscriptionId: input.subscriptionId,
    },
  });
  if (!session.url) {
    throw new AppError({
      code: 'PAYMENT_PROVIDER_ERROR',
      message: 'Stripe did not return a checkout URL.',
      statusCode: 502,
    });
  }
  return { id: session.id, url: session.url };
}

export function verifyWebhook(rawBody: Buffer, signature: string): Stripe.Event {
  const env = loadEnv();
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new AppError({
      code: 'WEBHOOK_SIGNATURE_INVALID',
      message: 'Stripe webhook secret not configured.',
      statusCode: 400,
    });
  }
  try {
    return getStripe().webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    throw new AppError({
      code: 'WEBHOOK_SIGNATURE_INVALID',
      message: 'Stripe webhook signature verification failed.',
      statusCode: 400,
      cause: err,
    });
  }
}

export async function refundPayment(paymentIntentId: string): Promise<{ id: string }> {
  const stripe = getStripe();
  const refund = await stripe.refunds.create({ payment_intent: paymentIntentId });
  return { id: refund.id };
}

export async function cancelSubscriptionAtPeriodEnd(
  providerSubscriptionId: string,
): Promise<void> {
  const stripe = getStripe();
  await stripe.subscriptions.update(providerSubscriptionId, { cancel_at_period_end: true });
}
