import { describe, it, expect } from 'vitest';
import {
  generateOtp,
  generateRefreshToken,
  hashRefreshToken,
  parseRefreshToken,
} from './tokens.js';

describe('auth/tokens', () => {
  it('generates a 6-digit OTP', () => {
    for (let i = 0; i < 50; i++) {
      const otp = generateOtp();
      expect(otp).toMatch(/^\d{6}$/);
    }
  });

  it('generates refresh tokens whose hash is deterministic', () => {
    const { token, hash, tokenId } = generateRefreshToken();
    expect(token.startsWith(tokenId)).toBe(true);
    expect(hashRefreshToken(token)).toBe(hash);
  });

  it('parses refresh tokens and rejects malformed ones', () => {
    const { token, tokenId } = generateRefreshToken();
    expect(parseRefreshToken(token)?.tokenId).toBe(tokenId);
    expect(parseRefreshToken('garbage')).toBeNull();
    expect(parseRefreshToken('short.x')).toBeNull();
  });

  it('produces unique tokens', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a.token).not.toBe(b.token);
    expect(a.tokenId).not.toBe(b.tokenId);
    expect(a.hash).not.toBe(b.hash);
  });
});
