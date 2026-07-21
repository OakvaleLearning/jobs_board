import { beforeAll, describe, expect, it } from 'vitest';

describe('dunning band selection', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = 'postgres://x:x@127.0.0.1/x';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.JWT_ACCESS_SECRET = 'x'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'y'.repeat(32);
  });

  it('returns null below 1 day overdue', async () => {
    const { bandFor } = await import('./dunning-bands.js');
    expect(bandFor(0)).toBeNull();
  });
  it('picks day1 band for 1–6 days', async () => {
    const { bandFor } = await import('./dunning-bands.js');
    expect(bandFor(1)?.day).toBe(1);
    expect(bandFor(6)?.day).toBe(1);
  });
  it('picks day7 band for 7–13 days', async () => {
    const { bandFor } = await import('./dunning-bands.js');
    expect(bandFor(7)?.day).toBe(7);
    expect(bandFor(13)?.day).toBe(7);
  });
  it('picks day14 admin band for 14+ days', async () => {
    const { bandFor } = await import('./dunning-bands.js');
    expect(bandFor(14)?.day).toBe(14);
    expect(bandFor(99)?.day).toBe(14);
    expect(bandFor(14)?.admin).toBe(true);
  });
  it('overdueDays computes floor difference', async () => {
    const { overdueDays } = await import('./dunning-bands.js');
    const due = new Date('2026-06-01T00:00:00Z');
    const now = new Date('2026-06-08T00:00:00Z');
    expect(overdueDays(due, now)).toBe(7);
  });
});
