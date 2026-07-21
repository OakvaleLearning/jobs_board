import { beforeAll, describe, expect, it } from 'vitest';

describe('isValidAssignmentTarget', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = 'postgres://x:x@127.0.0.1/x';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.JWT_ACCESS_SECRET = 'x'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'y'.repeat(32);
  });

  it('accepts placementId only', async () => {
    const { isValidAssignmentTarget } = await import('./assignments.service.js');
    expect(isValidAssignmentTarget({ placementId: 'a' })).toBe(true);
  });
  it('accepts workerId only', async () => {
    const { isValidAssignmentTarget } = await import('./assignments.service.js');
    expect(isValidAssignmentTarget({ workerId: 'b' })).toBe(true);
  });
  it('rejects both', async () => {
    const { isValidAssignmentTarget } = await import('./assignments.service.js');
    expect(isValidAssignmentTarget({ placementId: 'a', workerId: 'b' })).toBe(false);
  });
  it('rejects neither', async () => {
    const { isValidAssignmentTarget } = await import('./assignments.service.js');
    expect(isValidAssignmentTarget({})).toBe(false);
  });
});
