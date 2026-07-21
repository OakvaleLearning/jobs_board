/**
 * Hand-curated Nigerian Federal Government public-holiday list for 2026 + 2027.
 *
 * Islamic-calendar holidays (Eid al-Fitr, Eid al-Adha, Eid al-Mawlid) are
 * observation-based. The dates below match the Federal Government's
 * pre-announced calendar — refresh this set every year via a Phase-11-or-later
 * follow-up before the on-call dev rolls over to a new year.
 */
export const NG_HOLIDAYS: ReadonlySet<string> = new Set([
  // 2026
  '2026-01-01', // New Year's Day
  '2026-03-20', // Eid al-Fitr (approx, FGN-announced)
  '2026-03-23', // Eid al-Fitr holiday (Mon obs)
  '2026-04-03', // Good Friday
  '2026-04-06', // Easter Monday
  '2026-05-01', // Workers' Day
  '2026-05-27', // Eid al-Adha (approx)
  '2026-05-28', // Eid al-Adha day 2
  '2026-06-12', // Democracy Day
  '2026-08-24', // Eid al-Mawlid (approx)
  '2026-10-01', // Independence Day
  '2026-12-25', // Christmas Day
  '2026-12-28', // Boxing Day (Sun obs → Mon)
  // 2027
  '2027-01-01',
  '2027-03-10',
  '2027-03-26',
  '2027-03-29',
  '2027-05-03', // Workers' Day (Sun obs → Mon)
  '2027-05-17',
  '2027-05-18',
  '2027-06-14', // Democracy Day (Sat obs → Mon)
  '2027-08-13',
  '2027-10-01',
  '2027-12-27', // Christmas Day (Sat obs → Mon)
  '2027-12-28',
]);

function isoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isBusinessDay(d: Date): boolean {
  const day = d.getUTCDay();
  if (day === 0 || day === 6) return false;
  if (NG_HOLIDAYS.has(isoDate(d))) return false;
  return true;
}

/**
 * Add `n` business days (Mon–Fri, skipping NG public holidays) to `from`.
 */
export function addBusinessDays(from: Date, n: number): Date {
  const out = new Date(from);
  let added = 0;
  while (added < n) {
    out.setUTCDate(out.getUTCDate() + 1);
    if (isBusinessDay(out)) added += 1;
  }
  return out;
}

/**
 * Count business days strictly between `from` (exclusive) and `to` (inclusive).
 */
export function currentBusinessDayCount(from: Date, to: Date): number {
  let count = 0;
  const cursor = new Date(from);
  while (cursor < to) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (cursor <= to && isBusinessDay(cursor)) count += 1;
  }
  return count;
}
