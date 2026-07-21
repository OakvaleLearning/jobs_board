import { beforeAll, describe, expect, it } from 'vitest';

describe('shouldEnqueue', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = 'postgres://x:x@127.0.0.1/x';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.JWT_ACCESS_SECRET = 'x'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'y'.repeat(32);
  });

  it('defaults to true when no preference exists', async () => {
    const { shouldEnqueue } = await import('./preferences.js');
    expect(shouldEnqueue('cpd_expiry_warning', 'EMAIL', new Set())).toBe(true);
  });

  it('returns false when a matching disable exists', async () => {
    const { shouldEnqueue } = await import('./preferences.js');
    const map = new Set(['cpd_expiry_warning:SMS']);
    expect(shouldEnqueue('cpd_expiry_warning', 'SMS', map)).toBe(false);
    expect(shouldEnqueue('cpd_expiry_warning', 'EMAIL', map)).toBe(true);
  });

  it('returns true for forced kinds even when disabled', async () => {
    const { shouldEnqueue } = await import('./preferences.js');
    const map = new Set([
      'placement_suspended:EMAIL',
      'replacement_sla_warning:IN_APP',
      'identity_verified:SMS',
      'invoice_overdue_day14_admin:EMAIL',
    ]);
    expect(shouldEnqueue('placement_suspended', 'EMAIL', map)).toBe(true);
    expect(shouldEnqueue('replacement_sla_warning', 'IN_APP', map)).toBe(true);
    expect(shouldEnqueue('identity_verified', 'SMS', map)).toBe(true);
    expect(shouldEnqueue('invoice_overdue_day14_admin', 'EMAIL', map)).toBe(true);
  });
});
