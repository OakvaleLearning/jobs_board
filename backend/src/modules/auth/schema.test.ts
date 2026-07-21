import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  registerSchema,
  resetSchema,
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
});
