import { loadEnv } from '@/shared/config/env.js';
import { logger } from '@/shared/logger/logger.js';
import { AppError } from '@/shared/errors/app-error.js';

/**
 * Oakvale LMS client. The real enrolment endpoint/auth is an unresolved Open Question
 * in the brief (§16 #1), so this follows the codebase's stub pattern (cf. the Resend
 * client): when LMS_API_URL/LMS_API_KEY are unset it logs and returns a mock enrolment
 * id, so the in-app flow works end-to-end in dev. Drop in the real call when the
 * endpoint is confirmed — only `enrolWorker` changes.
 */

export function isLmsConfigured(): boolean {
  const env = loadEnv();
  return Boolean(env.LMS_API_URL && env.LMS_API_KEY);
}

export interface LmsEnrolInput {
  workerId: string;
  programmeId: string;
  programmeName: string;
}

export async function enrolWorker(input: LmsEnrolInput): Promise<{ enrolmentId: string }> {
  const env = loadEnv();
  if (!isLmsConfigured()) {
    logger.info({ ...input }, '[stub] LMS enrolment (no LMS_API_URL/LMS_API_KEY)');
    return { enrolmentId: `stub-lms-${input.programmeId}-${Date.now()}` };
  }
  const res = await fetch(`${env.LMS_API_URL.replace(/\/$/, '')}/enrolments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.LMS_API_KEY}`,
    },
    body: JSON.stringify({ workerId: input.workerId, programmeId: input.programmeId }),
  });
  if (!res.ok) {
    throw new AppError({
      code: 'INTERNAL_ERROR',
      message: `LMS enrolment failed (${res.status}).`,
      statusCode: 502,
    });
  }
  const body = (await res.json().catch(() => ({}))) as { enrolmentId?: string; id?: string };
  return { enrolmentId: body.enrolmentId ?? body.id ?? `lms-${Date.now()}` };
}
