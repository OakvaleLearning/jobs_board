import { asc, eq } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import { employerTypes, type EmployerTypeRow } from '@/shared/db/schema.js';
import { AppError } from '@/shared/errors/app-error.js';
import { recordAudit } from '@/shared/audit/record.js';
import type {
  EmployerTypeCreateInput,
  EmployerTypeUpdateInput,
} from '@oakvale/shared/schema/employer-type.js';

export async function listEmployerTypes(opts: { activeOnly?: boolean } = {}) {
  return db
    .select()
    .from(employerTypes)
    .where(opts.activeOnly ? eq(employerTypes.isActive, true) : undefined)
    .orderBy(asc(employerTypes.displayOrder), asc(employerTypes.name));
}

export async function getEmployerType(id: string): Promise<EmployerTypeRow> {
  const row = await db.query.employerTypes.findFirst({ where: eq(employerTypes.id, id) });
  if (!row) {
    throw new AppError({
      code: 'EMPLOYER_TYPE_NOT_FOUND',
      message: 'Employer type not found.',
      statusCode: 404,
    });
  }
  return row;
}

export async function getEmployerTypeByRoleKey(roleKey: string): Promise<EmployerTypeRow | null> {
  return (
    (await db.query.employerTypes.findFirst({ where: eq(employerTypes.roleKey, roleKey) })) ?? null
  );
}

/**
 * Behavioural flags derived purely from a type's config. This is the single
 * discriminator the rest of the app uses now that the legacy `employer_type`
 * enum column is gone — see §5 Phase 5.
 */
export interface EmployerTypeFlags {
  usesIndividualEmployerNeeds: boolean;
  usesCorporateNeeds: boolean;
  requiresNdpa: boolean;
  isAccountManaged: boolean;
  /** Drives `invoices.pipeline` (STRIPE/GBP/USD ⇒ INDIVIDUAL_EMPLOYER, else CORPORATE). */
  pipeline: 'INDIVIDUAL_EMPLOYER' | 'CORPORATE';
}

export function deriveTypeFlags(type: EmployerTypeRow): EmployerTypeFlags {
  const steps = type.onboardingSteps ?? [];
  const provider = type.pricing?.subscription?.provider ?? type.paymentProviders?.[0] ?? null;
  return {
    usesIndividualEmployerNeeds: steps.includes('individual_employer_needs'),
    usesCorporateNeeds: steps.includes('corporate_needs'),
    requiresNdpa: steps.includes('ndpa'),
    isAccountManaged: type.serviceModel === 'ACCOUNT_MANAGED',
    pipeline: provider === 'STRIPE' ? 'INDIVIDUAL_EMPLOYER' : 'CORPORATE',
  };
}

export async function createEmployerType(input: EmployerTypeCreateInput, createdBy: string) {
  const existing = await db.query.employerTypes.findFirst({
    where: eq(employerTypes.slug, input.slug),
  });
  if (existing) {
    throw new AppError({
      code: 'EMPLOYER_TYPE_SLUG_TAKEN',
      message: `An employer type with slug ${input.slug} already exists.`,
      statusCode: 409,
    });
  }
  const [row] = await db
    .insert(employerTypes)
    .values({
      slug: input.slug,
      name: input.name,
      description: input.description,
      roleKey: input.roleKey,
      registrationFields: input.registrationFields,
      verificationMethods: input.verificationMethods,
      serviceModel: input.serviceModel,
      jobPostingEnabled: input.jobPostingEnabled,
      onboardingSteps: input.onboardingSteps,
      allowedWorkerCategoryIds: input.allowedWorkerCategoryIds ?? null,
      applicableContractTypes: input.applicableContractTypes,
      pricing: input.pricing,
      paymentProviders: input.paymentProviders,
      displayOrder: input.displayOrder,
      isActive: input.isActive,
      createdBy,
    })
    .returning();
  if (!row) {
    throw new AppError({
      code: 'INTERNAL_ERROR',
      message: 'Failed to create employer type.',
      statusCode: 500,
    });
  }
  await recordAudit({
    actorId: createdBy,
    action: 'employer_type.created',
    targetType: 'employer_type',
    targetId: row.id,
    metadata: { slug: row.slug, isActive: row.isActive },
  });
  return row;
}

export async function updateEmployerType(
  id: string,
  input: EmployerTypeUpdateInput,
  actorId: string,
) {
  await getEmployerType(id);
  const set: Partial<typeof employerTypes.$inferInsert> = {};
  if (input.name !== undefined) set.name = input.name;
  if (input.description !== undefined) set.description = input.description;
  if (input.roleKey !== undefined) set.roleKey = input.roleKey;
  if (input.registrationFields !== undefined) set.registrationFields = input.registrationFields;
  if (input.verificationMethods !== undefined) set.verificationMethods = input.verificationMethods;
  if (input.serviceModel !== undefined) set.serviceModel = input.serviceModel;
  if (input.jobPostingEnabled !== undefined) set.jobPostingEnabled = input.jobPostingEnabled;
  if (input.onboardingSteps !== undefined) set.onboardingSteps = input.onboardingSteps;
  if (input.allowedWorkerCategoryIds !== undefined)
    set.allowedWorkerCategoryIds = input.allowedWorkerCategoryIds ?? null;
  if (input.applicableContractTypes !== undefined)
    set.applicableContractTypes = input.applicableContractTypes;
  if (input.pricing !== undefined) set.pricing = input.pricing;
  if (input.paymentProviders !== undefined) set.paymentProviders = input.paymentProviders;
  if (input.displayOrder !== undefined) set.displayOrder = input.displayOrder;
  if (input.isActive !== undefined) set.isActive = input.isActive;

  const [row] = await db
    .update(employerTypes)
    .set(set)
    .where(eq(employerTypes.id, id))
    .returning();
  await recordAudit({
    actorId,
    action: 'employer_type.updated',
    targetType: 'employer_type',
    targetId: id,
    metadata: { changes: Object.keys(input) },
  });
  return row;
}
