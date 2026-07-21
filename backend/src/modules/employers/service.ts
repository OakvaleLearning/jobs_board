import { and, eq } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import {
  corporateNeedsAssessments,
  individualEmployerNeedsAssessments,
  employerContacts,
  employers,
  users,
  type Employer,
} from '@/shared/db/schema.js';
import { AppError } from '@/shared/errors/app-error.js';
import { events } from '@/shared/events/bus.js';
import type {
  ContactCreateInput,
  ContactUpdateInput,
  CorporateNeedsAssessmentInput,
  IndividualEmployerNeedsAssessmentInput,
  EmployerProfileUpdate,
} from '@oakvale/shared/schema/employer.js';
import type { EmployerType } from '@oakvale/shared/enums/employer.js';
import type { Role } from '@oakvale/shared/roles.js';
import { employerTypes } from '@/shared/db/schema.js';
import { deriveTypeFlags, getEmployerType } from '@/modules/admin/employer-types.service.js';

/** Legacy mapping: the original two roles encoded the type. New EMPLOYER role does not. */
function inferLegacySlug(role: Role): EmployerType | null {
  if (role === 'INDIVIDUAL_EMPLOYER') return 'INDIVIDUAL_EMPLOYER';
  if (role === 'EMPLOYER_CORPORATE') return 'CORPORATE';
  return null;
}

/** Derived back-compat label for the slug (the DB enum column was dropped in Phase 5). */
export function legacyEnumForSlug(slug: string): EmployerType {
  return slug === 'INDIVIDUAL_EMPLOYER' || slug === 'CORPORATE' ? slug : 'OTHER';
}

/**
 * Bootstraps the employer row. Type resolution order:
 *  1. explicit `employerTypeId` (the configurable entity — new signup path),
 *  2. legacy role inference (INDIVIDUAL_EMPLOYER / EMPLOYER_CORPORATE → seeded slug).
 * `employer_type_id` is NOT NULL, so a type must resolve or we throw.
 */
export async function getOrCreateForUser(
  userId: string,
  opts: { employerTypeId?: string } = {},
): Promise<Employer> {
  const existing = await db.query.employers.findFirst({ where: eq(employers.userId, userId) });
  if (existing) return existing;

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) {
    throw new AppError({ code: 'EMPLOYER_NOT_FOUND', message: 'User not found.', statusCode: 404 });
  }

  let employerTypeId: string | null = null;

  if (opts.employerTypeId) {
    const type = await db.query.employerTypes.findFirst({
      where: eq(employerTypes.id, opts.employerTypeId),
    });
    if (!type) {
      throw new AppError({
        code: 'EMPLOYER_TYPE_NOT_FOUND',
        message: 'Employer type not found.',
        statusCode: 404,
      });
    }
    employerTypeId = type.id;
  } else {
    const inferred = inferLegacySlug(user.role);
    if (!inferred) {
      throw new AppError({
        code: 'WRONG_EMPLOYER_TYPE',
        message: 'User is not an employer or no employer type was supplied.',
        statusCode: 403,
      });
    }
    const match = await db.query.employerTypes.findFirst({
      where: eq(employerTypes.slug, inferred),
    });
    employerTypeId = match?.id ?? null;
  }

  if (!employerTypeId) {
    throw new AppError({
      code: 'EMPLOYER_TYPE_NOT_FOUND',
      message: 'Could not resolve an employer type for this user.',
      statusCode: 404,
    });
  }

  const [created] = await db.insert(employers).values({ userId, employerTypeId }).returning();
  if (!created) {
    throw new AppError({ code: 'INTERNAL_ERROR', message: 'Failed to create employer', statusCode: 500 });
  }
  return created;
}

export async function getByUserId(userId: string): Promise<Employer> {
  const e = await db.query.employers.findFirst({ where: eq(employers.userId, userId) });
  if (!e) {
    throw new AppError({ code: 'EMPLOYER_NOT_FOUND', message: 'Employer not found.', statusCode: 404 });
  }
  return e;
}

export async function getProfile(employerId: string) {
  const e = await db.query.employers.findFirst({ where: eq(employers.id, employerId) });
  if (!e) {
    throw new AppError({ code: 'EMPLOYER_NOT_FOUND', message: 'Employer not found.', statusCode: 404 });
  }
  const contacts = await db
    .select()
    .from(employerContacts)
    .where(eq(employerContacts.employerId, employerId));

  // §5: the type config is the authoritative discriminator now that the legacy
  // enum column is gone. Derived flags drive which needs assessment is loaded.
  const typeRow = await getEmployerType(e.employerTypeId);
  const flags = deriveTypeFlags(typeRow);

  const individualEmployerNeeds = flags.usesIndividualEmployerNeeds
    ? await db.query.individualEmployerNeedsAssessments.findFirst({
        where: eq(individualEmployerNeedsAssessments.employerId, employerId),
      })
    : null;
  const corporate = flags.usesCorporateNeeds
    ? await db.query.corporateNeedsAssessments.findFirst({
        where: eq(corporateNeedsAssessments.employerId, employerId),
      })
    : null;

  const employerTypeConfig = {
    id: typeRow.id,
    slug: typeRow.slug,
    name: typeRow.name,
    roleKey: typeRow.roleKey,
    serviceModel: typeRow.serviceModel,
    jobPostingEnabled: typeRow.jobPostingEnabled,
    onboardingSteps: typeRow.onboardingSteps,
    ...flags,
  };

  // §6.2 — resolve the assigned account manager (set on verification approval).
  const accountManager = e.accountManagerId
    ? ((await db.query.users.findFirst({ where: eq(users.id, e.accountManagerId) })) ?? null)
    : null;

  return {
    ...e,
    // Back-compat derived label (the DB enum column was dropped in Phase 5).
    employerType: legacyEnumForSlug(typeRow.slug),
    contacts,
    individualEmployerNeedsAssessment: individualEmployerNeeds ?? null,
    corporateNeedsAssessment: corporate ?? null,
    employerTypeConfig,
    accountManager: accountManager
      ? { name: accountManager.fullName, email: accountManager.email }
      : null,
  };
}

/** Loads the type config + derived flags for an employer by id. */
async function loadFlags(employerId: string) {
  const e = await db.query.employers.findFirst({ where: eq(employers.id, employerId) });
  if (!e) {
    throw new AppError({ code: 'EMPLOYER_NOT_FOUND', message: 'Employer not found.', statusCode: 404 });
  }
  return { employer: e, flags: deriveTypeFlags(await getEmployerType(e.employerTypeId)) };
}

export async function updateProfile(employerId: string, patch: EmployerProfileUpdate) {
  const [updated] = await db
    .update(employers)
    .set({
      orgName: patch.orgName,
      sector: patch.sector,
      regNumber: patch.regNumber,
      address: patch.address,
      website: patch.website,
      about: patch.about,
    })
    .where(eq(employers.id, employerId))
    .returning();
  if (!updated) {
    throw new AppError({ code: 'EMPLOYER_NOT_FOUND', message: 'Employer not found.', statusCode: 404 });
  }
  return updated;
}

export async function addContact(employerId: string, input: ContactCreateInput) {
  if (input.isPrimary) {
    await db
      .update(employerContacts)
      .set({ isPrimary: false })
      .where(eq(employerContacts.employerId, employerId));
  }
  const [row] = await db.insert(employerContacts).values({ ...input, employerId }).returning();
  return row;
}

export async function updateContact(employerId: string, contactId: string, patch: ContactUpdateInput) {
  if (patch.isPrimary) {
    await db
      .update(employerContacts)
      .set({ isPrimary: false })
      .where(eq(employerContacts.employerId, employerId));
  }
  const [row] = await db
    .update(employerContacts)
    .set(patch)
    .where(and(eq(employerContacts.id, contactId), eq(employerContacts.employerId, employerId)))
    .returning();
  return row;
}

export async function removeContact(employerId: string, contactId: string) {
  await db
    .delete(employerContacts)
    .where(and(eq(employerContacts.id, contactId), eq(employerContacts.employerId, employerId)));
}

export async function upsertIndividualEmployerNeedsAssessment(
  employerId: string,
  input: IndividualEmployerNeedsAssessmentInput,
) {
  const { flags } = await loadFlags(employerId);
  if (!flags.usesIndividualEmployerNeeds) {
    throw new AppError({
      code: 'WRONG_EMPLOYER_TYPE',
      message: 'Care assessment requires an individual-employer type.',
      statusCode: 403,
    });
  }
  await db
    .insert(individualEmployerNeedsAssessments)
    .values({ employerId, ...input })
    .onConflictDoUpdate({
      target: individualEmployerNeedsAssessments.employerId,
      set: input,
    });
}

export async function upsertCorporateNeedsAssessment(
  employerId: string,
  input: CorporateNeedsAssessmentInput,
) {
  const { flags } = await loadFlags(employerId);
  if (!flags.usesCorporateNeeds) {
    throw new AppError({
      code: 'WRONG_EMPLOYER_TYPE',
      message: 'Corporate needs assessment requires a corporate employer.',
      statusCode: 403,
    });
  }
  await db
    .insert(corporateNeedsAssessments)
    .values({ employerId, ...input })
    .onConflictDoUpdate({
      target: corporateNeedsAssessments.employerId,
      set: input,
    });
}

export async function getPrimaryContact(employerId: string) {
  const row = await db.query.employerContacts.findFirst({
    where: and(eq(employerContacts.employerId, employerId), eq(employerContacts.isPrimary, true)),
  });
  return row ?? null;
}

export async function getEmployerUser(employerId: string) {
  const employer = await db.query.employers.findFirst({ where: eq(employers.id, employerId) });
  return employer;
}

export async function recordNdpaConsent(employerId: string, consentingUserId: string) {
  const { flags } = await loadFlags(employerId);
  if (!flags.requiresNdpa) {
    throw new AppError({
      code: 'WRONG_EMPLOYER_TYPE',
      message: 'NDPA consent only applies to employer types that require it.',
      statusCode: 403,
    });
  }
  await db
    .update(employers)
    .set({
      ndpaConsentGiven: true,
      ndpaConsentTimestamp: new Date(),
      ndpaConsentedBy: consentingUserId,
    })
    .where(eq(employers.id, employerId));
}

export async function markOnboardingComplete(employerId: string) {
  const e = await getProfile(employerId);
  if (!e.contacts.some((c) => c.isPrimary)) {
    throw new AppError({
      code: 'ONBOARDING_INCOMPLETE',
      message: 'A primary contact is required to complete onboarding.',
      statusCode: 400,
    });
  }
  const flags = e.employerTypeConfig;
  if (flags.usesIndividualEmployerNeeds && !e.individualEmployerNeedsAssessment) {
    throw new AppError({
      code: 'ONBOARDING_INCOMPLETE',
      message: 'A care recipient needs assessment is required.',
      statusCode: 400,
    });
  }
  if (flags.usesCorporateNeeds && !e.corporateNeedsAssessment) {
    throw new AppError({
      code: 'ONBOARDING_INCOMPLETE',
      message: 'A workforce needs assessment is required.',
      statusCode: 400,
    });
  }
  if (flags.requiresNdpa && !e.ndpaConsentGiven) {
    throw new AppError({
      code: 'NDPA_CONSENT_REQUIRED',
      message: 'NDPA consent must be recorded to complete onboarding.',
      statusCode: 400,
    });
  }
  // §6.2 — completing onboarding submits the registration for agent verification.
  // A REJECTED employer that re-completes onboarding is resubmitted for review: status is reset to
  // PENDING (re-entering the verification queue) and the prior review fields are cleared.
  const isResubmit = e.verificationStatus === 'REJECTED';
  const submittedAt = isResubmit || !e.verificationSubmittedAt ? new Date() : null;
  await db
    .update(employers)
    .set({
      onboardingCompletedAt: new Date(),
      ...(submittedAt ? { verificationSubmittedAt: submittedAt } : {}),
      ...(isResubmit
        ? {
            verificationStatus: 'PENDING',
            verificationReviewedAt: null,
            verificationReviewedBy: null,
            verificationNotes: null,
          }
        : {}),
    })
    .where(eq(employers.id, employerId));
  if (submittedAt) events.emit('employer.submittedForVerification', { employerId });
}
