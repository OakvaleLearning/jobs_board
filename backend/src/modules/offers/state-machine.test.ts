import { describe, expect, it } from 'vitest';
import { canTransition } from './state-machine.js';

describe('offer state machine', () => {
  it('allows DRAFT → AGENT_REVIEW', () => {
    expect(canTransition('DRAFT', 'AGENT_REVIEW')).toBe(true);
  });

  it('allows SENT_TO_WORKER → ACCEPTED|DECLINED|COUNTERED', () => {
    expect(canTransition('SENT_TO_WORKER', 'ACCEPTED')).toBe(true);
    expect(canTransition('SENT_TO_WORKER', 'DECLINED')).toBe(true);
    expect(canTransition('SENT_TO_WORKER', 'COUNTERED')).toBe(true);
  });

  it('blocks invalid jumps', () => {
    expect(canTransition('DRAFT', 'ACCEPTED')).toBe(false);
    expect(canTransition('ACCEPTED', 'DECLINED')).toBe(false);
    expect(canTransition('DECLINED', 'AGENT_REVIEW')).toBe(false);
  });

  it('allows COUNTERED → AGENT_REVIEW (looping back)', () => {
    expect(canTransition('COUNTERED', 'AGENT_REVIEW')).toBe(true);
  });
});
