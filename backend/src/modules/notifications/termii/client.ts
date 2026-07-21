import { loadEnv } from '@/shared/config/env.js';
import { logger } from '@/shared/logger/logger.js';
import { AppError } from '@/shared/errors/app-error.js';

const TERMII_ENDPOINT = 'https://api.ng.termii.com/api/sms/send';

export interface SendSmsInput {
  to: string;
  body: string;
}

export async function sendSms(input: SendSmsInput): Promise<{ id: string }> {
  const env = loadEnv();
  if (!env.TERMII_API_KEY) {
    logger.info({ to: input.to, body: input.body.slice(0, 80) }, '[stub] SMS dispatch (no TERMII_API_KEY)');
    return { id: `stub-sms-${Date.now()}` };
  }
  const payload = {
    to: input.to,
    from: env.TERMII_SENDER_ID || 'Oakvale',
    sms: input.body,
    type: 'plain',
    channel: 'generic',
    api_key: env.TERMII_API_KEY,
  };
  const res = await fetch(TERMII_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new AppError({
      code: 'NOTIFICATION_PROVIDER_ERROR',
      message: `Termii send failed: ${res.status} ${text.slice(0, 200)}`,
      statusCode: 502,
    });
  }
  const data = (await res.json().catch(() => ({}))) as { message_id?: string };
  return { id: data.message_id ?? `termii-${Date.now()}` };
}
