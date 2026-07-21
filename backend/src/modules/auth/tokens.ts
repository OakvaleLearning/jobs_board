import { createHash, randomBytes } from 'node:crypto';

export interface AccessTokenPayload {
  sub: string;
  role: string;
}

export function generateRefreshToken(): { token: string; tokenId: string; hash: string } {
  const tokenId = randomBytes(16).toString('hex');
  const secretPart = randomBytes(32).toString('hex');
  const token = `${tokenId}.${secretPart}`;
  const hash = hashRefreshToken(token);
  return { token, tokenId, hash };
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function parseRefreshToken(token: string): { tokenId: string } | null {
  const [tokenId] = token.split('.');
  if (!tokenId || tokenId.length < 16) return null;
  return { tokenId };
}

export function generateOtp(): string {
  const n = randomBytes(4).readUInt32BE(0) % 1_000_000;
  return n.toString().padStart(6, '0');
}

/** Opaque single-use token embedded in email-verification links (32 bytes → 64 hex chars). */
export function generateVerificationToken(): string {
  return randomBytes(32).toString('hex');
}
