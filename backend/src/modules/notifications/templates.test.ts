import { describe, expect, it } from 'vitest';
import { NOTIFICATION_KINDS } from '@oakvale/shared/enums/notifications.js';
import {
  DEFAULT_TEMPLATES,
  applyContext,
  buildContext,
  extractVariables,
  interpolate,
  render,
} from './templates.js';

describe('notification templates', () => {
  it('renders all kinds', () => {
    const kinds = [
      'identity_verified',
      'welfare_check_due',
      'cpd_expiry_warning',
      'replacement_sla_warning',
      'placement_activated',
      'placement_suspended',
      'invoice_overdue_day1',
      'invoice_overdue_day7',
      'invoice_overdue_day14_admin',
      'payment_failed',
      'subscription_cancelled',
    ] as const;
    for (const k of kinds) {
      const r = render(k, { workerName: 'Ada', invoiceId: 'abc12345', daysRemaining: 60, hoursLeft: 12, reason: 'safeguarding', placementId: 'xyz98765', employerName: 'TinyCo' });
      expect(r.subject.length).toBeGreaterThan(3);
      expect(r.text.length).toBeGreaterThan(10);
      expect(r.sms.toLowerCase()).toContain('oakvale');
    }
  });
  it('substitutes variables', () => {
    const r = render('cpd_expiry_warning', { daysRemaining: 30 });
    expect(r.subject).toContain('30');
    expect(r.text).toContain('30');
  });
  it('renders the §6.3 worker_job_match notice with job + org', () => {
    const r = render('worker_job_match', { jobTitle: 'Certified Caregiver', orgName: 'BrightCare' });
    expect(r.subject).toContain('Certified Caregiver');
    expect(r.text).toContain('BrightCare');
    expect(r.sms.toLowerCase()).toContain('oakvale');
  });
  it('throws on unknown kind', () => {
    // @ts-expect-error testing runtime guard
    expect(() => render('not_a_thing', {})).toThrow();
  });

  // Guards the 31-kind refactor: every kind must have a default + buildContext and produce
  // non-empty copy with an empty payload (all fallbacks applied — no missing-variable throws).
  it('every kind has a default template and renders from an empty payload', () => {
    for (const kind of NOTIFICATION_KINDS) {
      expect(DEFAULT_TEMPLATES[kind]).toBeTruthy();
      const r = render(kind, {});
      expect(r.subject.trim().length).toBeGreaterThan(0);
      expect(r.text.trim().length).toBeGreaterThan(0);
      expect(r.html).toContain('<p>');
      expect(r.sms.trim().length).toBeGreaterThan(0);
      // No unfilled tokens should remain.
      expect(r.subject + r.text + r.sms).not.toContain('{{');
    }
  });
});

describe('template interpolation', () => {
  it('fills known tokens and drops unknown/empty ones', () => {
    expect(interpolate('Hi {{name}} — {{missing}}', { name: 'Ada' })).toBe('Hi Ada — ');
    expect(interpolate('plural worker{{p}}', { p: '' })).toBe('plural worker');
  });

  it('extracts distinct token names across fields', () => {
    expect(extractVariables('{{a}} {{b}}', '{{a}} {{c}}')).toEqual(['a', 'b', 'c']);
  });

  it('applyContext renders all four channels', () => {
    const r = applyContext(
      { subject: '{{x}}', text: 'e {{x}}', html: '<p>{{x}}</p>', sms: 's {{x}}' },
      buildContext('cpd_expiry_warning', { daysRemaining: 14 }),
    );
    // cpd_expiry_warning exposes {{days}}, not {{x}} — unknown token renders empty.
    expect(r.subject).toBe('');
    expect(buildContext('cpd_expiry_warning', { daysRemaining: 14 }).days).toBe('14');
  });
});
