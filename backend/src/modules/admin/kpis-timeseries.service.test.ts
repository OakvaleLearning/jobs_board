import { beforeAll, describe, expect, it } from 'vitest';

describe('padSeries', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = 'postgres://x:x@127.0.0.1/x';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.JWT_ACCESS_SECRET = 'x'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'y'.repeat(32);
  });

  it('pads missing days with zeros across the window', async () => {
    const { padSeries } = await import('./kpis-timeseries.service.js');
    const from = new Date('2026-06-01T00:00:00Z');
    const to = new Date('2026-06-05T00:00:00Z');
    const r = padSeries(
      [
        { date: '2026-06-02', value: 5 },
        { date: '2026-06-04', value: 2 },
      ],
      from,
      to,
    );
    expect(r.map((p) => p.date)).toEqual([
      '2026-06-01',
      '2026-06-02',
      '2026-06-03',
      '2026-06-04',
      '2026-06-05',
    ]);
    expect(r.map((p) => p.value)).toEqual([0, 5, 0, 2, 0]);
  });
});
