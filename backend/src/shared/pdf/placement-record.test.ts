import { beforeAll, describe, expect, it } from 'vitest';

describe('normalisePlacementRecord', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = 'postgres://x:x@127.0.0.1/x';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.JWT_ACCESS_SECRET = 'x'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'y'.repeat(32);
  });

  it('marks guarantee in-window when activated and guarantee is in the future', async () => {
    const { normalisePlacementRecord } = await import('./placement-record.js');
    const now = new Date('2026-06-10T00:00:00Z');
    const r = normalisePlacementRecord(
      {
        id: 'p1',
        pipelineType: 'INDIVIDUAL_EMPLOYER',
        status: 'ACTIVE',
        placedAt: '2026-06-01T00:00:00Z',
        activatedAt: '2026-06-01T00:00:00Z',
        guaranteeExpiresAt: '2026-08-30T00:00:00Z',
        endedAt: null,
        endReason: null,
      },
      { orgName: null, contactName: 'Ada', email: 'ada@example.com' },
      { fullName: 'Bola', stateOfOrigin: 'Lagos' },
      2,
      now,
    );
    expect(r.replacementGuaranteeStatus).toBe('in-window');
    expect(r.welfareCheckCount).toBe(2);
  });

  it('marks guarantee expired when window is past', async () => {
    const { normalisePlacementRecord } = await import('./placement-record.js');
    const now = new Date('2027-01-01T00:00:00Z');
    const r = normalisePlacementRecord(
      {
        id: 'p2',
        pipelineType: 'CORPORATE',
        status: 'COMPLETED',
        placedAt: '2026-06-01T00:00:00Z',
        activatedAt: '2026-06-01T00:00:00Z',
        guaranteeExpiresAt: '2026-08-30T00:00:00Z',
        endedAt: '2026-12-01T00:00:00Z',
        endReason: 'COMPLETED',
      },
      { orgName: 'TinyCo', contactName: null, email: 'hr@tinyco.ng' },
      { fullName: 'Chinwe', stateOfOrigin: 'Abuja' },
      0,
      now,
    );
    expect(r.replacementGuaranteeStatus).toBe('expired');
    expect(r.endReason).toBe('COMPLETED');
  });

  it('returns not-activated when no activation date', async () => {
    const { normalisePlacementRecord } = await import('./placement-record.js');
    const r = normalisePlacementRecord(
      {
        id: 'p3',
        pipelineType: 'INDIVIDUAL_EMPLOYER',
        status: 'PENDING_PAYMENT',
        placedAt: null,
        activatedAt: null,
        guaranteeExpiresAt: null,
        endedAt: null,
        endReason: null,
      },
      { orgName: null, contactName: null, email: 'x@example.com' },
      { fullName: null, stateOfOrigin: null },
      0,
    );
    expect(r.replacementGuaranteeStatus).toBe('not-activated');
  });
});
