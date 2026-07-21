import { describe, expect, it } from 'vitest';
import {
  sectionSchemas,
  uploadUrlRequestSchema,
} from '@oakvale/shared/schema/worker.js';

describe('worker section schemas', () => {
  it('accepts a valid Section A payload', () => {
    const ok = sectionSchemas.A.parse({
      fullName: 'Ada Lovelace',
      dob: '1990-01-01',
      gender: 'FEMALE',
      nationality: 'Nigerian',
      stateOfOrigin: 'Lagos',
      lga: 'Ikeja',
      address: '12 Allen Avenue',
      phone: '+234 123 4567',
      emergencyContact: { name: 'A', relationship: 'Sister', phone: '+234 111' },
    });
    expect(ok.fullName).toBe('Ada Lovelace');
  });

  it('enforces personal statement length on Section I', () => {
    expect(() =>
      sectionSchemas.I.parse({ interests: '', personalStatement: 'too short' }),
    ).toThrow();
  });

  it('enforces Section K min/max ordering', () => {
    expect(() =>
      sectionSchemas.K.parse({
        wageStructure: 'MONTHLY',
        minRate: 100,
        maxRate: 50,
        currency: 'NGN',
        negotiable: true,
        expectedBenefits: [],
      }),
    ).toThrow();
  });

  it('accepts a Section G payload with a workforce category and coerces empty to null', () => {
    const ok = sectionSchemas.G.parse({
      workforceCategoryId: '11111111-1111-1111-1111-111111111111',
      desiredSectors: ['CERTIFIED_CAREGIVER'],
      employmentType: 'LIVE_IN',
      preferredSettings: [],
      shiftPreferences: [],
      relocationWillingness: false,
      preferredCities: [],
    });
    expect(ok.workforceCategoryId).toBe('11111111-1111-1111-1111-111111111111');

    const cleared = sectionSchemas.G.parse({
      workforceCategoryId: '',
      employmentType: 'LIVE_IN',
      relocationWillingness: false,
    });
    expect(cleared.workforceCategoryId).toBeNull();
  });

  it('rejects a non-uuid workforce category on Section G', () => {
    expect(() =>
      sectionSchemas.G.parse({
        workforceCategoryId: 'not-a-uuid',
        employmentType: 'LIVE_IN',
        relocationWillingness: false,
      }),
    ).toThrow();
  });

  it('validates upload URL request shape', () => {
    expect(() =>
      uploadUrlRequestSchema.parse({
        category: 'NOT_A_CAT',
        mimeType: 'image/jpeg',
        sizeBytes: 100,
        originalFilename: 'a.jpg',
      }),
    ).toThrow();
  });
});
