import { describe, expect, it } from 'vitest';
import { assertTransition, canTransition } from './state-machine.js';

describe('verification state machine', () => {
  it('allows IN_REVIEW → VERIFIED', () => {
    expect(canTransition('IN_REVIEW', 'VERIFIED')).toBe(true);
  });
  it('allows IN_REVIEW → REJECTED', () => {
    expect(canTransition('IN_REVIEW', 'REJECTED')).toBe(true);
  });
  it('forbids VERIFIED → REJECTED directly (must go via FLAGGED)', () => {
    expect(canTransition('VERIFIED', 'REJECTED')).toBe(false);
  });
  it('allows VERIFIED → FLAGGED → REJECTED', () => {
    expect(canTransition('VERIFIED', 'FLAGGED')).toBe(true);
    expect(canTransition('FLAGGED', 'REJECTED')).toBe(true);
  });
  it('treats same-state transitions as no-ops (allowed)', () => {
    expect(canTransition('IN_REVIEW', 'IN_REVIEW')).toBe(true);
  });
  it('allows withdrawal back to PENDING from SUBMITTED and IN_REVIEW', () => {
    expect(canTransition('SUBMITTED', 'PENDING')).toBe(true);
    expect(canTransition('IN_REVIEW', 'PENDING')).toBe(true);
  });
  it('forbids withdrawal of a decided request (VERIFIED → PENDING)', () => {
    expect(canTransition('VERIFIED', 'PENDING')).toBe(false);
  });
  it('throws AppError on forbidden transition via assert', () => {
    expect(() => assertTransition('PENDING', 'VERIFIED')).toThrowError(
      expect.objectContaining({ code: 'INVALID_VERIFICATION_TRANSITION' }),
    );
  });
});
