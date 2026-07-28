import { describe, it, expect } from 'vitest';
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  resetSchema,
  updateAccountSchema,
  verifyEmailSchema,
} from '@oakvale/shared/schema/auth.js';

const workerConsents = { acceptedTerms: true, acceptedPrivacy: true, acceptedBackgroundCheck: true };

describe('auth/schemas', () => {
  it('accepts a valid worker registration', () => {
    const parsed = registerSchema.parse({
      email: 'Worker@Example.com  ',
      password: 'a-very-strong-pw-1',
      fullName: 'Ada Lovelace',
      role: 'WORKER',
      ...workerConsents,
    });
    expect(parsed.email).toBe('worker@example.com');
    expect(parsed.role).toBe('WORKER');
  });

  it('rejects admin role on public signup', () => {
    expect(() =>
      registerSchema.parse({
        email: 'x@y.com',
        password: 'a-very-strong-pw-1',
        fullName: 'X',
        role: 'ADMIN',
        ...workerConsents,
      }),
    ).toThrow();
  });

  it('rejects short passwords', () => {
    expect(() =>
      registerSchema.parse({
        email: 'x@y.com',
        password: 'short',
        fullName: 'Y',
        role: 'WORKER',
        ...workerConsents,
      }),
    ).toThrow();
  });

  it('requires terms + privacy consent for any signup', () => {
    expect(() =>
      registerSchema.parse({
        email: 'x@y.com',
        password: 'a-very-strong-pw-1',
        fullName: 'Y',
        role: 'WORKER',
        acceptedPrivacy: true,
        acceptedBackgroundCheck: true,
      }),
    ).toThrow();
  });

  it('requires background-check consent for workers but not employers', () => {
    expect(() =>
      registerSchema.parse({
        email: 'x@y.com',
        password: 'a-very-strong-pw-1',
        fullName: 'Y',
        role: 'WORKER',
        acceptedTerms: true,
        acceptedPrivacy: true,
      }),
    ).toThrow();
    const employer = registerSchema.parse({
      email: 'hr@corp.com',
      password: 'a-very-strong-pw-1',
      fullName: 'HR',
      role: 'EMPLOYER',
      employerTypeId: '11111111-1111-1111-1111-111111111111',
      acceptedTerms: true,
      acceptedPrivacy: true,
    });
    expect(employer.role).toBe('EMPLOYER');
  });

  it('validates login + reset shapes', () => {
    expect(loginSchema.parse({ email: 'a@b.com', password: 'x' }).email).toBe('a@b.com');
    expect(() => resetSchema.parse({ email: 'a@b.com', otp: '12', newPassword: 'a-very-strong-pw-1' })).toThrow();
    const token = 'a'.repeat(64);
    expect(verifyEmailSchema.parse({ token }).token).toBe(token);
    expect(() => verifyEmailSchema.parse({ token: 'short' })).toThrow();
  });

  it('accepts partial account edits and trims/normalises input', () => {
    expect(updateAccountSchema.parse({ fullName: '  Ada Lovelace  ' }).fullName).toBe('Ada Lovelace');
    expect(updateAccountSchema.parse({ phone: '+2348012345678' }).phone).toBe('+2348012345678');
    // Both fields optional — an empty patch is valid.
    expect(updateAccountSchema.parse({})).toEqual({});
    // Phone may be explicitly cleared.
    expect(updateAccountSchema.parse({ phone: null }).phone).toBeNull();
  });

  it('rejects a too-short full name on account edit', () => {
    expect(() => updateAccountSchema.parse({ fullName: 'A' })).toThrow();
  });

  it('requires a current password and a strong new password on change', () => {
    expect(
      changePasswordSchema.parse({ currentPassword: 'old', newPassword: 'a-very-strong-pw-1' }),
    ).toEqual({ currentPassword: 'old', newPassword: 'a-very-strong-pw-1' });
    expect(() => changePasswordSchema.parse({ currentPassword: '', newPassword: 'a-very-strong-pw-1' })).toThrow();
    expect(() => changePasswordSchema.parse({ currentPassword: 'old', newPassword: 'short' })).toThrow();
  });
});
