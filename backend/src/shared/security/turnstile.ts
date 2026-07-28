import { loadEnv } from '@/shared/config/env.js';
import { AppError } from '@/shared/errors/app-error.js';
import { logger } from '@/shared/logger/logger.js';

const env = loadEnv();

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface SiteverifyResponse {
  success: boolean;
  'error-codes'?: string[];
}

let stubLogged = false;

/**
 * Verify a Cloudflare Turnstile token against the siteverify API. This is a
 * transport-layer anti-abuse gate (like rate-limiting) — it lives outside the
 * service so the service stays unit-testable without a captcha.
 *
 * Stub mode: when TURNSTILE_SECRET_KEY is unset the check is a no-op, keeping
 * local/dev/test signup frictionless (mirrors the RESEND_API_KEY stub).
 *
 * Fails closed: a missing token or a Cloudflare outage both reject, since this
 * guards an abuse-sensitive endpoint.
 */
export async function verifyTurnstile(token: string | undefined, ip?: string): Promise<void> {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (!stubLogged) {
      logger.debug('Turnstile disabled (TURNSTILE_SECRET_KEY unset) — skipping bot check');
      stubLogged = true;
    }
    return;
  }

  if (!token) {
    throw new AppError({
      code: 'CAPTCHA_REQUIRED',
      message: 'A bot-check challenge is required.',
      statusCode: 400,
    });
  }

  let result: SiteverifyResponse;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set('remoteip', ip);
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    result = (await res.json()) as SiteverifyResponse;
  } catch (cause) {
    logger.error({ err: cause }, 'Turnstile siteverify request failed');
    throw new AppError({
      code: 'CAPTCHA_FAILED',
      message: 'Bot check failed. Please retry.',
      statusCode: 400,
      cause,
    });
  }

  if (!result.success) {
    logger.warn({ errorCodes: result['error-codes'] }, 'Turnstile verification rejected');
    throw new AppError({
      code: 'CAPTCHA_FAILED',
      message: 'Bot check failed. Please retry.',
      statusCode: 400,
    });
  }
}
