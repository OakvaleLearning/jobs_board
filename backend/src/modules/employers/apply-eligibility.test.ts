import { beforeAll, describe, expect, it } from 'vitest';

describe('applyEligibilityMessage', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = 'postgres://x:x@127.0.0.1/x';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.JWT_ACCESS_SECRET = 'x'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'y'.repeat(32);
  });

  const base = {
    identityVerified: true,
    oakvaleCertified: true,
    completionOk: true,
    noSafeguarding: true,
  };

  it('surfaces the unverified-identity reason first', async () => {
    const { applyEligibilityMessage } = await import('./job-postings.js');
    expect(applyEligibilityMessage({ ...base, identityVerified: false })).toMatch(
      /identity verification/i,
    );
  });

  it('tells a verified-but-uncertified worker to upload their certificate (brief §3)', async () => {
    const { applyEligibilityMessage } = await import('./job-postings.js');
    const msg = applyEligibilityMessage({ ...base, oakvaleCertified: false });
    expect(msg).toMatch(/certificate/i);
    // identity is fine, so we must NOT show the identity message
    expect(msg).not.toMatch(/identity verification/i);
  });

  it('asks for 70% completion when only that is unmet', async () => {
    const { applyEligibilityMessage } = await import('./job-postings.js');
    expect(applyEligibilityMessage({ ...base, completionOk: false })).toMatch(/70%/);
  });

  it('flags an open safeguarding review', async () => {
    const { applyEligibilityMessage } = await import('./job-postings.js');
    expect(applyEligibilityMessage({ ...base, noSafeguarding: false })).toMatch(/safeguarding/i);
  });

  it('falls back to a generic reason when all fragments pass but status still not APPROVED', async () => {
    const { applyEligibilityMessage } = await import('./job-postings.js');
    expect(applyEligibilityMessage(base)).toMatch(/approved and live/i);
  });
});
