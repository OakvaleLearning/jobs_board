import { beforeAll, describe, expect, it } from 'vitest';

describe('notification template-store previewTemplate', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = 'postgres://x:x@127.0.0.1/x';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.JWT_ACCESS_SECRET = 'x'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'y'.repeat(32);
  });

  it('renders a draft against the kind sample variables', async () => {
    const { previewTemplate } = await import('./template-store.js');
    const out = previewTemplate('cpd_expiry_warning', {
      subject: 'Expires in {{days}} days',
      text: 'Renew within {{days}} days.',
      html: '<p>{{days}}</p>',
      sms: '{{days}} days left',
    });
    expect(out.subject).toBe('Expires in 60 days');
    expect(out.sms).toBe('60 days left');
    expect(out.html).toContain('60');
  });

  it('leaves unknown placeholders empty rather than throwing', async () => {
    const { previewTemplate } = await import('./template-store.js');
    const out = previewTemplate('subscription_cancelled', {
      subject: 'Bye {{whoever}}',
      text: 'text',
      html: '<p>html</p>',
      sms: 'sms',
    });
    expect(out.subject).toBe('Bye ');
  });

  it('rejects an unknown kind', async () => {
    const { previewTemplate } = await import('./template-store.js');
    expect(() =>
      previewTemplate('not_a_kind', { subject: 'a', text: 'b', html: '<p>c</p>', sms: 'd' }),
    ).toThrow();
  });
});
