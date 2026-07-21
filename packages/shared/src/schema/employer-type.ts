import { z } from 'zod';
import {
  VERIFICATION_METHODS,
  SERVICE_MODELS,
  ONBOARDING_STEP_KEYS,
} from '../enums/employer-type.js';
import { CONTRACT_TYPES } from '../enums/contracts.js';
import { PAYMENT_PROVIDERS, CURRENCIES } from '../enums/payment.js';

const nonEmpty = z.string().trim().min(1);

/** A priced line (subscription or placement fee) for an employer type. */
export const employerPriceSchema = z.object({
  amountMinor: z.number().int().min(0),
  currency: z.enum(CURRENCIES),
  provider: z.enum(PAYMENT_PROVIDERS),
});
export type EmployerPrice = z.infer<typeof employerPriceSchema>;

export const employerPricingSchema = z.object({
  subscription: employerPriceSchema.nullish(),
  placementFee: employerPriceSchema.nullish(),
});
export type EmployerPricing = z.infer<typeof employerPricingSchema>;

export const employerTypeCreateSchema = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[A-Z][A-Z0-9_]*$/, 'Slug must be UPPER_SNAKE_CASE.')
    .max(80),
  name: nonEmpty.max(160),
  description: z.string().trim().max(2_000).optional(),
  /** Stable key used for landing routes / dashboard branching, e.g. "individual-employer". */
  roleKey: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9-]*$/, 'roleKey must be lowercase kebab/alphanumeric.')
    .max(40),
  registrationFields: z.array(z.string().trim().min(1).max(80)).max(60).default([]),
  verificationMethods: z.array(z.enum(VERIFICATION_METHODS)).default([]),
  serviceModel: z.enum(SERVICE_MODELS).default('SELF_SERVICE'),
  jobPostingEnabled: z.boolean().default(false),
  onboardingSteps: z.array(z.enum(ONBOARDING_STEP_KEYS)).max(20).default([]),
  /** null = all categories accessible; otherwise the allow-list of category UUIDs. */
  allowedWorkerCategoryIds: z.array(z.string().uuid()).nullish(),
  applicableContractTypes: z.array(z.enum(CONTRACT_TYPES)).default([]),
  pricing: employerPricingSchema.default({}),
  paymentProviders: z.array(z.enum(PAYMENT_PROVIDERS)).default([]),
  displayOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});
export type EmployerTypeCreateInput = z.infer<typeof employerTypeCreateSchema>;

export const employerTypeUpdateSchema = employerTypeCreateSchema.omit({ slug: true }).partial();
export type EmployerTypeUpdateInput = z.infer<typeof employerTypeUpdateSchema>;

export const employerTypeFiltersSchema = z.object({
  activeOnly: z.coerce.boolean().optional(),
});
export type EmployerTypeFiltersInput = z.infer<typeof employerTypeFiltersSchema>;
