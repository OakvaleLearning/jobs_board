import { z } from 'zod';
import {
  INVOICE_STATUSES,
  PAYMENT_PROVIDERS,
  SUBSCRIPTION_PLANS,
} from '../enums/payment.js';

export const createCheckoutSchema = z.object({
  placementId: z.string().uuid(),
});

export const subscribeSchema = z.object({
  plan: z.enum(SUBSCRIPTION_PLANS),
});
export type SubscribeInput = z.infer<typeof subscribeSchema>;

export const invoiceFiltersSchema = z.object({
  status: z.enum(INVOICE_STATUSES).optional(),
  pipeline: z.enum(['INDIVIDUAL_EMPLOYER', 'CORPORATE']).optional(),
  provider: z.enum(PAYMENT_PROVIDERS).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type InvoiceFiltersInput = z.infer<typeof invoiceFiltersSchema>;

export const refundSchema = z.object({
  reason: z.string().trim().min(4).max(500),
});
export type RefundInput = z.infer<typeof refundSchema>;
