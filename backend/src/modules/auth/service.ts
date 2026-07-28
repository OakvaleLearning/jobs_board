import { and, eq, isNull } from 'drizzle-orm';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { db } from '@/shared/db/client.js';
import { sessions, userConsents, users, type User } from '@/shared/db/schema.js';
import { redis } from '@/shared/cache/redis.js';
import { loadEnv } from '@/shared/config/env.js';
import { AppError } from '@/shared/errors/app-error.js';
import { notifier } from '@/shared/notifier/notifier.js';
import { logger } from '@/shared/logger/logger.js';
import { events } from '@/shared/events/bus.js';
import * as notifications from '@/modules/notifications/service.js';
import {
  generateOtp,
  generateRefreshToken,
  generateVerificationToken,
  hashRefreshToken,
  parseRefreshToken,
} from './tokens.js';
import type { Role } from '@oakvale/shared/roles.js';

const env = loadEnv();

const refreshKey = (userId: string, tokenId: string) => `rt:${userId}:${tokenId}`;
const resetOtpKey = (email: string) => `otp:reset:${email}`;
const verifyTokenKey = (token: string) => `verify:email:${token}`;

/** Email-verification links stay valid for 24 hours. */
const VERIFY_TOKEN_TTL_SECONDS = 60 * 60 * 24;

/** Mint a single-use verification token, store it in Redis, and email the link via the notifications queue. */
async function dispatchVerificationEmail(user: User): Promise<void> {
  const token = generateVerificationToken();
  await redis.set(verifyTokenKey(token), user.id, 'EX', VERIFY_TOKEN_TTL_SECONDS);
  const link = `${env.FRONTEND_URL}/verify-email?token=${token}`;
  await notifications.enqueue({
    userId: user.id,
    kind: 'email_verification',
    channel: 'EMAIL',
    payload: { name: user.fullName, link },
    // Per-token nonce so a resend is never suppressed as a duplicate.
    idempotencyKey: `email_verification:${token}`,
  });
}

/**
 * Revoke every active session for a user: drop their refresh tokens from Redis and
 * mark `sessions` rows revoked. Existing short-lived access tokens lapse on their own
 * (≤15 min) and cannot be renewed. Call this when an account is suspended/deactivated.
 */
export async function revokeAllSessions(userId: string): Promise<void> {
  let cursor = '0';
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', `rt:${userId}:*`, 'COUNT', 100);
    cursor = next;
    if (keys.length) await redis.del(...keys);
  } while (cursor !== '0');
  await db
    .update(sessions)
    .set({ revokedAt: new Date(), expiresAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}

export interface RegisterArgs {
  email: string;
  password: string;
  fullName: string;
  role: Role;
  /** Chosen configurable employer type (§5) — present when role is EMPLOYER. */
  employerTypeId?: string;
  /** Referral attribution captured at signup (brief §2). */
  referralSource?: string;
  referrerName?: string;
  /** §6.1 Step 1 consents (validated by registerSchema). */
  acceptedTerms: true;
  acceptedPrivacy: true;
  acceptedBackgroundCheck?: boolean;
  /** Request IP, recorded against the consent rows for audit. */
  ip?: string;
}

/** Bump when the legal text materially changes so re-consent can be detected. */
export const CONSENT_VERSION = '2026-06-13';

export interface LoginArgs {
  email: string;
  password: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface SignAccessToken {
  (payload: { sub: string; role: Role }): Promise<string>;
}

export interface AuthDeps {
  signAccessToken: SignAccessToken;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export function createAuthService(deps: AuthDeps) {
  async function register(args: RegisterArgs): Promise<User> {
    const existing = await db.query.users.findFirst({ where: eq(users.email, args.email) });
    if (existing) {
      throw new AppError({
        code: 'EMAIL_IN_USE',
        message: 'An account with this email already exists.',
        statusCode: 409,
      });
    }
    const passwordHash = await argonHash(args.password);
    const [created] = await db
      .insert(users)
      .values({
        email: args.email,
        passwordHash,
        fullName: args.fullName,
        role: args.role,
        referralSource: args.referralSource ?? null,
        // Only retain the referrer name for personal referrals (brief §2).
        referrerName:
          args.referralSource === 'PERSONAL_REFERRAL' ? (args.referrerName ?? null) : null,
      })
      .returning();
    if (!created) throw new AppError({ code: 'INTERNAL_ERROR', message: 'Failed to create user', statusCode: 500 });

    // §6.1 Step 1 — record consents for audit (NDPA §13.2). Terms + privacy for
    // everyone; background-check consent for workers.
    const consentTypes = ['TERMS', 'PRIVACY'];
    if (created.role === 'WORKER' && args.acceptedBackgroundCheck) consentTypes.push('BACKGROUND_CHECK');
    await db.insert(userConsents).values(
      consentTypes.map((consentType) => ({
        userId: created.id,
        consentType,
        version: CONSENT_VERSION,
        ip: args.ip ?? null,
      })),
    );

    // Let the employers module create the employer row with the chosen type.
    events.emit('user.registered', {
      userId: created.id,
      role: created.role,
      employerTypeId: args.employerTypeId,
    });

    await dispatchVerificationEmail(created);
    return created;
  }

  /** Confirm an email-verification link. Single-use: the token is consumed on success. */
  async function verifyEmailByToken(token: string): Promise<void> {
    const userId = await redis.get(verifyTokenKey(token));
    if (!userId) {
      throw new AppError({
        code: 'INVALID_TOKEN',
        message: 'This verification link is invalid or has expired.',
        statusCode: 400,
      });
    }
    await redis.del(verifyTokenKey(token));
    await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, userId));
  }

  /** Re-send a verification link. Silent for unknown or already-verified emails (no account enumeration). */
  async function resendVerification(email: string): Promise<void> {
    const user = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (!user) {
      logger.info({ email }, 'resend-verification requested for unknown email (silent)');
      return;
    }
    if (user.emailVerifiedAt) {
      logger.info({ email }, 'resend-verification requested for already-verified email (silent)');
      return;
    }
    await dispatchVerificationEmail(user);
  }

  async function login(args: LoginArgs): Promise<IssuedTokens & { user: User }> {
    const user = await db.query.users.findFirst({
      where: and(eq(users.email, args.email), isNull(users.deletedAt)),
    });
    if (!user) {
      throw new AppError({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.', statusCode: 401 });
    }
    const ok = await argonVerify(user.passwordHash, args.password);
    if (!ok) {
      throw new AppError({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.', statusCode: 401 });
    }
    if (!user.isActive) {
      throw new AppError({
        code: 'ACCOUNT_SUSPENDED',
        message: 'Your account has been suspended. Please contact Oakvale support.',
        statusCode: 403,
      });
    }
    const tokens = await issueTokens(user, args.userAgent, args.ipAddress);
    return { ...tokens, user };
  }

  async function issueTokens(
    user: User,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<IssuedTokens> {
    const accessToken = await deps.signAccessToken({ sub: user.id, role: user.role });
    const refresh = generateRefreshToken();
    const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_SECONDS * 1000);
    await db.insert(sessions).values({
      userId: user.id,
      refreshTokenHash: refresh.hash,
      userAgent,
      ipAddress,
      expiresAt,
    });
    await redis.set(refreshKey(user.id, refresh.tokenId), refresh.hash, 'EX', env.JWT_REFRESH_TTL_SECONDS);
    return {
      accessToken,
      refreshToken: refresh.token,
      expiresIn: env.JWT_ACCESS_TTL_SECONDS,
    };
  }

  async function refresh(token: string): Promise<IssuedTokens> {
    const parsed = parseRefreshToken(token);
    if (!parsed) throw new AppError({ code: 'INVALID_REFRESH_TOKEN', message: 'Invalid refresh token.', statusCode: 401 });
    const givenHash = hashRefreshToken(token);

    const userIds = await scanForToken(parsed.tokenId);
    let matchedUserId: string | null = null;
    for (const uid of userIds) {
      const storedHash = await redis.get(refreshKey(uid, parsed.tokenId));
      if (storedHash && storedHash === givenHash) {
        matchedUserId = uid;
        break;
      }
    }
    if (!matchedUserId) {
      throw new AppError({ code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token not recognised.', statusCode: 401 });
    }
    await redis.del(refreshKey(matchedUserId, parsed.tokenId));

    const user = await db.query.users.findFirst({ where: eq(users.id, matchedUserId) });
    if (!user) throw new AppError({ code: 'INVALID_REFRESH_TOKEN', message: 'User no longer exists.', statusCode: 401 });
    if (!user.isActive) {
      // Suspended mid-session: kill remaining sessions and refuse renewal.
      await revokeAllSessions(user.id);
      throw new AppError({
        code: 'ACCOUNT_SUSPENDED',
        message: 'Your account has been suspended. Please contact Oakvale support.',
        statusCode: 403,
      });
    }
    return issueTokens(user);
  }

  async function scanForToken(tokenId: string): Promise<string[]> {
    const found: string[] = [];
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', `rt:*:${tokenId}`, 'COUNT', 100);
      cursor = next;
      for (const k of keys) {
        const parts = k.split(':');
        if (parts[1]) found.push(parts[1]);
      }
    } while (cursor !== '0');
    return found;
  }

  async function logout(token: string): Promise<void> {
    const parsed = parseRefreshToken(token);
    if (!parsed) return;
    const userIds = await scanForToken(parsed.tokenId);
    for (const uid of userIds) {
      await redis.del(refreshKey(uid, parsed.tokenId));
    }
  }

  async function forgotPassword(email: string): Promise<void> {
    const user = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (!user) {
      logger.info({ email }, 'forgot-password requested for unknown email (silent)');
      return;
    }
    const otp = generateOtp();
    await redis.set(resetOtpKey(email), otp, 'EX', 600);
    await notifier.send({
      channel: 'email',
      to: email,
      subject: 'Reset your Oakvale password',
      body: `Your password reset code is ${otp}. It expires in 10 minutes.`,
    });
  }

  async function resetPassword(email: string, otp: string, newPassword: string): Promise<void> {
    const stored = await redis.get(resetOtpKey(email));
    if (!stored || stored !== otp) {
      throw new AppError({ code: 'INVALID_OTP', message: 'Invalid or expired reset code.', statusCode: 400 });
    }
    await redis.del(resetOtpKey(email));
    const passwordHash = await argonHash(newPassword);
    await db.update(users).set({ passwordHash }).where(eq(users.email, email));
  }

  /** Fetch the current user's account record (for GET /auth/me). */
  async function getAccount(userId: string): Promise<User> {
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) throw new AppError({ code: 'USER_NOT_FOUND', message: 'User not found.', statusCode: 404 });
    return user;
  }

  /**
   * Self-serve account edit (fullName / phone). Returns the fresh user row so the
   * caller can echo it back to the client and refresh their session state.
   */
  async function updateAccount(
    userId: string,
    patch: { fullName?: string; phone?: string | null },
  ): Promise<User> {
    const set: Partial<Pick<User, 'fullName' | 'phone'>> = {};
    if (patch.fullName !== undefined) set.fullName = patch.fullName;
    if (patch.phone !== undefined) set.phone = patch.phone;
    if (Object.keys(set).length === 0) {
      const current = await db.query.users.findFirst({ where: eq(users.id, userId) });
      if (!current) throw new AppError({ code: 'USER_NOT_FOUND', message: 'User not found.', statusCode: 404 });
      return current;
    }
    const [updated] = await db.update(users).set(set).where(eq(users.id, userId)).returning();
    if (!updated) throw new AppError({ code: 'USER_NOT_FOUND', message: 'User not found.', statusCode: 404 });
    return updated;
  }

  /**
   * In-app password change. Verifies the current password, then rotates the hash
   * and revokes all sessions so other devices are logged out.
   */
  async function changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) throw new AppError({ code: 'USER_NOT_FOUND', message: 'User not found.', statusCode: 404 });
    const ok = await argonVerify(user.passwordHash, currentPassword);
    if (!ok) {
      throw new AppError({
        code: 'INVALID_CREDENTIALS',
        message: 'Your current password is incorrect.',
        statusCode: 400,
      });
    }
    const passwordHash = await argonHash(newPassword);
    await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
    await revokeAllSessions(userId);
  }

  return {
    register,
    verifyEmailByToken,
    resendVerification,
    login,
    refresh,
    logout,
    forgotPassword,
    resetPassword,
    getAccount,
    updateAccount,
    changePassword,
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
