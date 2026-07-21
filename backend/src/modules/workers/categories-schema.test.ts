import { describe, expect, it } from 'vitest';
import {
  workforceCategoryCreateSchema,
  workforceCategoryUpdateSchema,
} from '@oakvale/shared/schema/workforce-category.js';

describe('workforce category schemas', () => {
  it('accepts a minimal valid create payload and applies defaults', () => {
    const parsed = workforceCategoryCreateSchema.parse({
      slug: 'CERTIFIED_CAREGIVER',
      name: 'Certified Caregiver (Elderly / Home Care)',
    });
    expect(parsed.slug).toBe('CERTIFIED_CAREGIVER');
    expect(parsed.isActive).toBe(true);
    expect(parsed.requiredCertifications).toEqual([]);
    expect(parsed.applicableSettings).toEqual([]);
    expect(parsed.displayOrder).toBe(0);
  });

  it('rejects a slug that is not UPPER_SNAKE_CASE', () => {
    expect(() =>
      workforceCategoryCreateSchema.parse({ slug: 'certified-caregiver', name: 'X' }),
    ).toThrow();
  });

  it('rejects an unknown placement setting', () => {
    expect(() =>
      workforceCategoryCreateSchema.parse({
        slug: 'CERTIFIED_CAREGIVER',
        name: 'X',
        applicableSettings: ['SPACE_STATION'],
      }),
    ).toThrow();
  });

  it('rejects an unknown compliance field', () => {
    expect(() =>
      workforceCategoryCreateSchema.parse({
        slug: 'CERTIFIED_CAREGIVER',
        name: 'X',
        requiredComplianceFields: ['VIBES_CHECK'],
      }),
    ).toThrow();
  });

  it('accepts required certifications with optional lms ref', () => {
    const parsed = workforceCategoryCreateSchema.parse({
      slug: 'CERTIFIED_CHILDCARE_WORKER',
      name: 'Certified Childcare Worker (Early Years)',
      requiredCertifications: [
        { name: 'Oakvale Early Years Childcare Certificate', lmsCourseRef: 'EYC-101' },
      ],
      applicableSettings: ['HOME', 'CORPORATE'],
      applicableEmploymentTypes: ['FULL_TIME', 'LIVE_IN'],
      requiredIdentityFields: ['NIN', 'SELFIE'],
    });
    expect(parsed.requiredCertifications[0]?.lmsCourseRef).toBe('EYC-101');
  });

  it('update schema is partial and omits slug (slug is immutable)', () => {
    const parsed = workforceCategoryUpdateSchema.parse({ isActive: false });
    expect(parsed.isActive).toBe(false);
    expect('slug' in parsed).toBe(false);
  });
});
