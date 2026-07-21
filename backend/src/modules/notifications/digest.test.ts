import { beforeAll, describe, expect, it } from 'vitest';

describe('digest grouping', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = 'postgres://x:x@127.0.0.1/x';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.JWT_ACCESS_SECRET = 'x'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'y'.repeat(32);
  });

  it('groups rows by kind and counts items', async () => {
    const { groupForDigest } = await import('./digest.js');
    const r = groupForDigest([
      { id: '1', kind: 'welfare_check_due', subject: 'a', createdAt: '2026-06-01' },
      { id: '2', kind: 'cpd_expiry_warning', subject: 'b', createdAt: '2026-06-02' },
      { id: '3', kind: 'welfare_check_due', subject: 'c', createdAt: '2026-06-03' },
    ]);
    expect(r).toHaveLength(2);
    const welfare = r.find((g) => g.kind === 'welfare_check_due');
    expect(welfare?.count).toBe(2);
  });

  it('renders subject summarising total count', async () => {
    const { groupForDigest, renderDigestEmail } = await import('./digest.js');
    const groups = groupForDigest([
      { id: '1', kind: 'k', subject: 'x', createdAt: '2026-06-01' },
      { id: '2', kind: 'k', subject: 'y', createdAt: '2026-06-02' },
    ]);
    const tpl = renderDigestEmail(groups);
    expect(tpl.subject).toContain('2');
    expect(tpl.html).toContain('<li>x</li>');
  });
});
