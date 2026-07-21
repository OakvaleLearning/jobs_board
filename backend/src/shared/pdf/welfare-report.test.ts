import { beforeAll, describe, expect, it } from 'vitest';

describe('welfare report renderer', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = 'postgres://x:x@127.0.0.1/x';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.JWT_ACCESS_SECRET = 'x'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'y'.repeat(32);
  });

  it('normalises a Green check with full data', async () => {
    const { normaliseWelfareReport } = await import('./welfare-report.js');
    const data = normaliseWelfareReport({
      placement: { id: 'aaaabbbb-cccc-dddd-eeee-ffff00001111', placedAt: '2026-04-01T00:00:00Z' },
      check: {
        scheduledAt: '2026-05-01T00:00:00Z',
        completedAt: '2026-05-02T10:00:00Z',
        recipientWellbeing: 'GOOD',
        workerAttendance: 'GOOD',
        issuesFlagged: false,
        notes: 'All well.',
      },
      needs: { careRecipientName: 'Grandma Ada' },
      worker: { fullName: 'Bola Adeyemi', roleCategory: 'Certified Caregiver' },
      accountManager: { name: 'Tope', email: 'tope@oakvale.test' },
      now: new Date('2026-05-02T12:00:00Z'),
    });
    expect(data.caseRef).toBe('AAAABBBB');
    expect(data.recipientWellbeing).toBe('GOOD');
    expect(data.workerFirstName).toBe('Bola');
    expect(data.careRecipientName).toBe('Grandma Ada');
    expect(data.issuesFlagged).toBe(false);
  });

  it('renders a POOR check to a non-empty PDF buffer', async () => {
    const { normaliseWelfareReport, renderWelfareReport } = await import('./welfare-report.js');
    const data = normaliseWelfareReport({
      placement: { id: 'p2', placedAt: '2026-03-01T00:00:00Z' },
      check: {
        scheduledAt: '2026-04-01T00:00:00Z',
        completedAt: '2026-04-01T10:00:00Z',
        recipientWellbeing: 'POOR',
        workerAttendance: 'FAIR',
        issuesFlagged: true,
        notes: 'Recipient missed two meals; worker arrived late twice.',
      },
      needs: null,
      worker: { fullName: 'Chinwe', roleCategory: 'Certified Childcare Worker' },
      accountManager: { name: null, email: null },
    });
    expect(data.careRecipientName).toBeNull();
    expect(data.issuesFlagged).toBe(true);
    const pdf = await renderWelfareReport(data);
    expect(pdf.length).toBeGreaterThan(500);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  });
});
