import { Resend } from 'resend';
import { loadEnv } from '@/shared/config/env.js';
import { logger } from '@/shared/logger/logger.js';
import { AppError } from '@/shared/errors/app-error.js';

let cached: Resend | null = null;

function client(): Resend | null {
  if (cached) return cached;
  const env = loadEnv();
  if (!env.RESEND_API_KEY) return null;
  cached = new Resend(env.RESEND_API_KEY);
  return cached;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

export interface SendEmailInput {
  to: string | string[];
  cc?: string[];
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
}

export async function sendEmail(input: SendEmailInput): Promise<{ id: string }> {
  const env = loadEnv();
  const c = client();
  if (!c) {
    logger.info(
      {
        to: input.to,
        subject: input.subject,
        attachments: input.attachments?.map((a) => a.filename),
      },
      '[stub] email send (no RESEND_API_KEY)',
    );
    return { id: `stub-email-${Date.now()}` };
  }
  const res = await c.emails.send({
    from: env.FROM_EMAIL,
    to: input.to,
    cc: input.cc,
    subject: input.subject,
    html: input.html,
    text: input.text,
    attachments: input.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
    })),
  });
  if (res.error) {
    throw new AppError({
      code: 'INTERNAL_ERROR',
      message: `Resend send failed: ${res.error.message}`,
      statusCode: 502,
    });
  }
  return { id: res.data?.id ?? '' };
}
