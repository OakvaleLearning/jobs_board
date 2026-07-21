import { describe, expect, it } from 'vitest';
import { addBusinessDays, currentBusinessDayCount, NG_HOLIDAYS } from './business-days.js';

describe('addBusinessDays', () => {
  it('adds 1 to a Monday → Tuesday', () => {
    const monday = new Date('2026-06-01T12:00:00Z'); // Mon
    const r = addBusinessDays(monday, 1);
    expect(r.getUTCDate()).toBe(2);
  });
  it('skips the weekend when adding from Friday', () => {
    const friday = new Date('2026-06-05T12:00:00Z'); // Fri
    const r = addBusinessDays(friday, 1);
    expect(r.getUTCDay()).toBe(1);
  });
  it('adds 5 biz days from Monday → next Monday', () => {
    const monday = new Date('2026-06-01T12:00:00Z');
    const r = addBusinessDays(monday, 5);
    expect(r.getUTCDay()).toBe(1);
  });
  it('adds 3 biz days from Wed → next Mon', () => {
    const wed = new Date('2026-06-03T12:00:00Z');
    const r = addBusinessDays(wed, 3);
    expect(r.getUTCDay()).toBe(1);
  });
  it('skips Christmas Day + weekend + Boxing Day observed', () => {
    const thu = new Date('2026-12-24T12:00:00Z');
    const r = addBusinessDays(thu, 1);
    expect(r.toISOString().slice(0, 10)).toBe('2026-12-29');
  });
  it("skips New Year's Day", () => {
    const dec31 = new Date('2025-12-31T12:00:00Z');
    const r = addBusinessDays(dec31, 1);
    expect(r.toISOString().slice(0, 10)).toBe('2026-01-02');
  });
  it('skips Eid al-Fitr Fri + weekend + Mon observance', () => {
    const thu = new Date('2026-03-19T12:00:00Z');
    const r = addBusinessDays(thu, 1);
    expect(r.toISOString().slice(0, 10)).toBe('2026-03-24');
  });
  it('NG_HOLIDAYS covers 2026 + 2027 dates', () => {
    expect(NG_HOLIDAYS.has('2026-01-01')).toBe(true);
    expect(NG_HOLIDAYS.has('2026-12-25')).toBe(true);
    expect(NG_HOLIDAYS.has('2027-10-01')).toBe(true);
  });
  it('currentBusinessDayCount excludes holidays', () => {
    const from = new Date('2026-12-22T00:00:00Z'); // Tue
    const to = new Date('2026-12-29T00:00:00Z'); // Tue
    // 23 Wed, 24 Thu, (25 Fri = Xmas), (26-27 weekend), (28 Mon = Boxing Day obs), 29 Tue = 3
    expect(currentBusinessDayCount(from, to)).toBe(3);
  });
});
