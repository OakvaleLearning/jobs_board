import { beforeAll, describe, expect, it } from 'vitest';

describe('unionByOccurredAt', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = 'postgres://x:x@127.0.0.1/x';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.JWT_ACCESS_SECRET = 'x'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'y'.repeat(32);
  });

  it('sorts descending by occurredAt', async () => {
    const { unionByOccurredAt } = await import('./activity.service.js');
    const items = [
      { occurredAt: '2026-06-01T00:00:00Z', kind: 'a', summary: '', refType: 'placement' as const, refId: '1' },
      { occurredAt: '2026-06-03T00:00:00Z', kind: 'b', summary: '', refType: 'notification' as const, refId: '2' },
      { occurredAt: '2026-06-02T00:00:00Z', kind: 'c', summary: '', refType: 'assignment' as const, refId: '3' },
    ];
    const r = unionByOccurredAt(items);
    expect(r.map((x) => x.kind)).toEqual(['b', 'c', 'a']);
  });
});
