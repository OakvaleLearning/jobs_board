import { describe, expect, it } from 'vitest';
import {
  corporateNeedsAssessmentSchema,
  individualEmployerNeedsAssessmentSchema,
  employerVerificationReviewSchema,
  jobPostingCreateSchema,
} from '@oakvale/shared/schema/employer.js';

describe('employer schemas', () => {
  it('parses a valid individual-employer needs assessment', () => {
    const r = individualEmployerNeedsAssessmentSchema.parse({
      careRecipientName: 'Mother',
      age: 78,
      relationship: 'parent',
      mobilityLevel: 'ASSISTED',
      preferredLanguage: 'Yoruba',
      accommodationType: 'LIVE_IN',
      urgencyLevel: 'STANDARD',
    });
    expect(r.careRecipientName).toBe('Mother');
  });

  it('rejects negative age', () => {
    expect(() =>
      individualEmployerNeedsAssessmentSchema.parse({
        careRecipientName: 'X',
        age: -1,
        relationship: 'parent',
        mobilityLevel: 'ASSISTED',
        preferredLanguage: 'English',
        accommodationType: 'LIVE_IN',
        urgencyLevel: 'STANDARD',
      }),
    ).toThrow();
  });

  it('parses a corporate needs assessment with defaults', () => {
    const r = corporateNeedsAssessmentSchema.parse({
      numStaffRequired: 5,
      hoursOfOperation: '07:00–18:00 Mon–Fri',
    });
    expect(r.numStaffRequired).toBe(5);
    expect(r.existingStaffCount).toBe(0);
    expect(r.ageRangesServed).toEqual([]);
  });

  it('requires a meaningful job description', () => {
    expect(() =>
      jobPostingCreateSchema.parse({
        title: 'Caregiver',
        description: 'short',
        workforceCategoryId: '11111111-1111-1111-1111-111111111111',
      }),
    ).toThrow();
  });

  it('requires a workforce category (§6.3)', () => {
    expect(() =>
      jobPostingCreateSchema.parse({
        title: 'Certified Caregiver',
        description: 'A genuinely descriptive role summary over twenty chars.',
      }),
    ).toThrow();
  });

  it('§6.2 employer verification review requires a valid decision', () => {
    expect(employerVerificationReviewSchema.parse({ decision: 'APPROVED' }).decision).toBe('APPROVED');
    expect(
      employerVerificationReviewSchema.parse({
        decision: 'REJECTED',
        notes: 'CAC number could not be confirmed.',
      }).notes,
    ).toContain('CAC');
    expect(() => employerVerificationReviewSchema.parse({ decision: 'MAYBE' })).toThrow();
  });

  it('parses a valid job posting with §6.3 defaults', () => {
    const r = jobPostingCreateSchema.parse({
      title: 'Certified Caregiver',
      description: 'A genuinely descriptive role summary over twenty chars.',
      workforceCategoryId: '11111111-1111-1111-1111-111111111111',
      careTypeId: '22222222-2222-2222-2222-222222222222',
    });
    expect(r.backgroundCheckRequired).toBe(true);
    expect(r.visibility).toBe('PUBLIC');
  });

  it('requires a care type on the job posting (§5)', () => {
    expect(() =>
      jobPostingCreateSchema.parse({
        title: 'Certified Caregiver',
        description: 'A genuinely descriptive role summary over twenty chars.',
        workforceCategoryId: '11111111-1111-1111-1111-111111111111',
      }),
    ).toThrow();
  });
});
