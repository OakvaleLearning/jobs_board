import { beforeAll, describe, expect, it } from 'vitest';
import type { EmployerTypeRow } from '@/shared/db/schema.js';

function fakeType(overrides: Partial<EmployerTypeRow>): EmployerTypeRow {
  return {
    id: '00000000-0000-0000-0000-000000000000',
    slug: 'OTHER',
    name: 'Other',
    description: null,
    roleKey: 'other',
    registrationFields: [],
    verificationMethods: [],
    serviceModel: 'SELF_SERVICE',
    jobPostingEnabled: false,
    onboardingSteps: [],
    allowedWorkerCategoryIds: null,
    applicableContractTypes: [],
    pricing: {},
    paymentProviders: [],
    displayOrder: 0,
    isActive: true,
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as EmployerTypeRow;
}

describe('employers service helpers', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = 'postgres://x:x@127.0.0.1/x';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.JWT_ACCESS_SECRET = 'x'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'y'.repeat(32);
  });

  it('legacyEnumForSlug derives the back-compat label', async () => {
    const { legacyEnumForSlug } = await import('./service.js');
    expect(legacyEnumForSlug('INDIVIDUAL_EMPLOYER')).toBe('INDIVIDUAL_EMPLOYER');
    expect(legacyEnumForSlug('CORPORATE')).toBe('CORPORATE');
    expect(legacyEnumForSlug('PRIVATE_HOUSEHOLD')).toBe('OTHER');
  });

  it('deriveTypeFlags: a STRIPE account-managed individual-employer type', async () => {
    const { deriveTypeFlags } = await import('@/modules/admin/employer-types.service.js');
    const flags = deriveTypeFlags(
      fakeType({
        serviceModel: 'ACCOUNT_MANAGED',
        onboardingSteps: ['org', 'contact', 'individual_employer_needs'],
        pricing: { subscription: { amountMinor: 1, currency: 'GBP', provider: 'STRIPE' } },
      }),
    );
    expect(flags).toMatchObject({
      usesIndividualEmployerNeeds: true,
      usesCorporateNeeds: false,
      requiresNdpa: false,
      isAccountManaged: true,
      pipeline: 'INDIVIDUAL_EMPLOYER',
    });
  });

  it('deriveTypeFlags: a PAYSTACK self-service corporate type that requires NDPA', async () => {
    const { deriveTypeFlags } = await import('@/modules/admin/employer-types.service.js');
    const flags = deriveTypeFlags(
      fakeType({
        serviceModel: 'SELF_SERVICE',
        jobPostingEnabled: true,
        onboardingSteps: ['org', 'contact', 'corporate_needs', 'ndpa'],
        paymentProviders: ['PAYSTACK'],
      }),
    );
    expect(flags).toMatchObject({
      usesIndividualEmployerNeeds: false,
      usesCorporateNeeds: true,
      requiresNdpa: true,
      isAccountManaged: false,
      pipeline: 'CORPORATE',
    });
  });
});
