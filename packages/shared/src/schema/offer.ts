import { z } from 'zod';
import {
  OFFER_ACCOMMODATION_TYPES,
  OFFER_CURRENCIES,
  OFFER_STATUSES,
} from '../enums/offer.js';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const offerCreateSchema = z.object({
  shortlistId: z.string().uuid(),
  workerId: z.string().uuid(),
  startDate: isoDate,
  endDate: isoDate.optional(),
  salaryAmountMinor: z.number().int().min(0),
  salaryCurrency: z.enum(OFFER_CURRENCIES),
  accommodationType: z.enum(OFFER_ACCOMMODATION_TYPES).optional(),
  schedule: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2_000).optional(),
});
export type OfferCreateInput = z.infer<typeof offerCreateSchema>;

export const offerCounterSchema = z.object({
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  salaryAmountMinor: z.number().int().min(0).optional(),
  salaryCurrency: z.enum(OFFER_CURRENCIES).optional(),
  accommodationType: z.enum(OFFER_ACCOMMODATION_TYPES).optional(),
  schedule: z.string().trim().max(200).optional(),
  notes: z.string().trim().min(1).max(2_000),
});
export type OfferCounterInput = z.infer<typeof offerCounterSchema>;

export const offerDeclineSchema = z.object({
  reason: z.string().trim().min(1).max(1_000),
});
export type OfferDeclineInput = z.infer<typeof offerDeclineSchema>;

export const offerFiltersSchema = z.object({
  status: z.enum(OFFER_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type OfferFiltersInput = z.infer<typeof offerFiltersSchema>;
