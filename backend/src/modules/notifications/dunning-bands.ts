export const DUNNING_BANDS = [
  { day: 1 as const, kind: 'invoice_overdue_day1', admin: false },
  { day: 7 as const, kind: 'invoice_overdue_day7', admin: false },
  { day: 14 as const, kind: 'invoice_overdue_day14_admin', admin: true },
];

export function overdueDays(dueAt: Date, now: Date): number {
  return Math.floor((now.getTime() - dueAt.getTime()) / (1000 * 60 * 60 * 24));
}

export function bandFor(days: number) {
  if (days >= 14) return DUNNING_BANDS[2]!;
  if (days >= 7) return DUNNING_BANDS[1]!;
  if (days >= 1) return DUNNING_BANDS[0]!;
  return null;
}
