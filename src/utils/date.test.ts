import { describe, it, expect } from 'vitest';
import {
  parseLocalDate,
  toDate,
  getPeriodBoundaries,
  getNextPeriodBoundaries,
  areDatesInSameMonth,
  isDateInCurrentMonth,
} from './date';

describe('parseLocalDate', () => {
  it('parses YYYY-MM-DD as local noon (no timezone drift)', () => {
    const d = parseLocalDate('2025-12-15');
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(11); // December
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(12); // parsed at noon to dodge DST edges
  });

  it('does not roll back a day the way new Date("YYYY-MM-DD") can in western zones', () => {
    // new Date('2025-01-01') is UTC midnight -> Dec 31 in UTC-x zones.
    // parseLocalDate keeps the calendar day the user typed.
    const d = parseLocalDate('2025-01-01');
    expect(d.getDate()).toBe(1);
    expect(d.getMonth()).toBe(0);
  });
});

describe('toDate', () => {
  it('returns a Date unchanged', () => {
    const d = new Date(2025, 5, 1);
    expect(toDate(d)).toBe(d);
  });

  it('converts a Firestore Timestamp-like object via toDate()', () => {
    const expected = new Date(2025, 0, 1);
    const stamp = { toDate: () => expected };
    expect(toDate(stamp)).toBe(expected);
  });

  it('converts a serialized {seconds, nanoseconds} timestamp', () => {
    const seconds = 1_700_000_000;
    const result = toDate({ seconds, nanoseconds: 0 });
    expect(result.getTime()).toBe(seconds * 1000);
  });

  it('parses a numeric epoch value', () => {
    const ms = Date.UTC(2025, 0, 1);
    expect(toDate(ms).getTime()).toBe(ms);
  });

  it('falls back to a Date for null/undefined', () => {
    expect(toDate(null)).toBeInstanceOf(Date);
    expect(toDate(undefined)).toBeInstanceOf(Date);
  });
});

describe('getPeriodBoundaries', () => {
  it('returns the first-half period for an early-month date', () => {
    const result = getPeriodBoundaries(new Date(2025, 0, 10)); // Jan 10
    expect(result.periodNumber).toBe(1);
    expect(result.periodIdentifier).toBe('2025-01-01');
    expect(result.startDate.getDate()).toBe(1);
    expect(result.endDate.getDate()).toBe(14); // day before the 15th
    expect(result.endDate.getHours()).toBe(23);
  });

  it('returns the second-half period on the pay day itself (day 15)', () => {
    const result = getPeriodBoundaries(new Date(2025, 0, 15)); // Jan 15
    expect(result.periodNumber).toBe(15);
    expect(result.periodIdentifier).toBe('2025-01-15');
    expect(result.startDate.getDate()).toBe(15);
    expect(result.endDate.getDate()).toBe(31); // last day of January
  });

  it('uses the correct last day for a short month (February)', () => {
    const result = getPeriodBoundaries(new Date(2025, 1, 20)); // Feb 20, 2025
    expect(result.periodNumber).toBe(15);
    expect(result.endDate.getMonth()).toBe(1);
    expect(result.endDate.getDate()).toBe(28); // 2025 is not a leap year
  });

  it('handles leap-year February', () => {
    const result = getPeriodBoundaries(new Date(2024, 1, 20)); // Feb 20, 2024
    expect(result.endDate.getDate()).toBe(29);
  });
});

describe('getNextPeriodBoundaries', () => {
  it('advances from the first half into the second half of the same month', () => {
    const firstHalf = getPeriodBoundaries(new Date(2025, 0, 10));
    const next = getNextPeriodBoundaries(firstHalf.endDate);
    expect(next.periodNumber).toBe(15);
    expect(next.periodIdentifier).toBe('2025-01-15');
  });

  it('advances from the second half into the first half of the next month', () => {
    const secondHalf = getPeriodBoundaries(new Date(2025, 0, 20));
    const next = getNextPeriodBoundaries(secondHalf.endDate);
    expect(next.periodNumber).toBe(1);
    expect(next.periodIdentifier).toBe('2025-02-01');
  });
});

describe('areDatesInSameMonth', () => {
  it('is true for two dates in the same month and year', () => {
    expect(areDatesInSameMonth(new Date(2025, 3, 1), new Date(2025, 3, 30))).toBe(true);
  });

  it('is false across months', () => {
    expect(areDatesInSameMonth(new Date(2025, 3, 30), new Date(2025, 4, 1))).toBe(false);
  });

  it('is false for the same month number in different years', () => {
    expect(areDatesInSameMonth(new Date(2025, 3, 1), new Date(2026, 3, 1))).toBe(false);
  });
});

describe('isDateInCurrentMonth', () => {
  it('is true for today', () => {
    expect(isDateInCurrentMonth(new Date())).toBe(true);
  });

  it('is false for a date one year ago', () => {
    const lastYear = new Date();
    lastYear.setFullYear(lastYear.getFullYear() - 1);
    expect(isDateInCurrentMonth(lastYear)).toBe(false);
  });
});
