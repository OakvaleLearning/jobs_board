import { beforeAll, describe, expect, it } from 'vitest';

describe('LMS client (stub mode)', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = 'postgres://x:x@127.0.0.1/x';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.JWT_ACCESS_SECRET = 'x'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'y'.repeat(32);
    delete process.env.LMS_API_URL;
    delete process.env.LMS_API_KEY;
  });

  it('reports unconfigured when env vars are unset', async () => {
    const { isLmsConfigured } = await import('./client.js');
    expect(isLmsConfigured()).toBe(false);
  });

  it('returns a mock enrolment id without hitting the network', async () => {
    const { enrolWorker } = await import('./client.js');
    const { enrolmentId } = await enrolWorker({
      workerId: 'w1',
      programmeId: 'cpd-safeguarding-refresh',
      programmeName: 'Safeguarding Refresher (Annual)',
    });
    expect(enrolmentId).toMatch(/^stub-lms-cpd-safeguarding-refresh-/);
  });
});
