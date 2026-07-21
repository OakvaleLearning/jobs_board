import { describe, expect, it } from 'vitest';
import {
  backgroundReviewSchema,
  identityReviewSchema,
} from '@oakvale/shared/schema/verification.js';

// Background checks are admin-reviewed document submissions (Sterling removed).
describe('background review schema', () => {
  it('accepts CLEAR / FLAGGED decisions with optional notes', () => {
    expect(backgroundReviewSchema.parse({ decision: 'CLEAR' }).decision).toBe('CLEAR');
    const flagged = backgroundReviewSchema.parse({ decision: 'FLAGGED', notes: 'Blurry affidavit.' });
    expect(flagged.decision).toBe('FLAGGED');
    expect(flagged.notes).toBe('Blurry affidavit.');
  });

  it('rejects non-background decisions (e.g. identity verbs)', () => {
    expect(() => backgroundReviewSchema.parse({ decision: 'VERIFIED' })).toThrow();
    expect(() => backgroundReviewSchema.parse({ decision: 'PENDING' })).toThrow();
  });

  it('identity review still uses VERIFIED / REJECTED', () => {
    expect(identityReviewSchema.parse({ decision: 'VERIFIED' }).decision).toBe('VERIFIED');
    expect(() => identityReviewSchema.parse({ decision: 'CLEAR' })).toThrow();
  });
});
