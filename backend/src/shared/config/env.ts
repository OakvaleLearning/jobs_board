import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(3000),
    APP_URL: z.string().url().default('http://localhost'),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    JWT_ACCESS_SECRET: z.string().min(16),
    JWT_REFRESH_SECRET: z.string().min(16),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().default(900),
    JWT_REFRESH_TTL_SECONDS: z.coerce.number().default(60 * 60 * 24 * 7),
    S3_BUCKET: z.string().optional().default(''),
    S3_REGION: z.string().optional().default('auto'),
    S3_ACCESS_KEY_ID: z.string().optional().default(''),
    S3_SECRET_ACCESS_KEY: z.string().optional().default(''),
    S3_ENDPOINT: z.string().optional().default(''),
    S3_PUBLIC_URL: z.string().optional().default(''),
    STRIPE_SECRET_KEY: z.string().optional().default(''),
    STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
    STRIPE_PRICE_INDIVIDUAL_EMPLOYER_ANNUAL: z.string().optional().default(''),
    PAYSTACK_SECRET_KEY: z.string().optional().default(''),
    PAYSTACK_WEBHOOK_SECRET: z.string().optional().default(''),
    PAYSTACK_PLAN_CORPORATE_ANNUAL: z.string().optional().default(''),
    FRONTEND_URL: z.string().url().default('http://localhost:3001'),
    RESEND_API_KEY: z.string().optional().default(''),
    FROM_EMAIL: z.string().email().default('noreply@oakvaleltd.com'),
    TERMII_API_KEY: z.string().optional().default(''),
    TERMII_SENDER_ID: z.string().optional().default('Oakvale'),
    // Cloudflare Turnstile — signup bot check (§auth). Unset → stub mode (no-op).
    TURNSTILE_SECRET_KEY: z.string().optional().default(''),
    // Oakvale LMS integration (brief §15 / Open Question #1). Unset → stub mode.
    LMS_API_URL: z.string().optional().default(''),
    LMS_API_KEY: z.string().optional().default(''),
  })
  .superRefine((v, ctx) => {
    if (v.NODE_ENV !== 'production') return;
    const required: Array<keyof typeof v> = [
      'S3_BUCKET',
      'S3_ACCESS_KEY_ID',
      'S3_SECRET_ACCESS_KEY',
      'S3_ENDPOINT',
      'S3_PUBLIC_URL',
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'PAYSTACK_SECRET_KEY',
      'PAYSTACK_WEBHOOK_SECRET',
    ];
    for (const key of required) {
      if (!v[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${key} is required in production`,
          path: [key],
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // console (not Pino) on purpose: this runs on the fatal startup path,
    // possibly before the logger module can be initialized.
    // eslint-disable-next-line no-console
    console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  cached = parsed.data;
  return cached;
}
