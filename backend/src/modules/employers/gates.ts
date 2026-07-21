import { eq } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import { employers } from '@/shared/db/schema.js';
import { AppError } from '@/shared/errors/app-error.js';
import { deriveTypeFlags, getEmployerType } from '@/modules/admin/employer-types.service.js';

/**
 * §6.2 — block consumption actions (worker search, job posting, offers, …) until an
 * Oakvale agent has verified and approved the employer. Profile/onboarding/document
 * upload stay open so a PENDING employer can complete their submission.
 */
export async function assertEmployerApproved(employerId: string): Promise<void> {
  const e = await db.query.employers.findFirst({ where: eq(employers.id, employerId) });
  if (!e) {
    throw new AppError({ code: 'EMPLOYER_NOT_FOUND', message: 'Employer not found.', statusCode: 404 });
  }
  if (e.verificationStatus !== 'APPROVED') {
    throw new AppError({
      code: 'EMPLOYER_NOT_VERIFIED',
      message:
        'Your account is awaiting Oakvale verification. You can search and hire once an agent approves it.',
      statusCode: 403,
      details: { verificationStatus: e.verificationStatus },
    });
  }
}

export async function assertNdpaConsentForCorporate(employerId: string): Promise<void> {
  const e = await db.query.employers.findFirst({ where: eq(employers.id, employerId) });
  if (!e) {
    throw new AppError({ code: 'EMPLOYER_NOT_FOUND', message: 'Employer not found.', statusCode: 404 });
  }
  if (!deriveTypeFlags(await getEmployerType(e.employerTypeId)).requiresNdpa) return;
  if (!e.ndpaConsentGiven) {
    throw new AppError({
      code: 'NDPA_CONSENT_REQUIRED',
      message:
        'NDPA 2023 data-processing consent is required before corporate accounts can view worker data.',
      statusCode: 403,
    });
  }
}
