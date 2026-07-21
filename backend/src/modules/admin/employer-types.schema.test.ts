import { describe, expect, it } from 'vitest';
import { isEmployerRole } from '@oakvale/shared/roles.js';
import {
  employerTypeCreateSchema,
  employerTypeUpdateSchema,
} from '@oakvale/shared/schema/employer-type.js';
import { registerSchema } from '@oakvale/shared/schema/auth.js';

describe('isEmployerRole', () => {
  it('accepts the unified and both legacy employer roles', () => {
    expect(isEmployerRole('EMPLOYER')).toBe(true);
    expect(isEmployerRole('INDIVIDUAL_EMPLOYER')).toBe(true);
    expect(isEmployerRole('EMPLOYER_CORPORATE')).toBe(true);
  });
  it('rejects non-employer roles', () => {
    expect(isEmployerRole('WORKER')).toBe(false);
    expect(isEmployerRole('ADMIN')).toBe(false);
    expect(isEmployerRole(null)).toBe(false);
  });
});

describe('employerTypeCreateSchema', () => {
  it('accepts a fully-configured type and applies defaults', () => {
    const parsed = employerTypeCreateSchema.parse({
      slug: 'PRIVATE_HOUSEHOLD',
      name: 'Private Household (Local)',
      roleKey: 'private-household',
      verificationMethods: ['ID_DOCUMENT'],
      serviceModel: 'SELF_SERVICE',
      jobPostingEnabled: false,
      onboardingSteps: ['org', 'contact'],
      applicableContractTypes: ['WORKER_PLACEMENT'],
      paymentProviders: ['PAYSTACK'],
    });
    expect(parsed.slug).toBe('PRIVATE_HOUSEHOLD');
    expect(parsed.allowedWorkerCategoryIds).toBeUndefined();
    expect(parsed.registrationFields).toEqual([]);
    expect(parsed.isActive).toBe(true);
  });

  it('rejects a non-UPPER_SNAKE_CASE slug and a non-kebab roleKey', () => {
    expect(() =>
      employerTypeCreateSchema.parse({ slug: 'private household', name: 'x', roleKey: 'x' }),
    ).toThrow();
    expect(() =>
      employerTypeCreateSchema.parse({ slug: 'PRIVATE', name: 'x', roleKey: 'Private House' }),
    ).toThrow();
  });

  it('update schema omits slug and is partial', () => {
    const parsed = employerTypeUpdateSchema.parse({ jobPostingEnabled: true });
    expect(parsed.jobPostingEnabled).toBe(true);
    expect('slug' in parsed).toBe(false);
  });
});

describe('registerSchema (§5 employer type requirement)', () => {
  const base = {
    email: 'a@b.com',
    password: '0123456789',
    fullName: 'Ada Lovelace',
    acceptedTerms: true,
    acceptedPrivacy: true,
  };

  it('requires an employerTypeId when role is EMPLOYER', () => {
    expect(() => registerSchema.parse({ ...base, role: 'EMPLOYER' })).toThrow();
    const ok = registerSchema.parse({
      ...base,
      role: 'EMPLOYER',
      employerTypeId: '11111111-1111-1111-1111-111111111111',
    });
    expect(ok.role).toBe('EMPLOYER');
  });

  it('does not require an employerTypeId for WORKER', () => {
    const ok = registerSchema.parse({ ...base, role: 'WORKER', acceptedBackgroundCheck: true });
    expect(ok.role).toBe('WORKER');
  });
});
