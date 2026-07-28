import { describe, it, expect } from 'vitest';
import { updateAgentSelfSchema } from '@oakvale/shared/schema/admin.js';

describe('admin/updateAgentSelfSchema', () => {
  it('accepts the self-editable fields', () => {
    const parsed = updateAgentSelfSchema.parse({
      specialty: 'RECRUITER',
      region: '  Lagos  ',
      bio: 'Covers the South-West.',
    });
    expect(parsed.specialty).toBe('RECRUITER');
    expect(parsed.region).toBe('Lagos');
  });

  it('allows a partial patch', () => {
    expect(updateAgentSelfSchema.parse({ bio: 'Just the bio.' })).toEqual({ bio: 'Just the bio.' });
    expect(updateAgentSelfSchema.parse({})).toEqual({});
  });

  it('does not permit self-toggling isActive', () => {
    // isActive is deliberately stripped — deactivation stays an admin-only action.
    const parsed = updateAgentSelfSchema.parse({ isActive: false } as Record<string, unknown>);
    expect('isActive' in parsed).toBe(false);
  });

  it('rejects an unknown specialty', () => {
    expect(() => updateAgentSelfSchema.parse({ specialty: 'NOT_A_ROLE' })).toThrow();
  });
});
