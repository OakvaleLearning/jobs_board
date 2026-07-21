import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('paystack verifyWebhook', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = 'postgres://x:x@127.0.0.1/x';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.JWT_ACCESS_SECRET = 'x'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'y'.repeat(32);
    process.env.PAYSTACK_WEBHOOK_SECRET = 'paystack-test-secret';
    // loadEnv() caches on first call, so this must be set before any test runs.
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_x';
  });

  it('rejects a tampered signature', async () => {
    const { verifyWebhook } = await import('./client.js');
    const body = Buffer.from(JSON.stringify({ event: 'charge.success', data: {} }));
    expect(() => verifyWebhook(body, 'deadbeef')).toThrowError(/signature/i);
  });

  it('accepts a valid signature and parses JSON', async () => {
    const { verifyWebhook } = await import('./client.js');
    const body = Buffer.from(JSON.stringify({ event: 'charge.success', data: { ok: true } }));
    const sig = createHmac('sha512', 'paystack-test-secret').update(body).digest('hex');
    const result = verifyWebhook(body, sig) as { event: string; data: { ok: boolean } };
    expect(result.event).toBe('charge.success');
    expect(result.data.ok).toBe(true);
  });

  it('asserts currency is NGN', async () => {
    const { assertPaystackCurrency } = await import('./client.js');
    expect(() => assertPaystackCurrency('GBP')).toThrowError(/Paystack cannot charge/i);
    expect(() => assertPaystackCurrency('NGN')).not.toThrow();
  });
});

describe('paystack call timeout handling', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = 'postgres://x:x@127.0.0.1/x';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.JWT_ACCESS_SECRET = 'x'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'y'.repeat(32);
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_x';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps a timeout/abort to a typed PAYMENT_PROVIDER_ERROR 502', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError')),
    );
    const { initializeTransaction } = await import('./client.js');
    const { AppError } = await import('@/shared/errors/app-error.js');
    const promise = initializeTransaction({
      invoiceId: 'inv_1',
      amountMinor: 1000,
      currency: 'NGN',
      customerEmail: 'a@b.co',
      callbackUrl: 'https://example.com/cb',
      metadata: {},
    });
    await expect(promise).rejects.toBeInstanceOf(AppError);
    await expect(promise).rejects.toMatchObject({
      code: 'PAYMENT_PROVIDER_ERROR',
      statusCode: 502,
    });
  });

  it('maps a network error to a typed PAYMENT_PROVIDER_ERROR 502', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    const { initializeTransaction } = await import('./client.js');
    await expect(
      initializeTransaction({
        invoiceId: 'inv_1',
        amountMinor: 1000,
        currency: 'NGN',
        customerEmail: 'a@b.co',
        callbackUrl: 'https://example.com/cb',
        metadata: {},
      }),
    ).rejects.toMatchObject({ code: 'PAYMENT_PROVIDER_ERROR', statusCode: 502 });
  });
});
