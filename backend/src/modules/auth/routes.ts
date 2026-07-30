import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import {
  changePasswordSchema,
  forgotSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resendVerificationSchema,
  resetSchema,
  updateAccountSchema,
  verifyEmailSchema,
} from '@oakvale/shared/schema/auth.js';
import { createAuthService } from './service.js';
import { verifyTurnstile } from '@/shared/security/turnstile.js';
import { AppError } from '@/shared/errors/app-error.js';
import type { Role } from '@oakvale/shared/roles.js';

export const authRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const service = createAuthService({
    signAccessToken: async (payload) => app.jwt.sign(payload, { expiresIn: `${app.config.JWT_ACCESS_TTL_SECONDS}s` }),
  });

  // BUG-002 — throttle credential/OTP endpoints (per IP) to blunt brute-force.
  const otpRateLimit = { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } };
  const loginRateLimit = { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } };
  const registerRateLimit = { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } };

  app.post('/register', registerRateLimit, async (req, reply) => {
    const input = registerSchema.parse(req.body);
    // Bot check before we create anything (no-op in stub mode). Keeps the handler
    // thin: validate → captcha → service.
    await verifyTurnstile(input.turnstileToken, req.ip);
    const user = await service.register({ ...input, ip: req.ip });
    reply.code(201);
    return { data: { id: user.id, email: user.email, role: user.role } };
  });

  app.post('/verify-email', otpRateLimit, async (req) => {
    const input = verifyEmailSchema.parse(req.body);
    const result = await service.verifyEmailByToken(input.token, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    return {
      data: {
        verified: true,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
        user: {
          id: result.user.id,
          email: result.user.email,
          fullName: result.user.fullName,
          role: result.user.role as Role,
        },
      },
    };
  });

  app.post('/resend-verification', otpRateLimit, async (req) => {
    const input = resendVerificationSchema.parse(req.body);
    await service.resendVerification(input.email);
    return { data: { sent: true } };
  });

  app.post('/login', loginRateLimit, async (req) => {
    const input = loginSchema.parse(req.body);
    const result = await service.login({
      email: input.email,
      password: input.password,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    return {
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
        user: {
          id: result.user.id,
          email: result.user.email,
          fullName: result.user.fullName,
          role: result.user.role as Role,
        },
      },
    };
  });

  app.post('/refresh', otpRateLimit, async (req) => {
    const input = refreshSchema.parse(req.body);
    const tokens = await service.refresh(input.refreshToken);
    return { data: tokens };
  });

  app.post('/logout', async (req) => {
    const input = refreshSchema.parse(req.body);
    await service.logout(input.refreshToken);
    return { data: { loggedOut: true } };
  });

  app.post('/forgot-password', otpRateLimit, async (req) => {
    const input = forgotSchema.parse(req.body);
    await service.forgotPassword(input.email);
    return { data: { sent: true } };
  });

  app.post('/reset-password', otpRateLimit, async (req) => {
    const input = resetSchema.parse(req.body);
    await service.resetPassword(input.email, input.otp, input.newPassword);
    return { data: { reset: true } };
  });

  app.get('/me', { preHandler: app.requireAuth }, async (req) => {
    const userId = (req.user as { sub?: string } | undefined)?.sub;
    if (!userId) throw new AppError({ code: 'UNAUTHORIZED', message: 'Auth required.', statusCode: 401 });
    const user = await service.getAccount(userId);
    return {
      data: {
        user: { id: user.id, email: user.email, fullName: user.fullName, phone: user.phone, role: user.role as Role },
      },
    };
  });

  app.patch('/me', { preHandler: app.requireAuth }, async (req) => {
    const userId = (req.user as { sub?: string } | undefined)?.sub;
    if (!userId) throw new AppError({ code: 'UNAUTHORIZED', message: 'Auth required.', statusCode: 401 });
    const input = updateAccountSchema.parse(req.body);
    const user = await service.updateAccount(userId, input);
    return {
      data: {
        user: { id: user.id, email: user.email, fullName: user.fullName, phone: user.phone, role: user.role as Role },
      },
    };
  });

  app.post('/change-password', { ...otpRateLimit, preHandler: app.requireAuth }, async (req) => {
    const userId = (req.user as { sub?: string } | undefined)?.sub;
    if (!userId) throw new AppError({ code: 'UNAUTHORIZED', message: 'Auth required.', statusCode: 401 });
    const input = changePasswordSchema.parse(req.body);
    await service.changePassword(userId, input.currentPassword, input.newPassword);
    return { data: { changed: true } };
  });
};
