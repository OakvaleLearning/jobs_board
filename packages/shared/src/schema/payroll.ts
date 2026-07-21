import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

export const payrollRunCreateSchema = z
  .object({
    periodStart: isoDate,
    periodEnd: isoDate,
  })
  .refine((v) => v.periodStart <= v.periodEnd, {
    message: 'periodStart must be on or before periodEnd',
    path: ['periodEnd'],
  });
export type PayrollRunCreateInput = z.infer<typeof payrollRunCreateSchema>;

export const markPayoutPaidSchema = z.object({
  reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type MarkPayoutPaidInput = z.infer<typeof markPayoutPaidSchema>;
