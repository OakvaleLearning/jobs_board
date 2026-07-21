import { eq, inArray } from 'drizzle-orm';
import { db } from './client.js';
import {
  employerTypes,
  users,
  workforceCategories,
  type NewEmployerTypeRow,
} from './schema.js';
import { loadEnv } from '../config/env.js';
import { logger } from '../logger/logger.js';

/**
 * The two launch employer types (§5.2). Idempotent: inserts only if the slug is
 * absent, so re-running never duplicates or overwrites admin edits. After seeding
 * it backfills `employers.employer_type_id` from the legacy enum and promotes
 * existing employer users to the unified EMPLOYER role.
 */
type SeedType = Omit<NewEmployerTypeRow, 'allowedWorkerCategoryIds'> & {
  /** Slugs of allowed worker categories; resolved to UUIDs at seed time. */
  allowedCategorySlugs: string[] | null;
};

const TYPES: SeedType[] = [
  {
    slug: 'INDIVIDUAL_EMPLOYER',
    name: 'Individual',
    description:
      'Individual or family unit based in the UK or USA hiring a carer for an elderly or dependent relative in Nigeria. High-trust, account-managed service.',
    roleKey: 'individual-employer',
    registrationFields: ['orgName', 'address', 'sector'],
    verificationMethods: ['PROOF_OF_RESIDENCY', 'ID_DOCUMENT'],
    serviceModel: 'ACCOUNT_MANAGED',
    jobPostingEnabled: false,
    onboardingSteps: ['org', 'contact', 'individual_employer_needs'],
    allowedCategorySlugs: ['CERTIFIED_CAREGIVER'],
    applicableContractTypes: ['WORKER_PLACEMENT', 'EMPLOYER_SERVICE'],
    pricing: {
      subscription: { amountMinor: 19900, currency: 'GBP', provider: 'STRIPE' },
      placementFee: { amountMinor: 75000, currency: 'GBP', provider: 'STRIPE' },
    },
    paymentProviders: ['STRIPE'],
    displayOrder: 1,
    isActive: true,
  },
  {
    slug: 'CORPORATE',
    name: 'Corporate',
    description:
      'Medium to large Nigerian company with an on-site crèche hiring certified childcare workers. Self-service, annual partnership model.',
    roleKey: 'corporate',
    registrationFields: ['orgName', 'regNumber', 'address', 'website', 'sector'],
    verificationMethods: ['CAC_NUMBER', 'COMPANY_EMAIL'],
    serviceModel: 'SELF_SERVICE',
    jobPostingEnabled: true,
    onboardingSteps: ['org', 'contact', 'ndpa'],
    allowedCategorySlugs: ['CERTIFIED_CHILDCARE_WORKER'],
    applicableContractTypes: ['WORKER_PLACEMENT', 'EMPLOYER_SERVICE', 'ANNUAL_PARTNERSHIP'],
    pricing: {
      subscription: { amountMinor: 50000000, currency: 'NGN', provider: 'PAYSTACK' },
      placementFee: { amountMinor: 25000000, currency: 'NGN', provider: 'PAYSTACK' },
    },
    paymentProviders: ['PAYSTACK'],
    displayOrder: 2,
    isActive: true,
  },
];

async function resolveCategoryIds(slugs: string[]): Promise<string[]> {
  if (slugs.length === 0) return [];
  const rows = await db
    .select({ id: workforceCategories.id, slug: workforceCategories.slug })
    .from(workforceCategories)
    .where(inArray(workforceCategories.slug, slugs));
  return rows.map((r) => r.id);
}

async function main(): Promise<void> {
  loadEnv();

  let inserted = 0;
  for (const { allowedCategorySlugs, ...type } of TYPES) {
    const existing = await db.query.employerTypes.findFirst({
      where: eq(employerTypes.slug, type.slug),
    });
    if (existing) {
      logger.info({ slug: type.slug }, 'Employer type already exists');
      continue;
    }
    const allowedWorkerCategoryIds =
      allowedCategorySlugs === null ? null : await resolveCategoryIds(allowedCategorySlugs);
    await db.insert(employerTypes).values({ ...type, allowedWorkerCategoryIds });
    inserted += 1;
    logger.info({ slug: type.slug }, 'Employer type seeded');
  }

  // (The employer_type_id backfill from the legacy enum now lives in the PHASE_23
  // migration, which also drops the legacy column — see migrate.ts.)

  // Promote existing employer users to the unified EMPLOYER role. Guards still
  // accept the legacy roles, so this is safe to run (or skip) at any time.
  await db
    .update(users)
    .set({ role: 'EMPLOYER' })
    .where(inArray(users.role, ['INDIVIDUAL_EMPLOYER', 'EMPLOYER_CORPORATE']));
  logger.info('Promoted employer users to EMPLOYER role');

  logger.info({ inserted }, 'Employer type seed complete');
  process.exit(0);
}

main().catch((error: unknown) => {
  logger.error({ err: error }, 'Failed to seed employer types');
  process.exit(1);
});
