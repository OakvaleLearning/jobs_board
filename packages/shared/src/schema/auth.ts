import { z } from 'zod';
import { PUBLIC_SIGNUP_ROLES } from '../roles.js';

export const emailSchema = z.string().trim().toLowerCase().email();
export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128);

/**
 * Referral attribution options shown at signup (brief §2). A fixed dropdown — not a
 * free-entry code. When PERSONAL_REFERRAL is chosen the UI reveals a referrer-name
 * field (names are more memorable to users than codes).
 */
export const REFERRAL_SOURCES = [
  'SOCIAL_MEDIA',
  'PERSONAL_REFERRAL',
  'SEARCH_ONLINE',
  'OTHER_NONE',
] as const;
export type ReferralSource = (typeof REFERRAL_SOURCES)[number];

export const REFERRAL_SOURCE_LABELS: Record<ReferralSource, string> = {
  SOCIAL_MEDIA: 'Social media',
  PERSONAL_REFERRAL: 'Personal referral',
  SEARCH_ONLINE: 'Search / online',
  OTHER_NONE: 'Other / none',
};

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    fullName: z.string().trim().min(2).max(120),
    role: z.enum(PUBLIC_SIGNUP_ROLES),
    /** Required when role is EMPLOYER: the chosen configurable employer type (§5). */
    employerTypeId: z.string().uuid().optional(),
    /** How the user heard about the jobs board (brief §2) — optional dropdown value. */
    referralSource: z.enum(REFERRAL_SOURCES).optional(),
    /** Referrer's name — only meaningful when referralSource is PERSONAL_REFERRAL. */
    referrerName: z.string().trim().min(2).max(120).optional(),
    /** §6.1 Step 1 consents — terms + privacy always; background check for workers. */
    acceptedTerms: z.literal(true, {
      errorMap: () => ({ message: 'You must accept the terms of service.' }),
    }),
    acceptedPrivacy: z.literal(true, {
      errorMap: () => ({ message: 'You must accept the privacy policy.' }),
    }),
    acceptedBackgroundCheck: z.boolean().optional(),
    /**
     * Cloudflare Turnstile token from the signup widget. Optional at the schema
     * layer so stub-mode/tests pass; the backend enforces its presence only when
     * TURNSTILE_SECRET_KEY is configured (see verifyTurnstile).
     */
    turnstileToken: z.string().optional(),
  })
  .refine((v) => v.role !== 'EMPLOYER' || Boolean(v.employerTypeId), {
    message: 'An employer type is required.',
    path: ['employerTypeId'],
  })
  .refine((v) => v.role !== 'WORKER' || v.acceptedBackgroundCheck === true, {
    message: 'You must consent to a background check to register as a worker.',
    path: ['acceptedBackgroundCheck'],
  })
  .refine((v) => v.referralSource !== 'PERSONAL_REFERRAL' || Boolean(v.referrerName), {
    message: "Please enter the name of the person who referred you.",
    path: ['referrerName'],
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});

export const forgotSchema = z.object({ email: emailSchema });

export const resetSchema = z.object({
  email: emailSchema,
  otp: z.string().regex(/^\d{6}$/),
  newPassword: passwordSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(32),
});

export const resendVerificationSchema = z.object({ email: emailSchema });
