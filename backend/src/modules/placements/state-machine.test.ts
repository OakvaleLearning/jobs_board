import { describe, expect, it } from 'vitest';
import { assertTransition, canTransition } from './state-machine.js';

describe('placement state machine', () => {
  it('allows PENDING_PAYMENT → ACTIVE', () => {
    expect(canTransition('PENDING_PAYMENT', 'ACTIVE')).toBe(true);
  });
  it('forbids PENDING_PAYMENT → SUSPENDED directly', () => {
    expect(canTransition('PENDING_PAYMENT', 'SUSPENDED')).toBe(false);
  });
  it('allows ACTIVE → SUSPENDED (safeguarding)', () => {
    expect(canTransition('ACTIVE', 'SUSPENDED')).toBe(true);
  });
  it('forbids COMPLETED → anything', () => {
    expect(canTransition('COMPLETED', 'ACTIVE')).toBe(false);
    expect(canTransition('COMPLETED', 'TERMINATED')).toBe(false);
  });
  it('throws on invalid transition via assert', () => {
    expect(() => assertTransition('TERMINATED', 'ACTIVE')).toThrowError(
      expect.objectContaining({ code: 'INVALID_PLACEMENT_TRANSITION', statusCode: 409 }),
    );
  });
});
