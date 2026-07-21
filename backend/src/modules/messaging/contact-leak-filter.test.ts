import { describe, expect, it } from 'vitest';
import { checkContactLeaks } from './contact-leak-filter.js';

describe('contact leak filter', () => {
  it('flags an international phone number', () => {
    const r = checkContactLeaks('Hi, call me on +234 80 1234 5678 anytime.');
    expect(r.flagged).toBe(true);
    expect(r.reasons).toContain('PHONE_NUMBER');
    expect(r.redacted).not.toContain('5678');
  });

  it('flags an NG local mobile number', () => {
    const r = checkContactLeaks('Reach me on 08012345678');
    expect(r.flagged).toBe(true);
    expect(r.reasons).toContain('PHONE_NUMBER');
  });

  it('flags an email address', () => {
    const r = checkContactLeaks('Send to ada.nwosu@example.com');
    expect(r.flagged).toBe(true);
    expect(r.reasons).toContain('EMAIL');
    expect(r.redacted).not.toContain('ada.nwosu');
  });

  it('flags a wa.me link', () => {
    const r = checkContactLeaks('Click https://wa.me/2348012345678');
    expect(r.flagged).toBe(true);
    expect(r.reasons).toContain('WHATSAPP_LINK');
  });

  it('flags a Telegram handle', () => {
    const r = checkContactLeaks('Find me on @adatelegram');
    expect(r.flagged).toBe(true);
    expect(r.reasons).toContain('TELEGRAM_HANDLE');
  });

  it('does not flag innocuous text', () => {
    const r = checkContactLeaks(
      'Thank you for the interview opportunity. I am available next Monday.',
    );
    expect(r.flagged).toBe(false);
    expect(r.reasons).toHaveLength(0);
    expect(r.redacted).toContain('next Monday');
  });

  it('flags multiple reasons in one message', () => {
    const r = checkContactLeaks('Email me ada@x.com or call 08012345678 or wa.me/123');
    expect(r.reasons).toEqual(
      expect.arrayContaining(['EMAIL', 'PHONE_NUMBER', 'WHATSAPP_LINK']),
    );
  });
});
