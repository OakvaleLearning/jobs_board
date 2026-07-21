import { createHmac, timingSafeEqual } from 'node:crypto';
import { loadEnv } from '@/shared/config/env.js';
import { AppError } from '@/shared/errors/app-error.js';
import type { Currency } from '@oakvale/shared/enums/payment.js';

const PAYSTACK_BASE = 'https://api.paystack.co';

function authHeader(): string {
  const env = loadEnv();
  if (!env.PAYSTACK_SECRET_KEY) {
    throw new AppError({
      code: 'PAYMENT_PROVIDER_ERROR',
      message: 'Paystack is not configured.',
      statusCode: 503,
    });
  }
  return `Bearer ${env.PAYSTACK_SECRET_KEY}`;
}

/** Calls run in the request path (checkout redirect), so bound them. */
const PAYSTACK_TIMEOUT_MS = 15_000;

async function call<T>(path: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${PAYSTACK_BASE}${path}`, {
      ...init,
      signal: AbortSignal.timeout(PAYSTACK_TIMEOUT_MS),
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader(),
        ...(init.headers ?? {}),
      },
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError({
      code: 'PAYMENT_PROVIDER_ERROR',
      message: `Paystack call ${path} failed (timeout or network error).`,
      statusCode: 502,
      cause: err,
    });
  }
  const body = (await res.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: T };
  if (!res.ok || body.status === false) {
    throw new AppError({
      code: 'PAYMENT_PROVIDER_ERROR',
      message: body.message ?? `Paystack call ${path} failed (${res.status}).`,
      statusCode: 502,
    });
  }
  return body.data as T;
}

export function assertPaystackCurrency(currency: Currency): void {
  if (currency !== 'NGN') {
    throw new AppError({
      code: 'PIPELINE_CURRENCY_MISMATCH',
      message: `Paystack cannot charge in ${currency}.`,
      statusCode: 400,
    });
  }
}

export interface PaystackInitInput {
  invoiceId: string;
  amountMinor: number;
  currency: Currency;
  customerEmail: string;
  callbackUrl: string;
  metadata: Record<string, string>;
}

export async function initializeTransaction(input: PaystackInitInput): Promise<{
  reference: string;
  authorizationUrl: string;
  accessCode: string;
}> {
  assertPaystackCurrency(input.currency);
  const data = await call<{
    reference: string;
    authorization_url: string;
    access_code: string;
  }>(`/transaction/initialize`, {
    method: 'POST',
    body: JSON.stringify({
      email: input.customerEmail,
      amount: input.amountMinor,
      currency: input.currency,
      callback_url: input.callbackUrl,
      metadata: { ...input.metadata, invoiceId: input.invoiceId },
    }),
  });
  return {
    reference: data.reference,
    authorizationUrl: data.authorization_url,
    accessCode: data.access_code,
  };
}

export interface PaystackSubscribeInput {
  invoiceId: string;
  subscriptionId: string;
  planCode: string;
  customerEmail: string;
  callbackUrl: string;
  metadata: Record<string, string>;
}

export async function initializeSubscription(
  input: PaystackSubscribeInput,
): Promise<{ reference: string; authorizationUrl: string }> {
  const data = await call<{ reference: string; authorization_url: string }>(
    `/transaction/initialize`,
    {
      method: 'POST',
      body: JSON.stringify({
        email: input.customerEmail,
        amount: 0,
        plan: input.planCode,
        callback_url: input.callbackUrl,
        metadata: {
          ...input.metadata,
          invoiceId: input.invoiceId,
          subscriptionId: input.subscriptionId,
        },
      }),
    },
  );
  return { reference: data.reference, authorizationUrl: data.authorization_url };
}

export async function disableSubscription(
  providerSubscriptionId: string,
  emailToken: string,
): Promise<void> {
  await call(`/subscription/disable`, {
    method: 'POST',
    body: JSON.stringify({ code: providerSubscriptionId, token: emailToken }),
  });
}

export async function refundTransaction(reference: string): Promise<{ id: string }> {
  const data = await call<{ id: number }>(`/refund`, {
    method: 'POST',
    body: JSON.stringify({ transaction: reference }),
  });
  return { id: String(data.id) };
}

export function verifyWebhook(rawBody: Buffer, signature: string): unknown {
  const env = loadEnv();
  if (!env.PAYSTACK_WEBHOOK_SECRET) {
    throw new AppError({
      code: 'WEBHOOK_SIGNATURE_INVALID',
      message: 'Paystack webhook secret not configured.',
      statusCode: 400,
    });
  }
  const expected = createHmac('sha512', env.PAYSTACK_WEBHOOK_SECRET).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature ?? '', 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new AppError({
      code: 'WEBHOOK_SIGNATURE_INVALID',
      message: 'Paystack webhook signature verification failed.',
      statusCode: 400,
    });
  }
  try {
    return JSON.parse(rawBody.toString('utf8'));
  } catch (err) {
    throw new AppError({
      code: 'WEBHOOK_SIGNATURE_INVALID',
      message: 'Paystack webhook body is not valid JSON.',
      statusCode: 400,
      cause: err,
    });
  }
}
