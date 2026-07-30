import { describe, it, expect } from 'vitest';
import type { Timestamp } from 'firebase/firestore';
import type { CycleBillEntry, PaycheckCycle } from '../../types';
import { monthKey, aggregatePaidFixedExpensesByMonth } from './fixedExpenses';

// Build a CycleBillEntry stubbing only the fields the pure function reads:
// `isPaid`, `amount`, `dueDate.toDate()`. Other fields are filled with
// harmless defaults, matching the stubbing style in rollover.test.ts /
// snowballCalculator.test.ts.
const bill = (over: { amount: number; isPaid?: boolean; due: Date; billId?: string }): CycleBillEntry =>
  ({
    billId: over.billId ?? 'b',
    billName: 'x',
    isDeferred: false,
    amount: over.amount,
    isPaid: over.isPaid,
    dueDate: { toDate: () => over.due } as unknown as Timestamp,
  }) as unknown as CycleBillEntry;

const cycle = (bills: CycleBillEntry[]): PaycheckCycle => ({ bills }) as unknown as PaycheckCycle;

describe('monthKey', () => {
  it('formats a plain month as "${year}-${monthIndex}"', () => {
    expect(monthKey(2025, 5)).toBe('2025-5');
  });

  it('formats December (monthIndex 11) correctly', () => {
    expect(monthKey(2025, 11)).toBe('2025-11');
  });

  it('produces different keys across a year boundary for the same month index', () => {
    const dec2025 = monthKey(2025, 11);
    const jan2026 = monthKey(2026, 0);
    expect(dec2025).not.toBe(jan2026);
    expect(dec2025).toBe('2025-11');
    expect(jan2026).toBe('2026-0');
  });
});

describe('aggregatePaidFixedExpensesByMonth', () => {
  it('returns an empty map for an empty cycles array', () => {
    expect(aggregatePaidFixedExpensesByMonth([])).toEqual({});
  });

  it('counts only bills with isPaid === true', () => {
    const cycles = [
      cycle([
        bill({ amount: 100, isPaid: true, due: new Date(2025, 3, 10) }),
        bill({ amount: 999, isPaid: false, due: new Date(2025, 3, 12) }),
      ]),
    ];

    const result = aggregatePaidFixedExpensesByMonth(cycles);
    expect(result).toEqual({ [monthKey(2025, 3)]: 100 });
  });

  it('skips bills where isPaid is undefined', () => {
    const cycles = [
      cycle([
        bill({ amount: 50, isPaid: true, due: new Date(2025, 2, 1) }),
        bill({ amount: 999, isPaid: undefined, due: new Date(2025, 2, 2) }),
      ]),
    ];

    const result = aggregatePaidFixedExpensesByMonth(cycles);
    expect(result).toEqual({ [monthKey(2025, 2)]: 50 });
  });

  it('sums multiple paid bills that fall in the same month', () => {
    const cycles = [
      cycle([
        bill({ amount: 40, isPaid: true, due: new Date(2025, 4, 1) }),
        bill({ amount: 60, isPaid: true, due: new Date(2025, 4, 28) }),
      ]),
    ];

    const result = aggregatePaidFixedExpensesByMonth(cycles);
    expect(result).toEqual({ [monthKey(2025, 4)]: 100 });
  });

  it('keys bills in different months separately', () => {
    const cycles = [
      cycle([
        bill({ amount: 30, isPaid: true, due: new Date(2025, 0, 5) }),
        bill({ amount: 70, isPaid: true, due: new Date(2025, 1, 5) }),
      ]),
    ];

    const result = aggregatePaidFixedExpensesByMonth(cycles);
    expect(result).toEqual({
      [monthKey(2025, 0)]: 30,
      [monthKey(2025, 1)]: 70,
    });
  });

  it('aggregates paid bills across multiple cycles into one map', () => {
    const cycles = [
      cycle([bill({ amount: 20, isPaid: true, due: new Date(2025, 6, 1), billId: 'a' })]),
      cycle([bill({ amount: 30, isPaid: true, due: new Date(2025, 6, 15), billId: 'b' })]),
      cycle([bill({ amount: 15, isPaid: true, due: new Date(2025, 7, 1), billId: 'c' })]),
    ];

    const result = aggregatePaidFixedExpensesByMonth(cycles);
    expect(result).toEqual({
      [monthKey(2025, 6)]: 50,
      [monthKey(2025, 7)]: 15,
    });
  });

  it('buckets December due dates and year-boundary due dates correctly', () => {
    const cycles = [
      cycle([
        bill({ amount: 100, isPaid: true, due: new Date(2025, 11, 31) }), // Dec 2025
        bill({ amount: 200, isPaid: true, due: new Date(2026, 0, 1) }), // Jan 2026
      ]),
    ];

    const result = aggregatePaidFixedExpensesByMonth(cycles);
    expect(result).toEqual({
      [monthKey(2025, 11)]: 100,
      [monthKey(2026, 0)]: 200,
    });
    // Sanity: December and January of the following year must not collide.
    expect(Object.keys(result)).toHaveLength(2);
  });

  it('DOES NOT dedupe: the same bill paid in two different cycles for the same due-month is counted twice (RESOLVED DECISION #1)', () => {
    const dueDate = new Date(2025, 5, 15);
    const cycles = [
      cycle([bill({ amount: 75, isPaid: true, due: dueDate, billId: 'rent' })]),
      cycle([bill({ amount: 75, isPaid: true, due: dueDate, billId: 'rent' })]),
    ];

    const result = aggregatePaidFixedExpensesByMonth(cycles);
    // Literal sum of both entries, NOT deduped by billId -> 150, not 75.
    expect(result).toEqual({ [monthKey(2025, 5)]: 150 });
  });

  it('does not round the aggregated totals (rounding is the caller/component responsibility)', () => {
    const cycles = [
      cycle([
        bill({ amount: 10.1, isPaid: true, due: new Date(2025, 8, 1) }),
        bill({ amount: 20.2, isPaid: true, due: new Date(2025, 8, 2) }),
      ]),
    ];

    const result = aggregatePaidFixedExpensesByMonth(cycles);
    // 10.1 + 20.2 in floating point is 30.299999999999997, not the rounded 30.3.
    const key = monthKey(2025, 8);
    expect(result[key]).toBeCloseTo(30.3, 10);
    expect(result[key]).not.toBe(30.3);
  });

  it('failure case: an unpaid-only cycle produces no entry for its month at all', () => {
    const cycles = [
      cycle([
        bill({ amount: 500, isPaid: false, due: new Date(2025, 9, 1) }),
        bill({ amount: 500, isPaid: false, due: new Date(2025, 9, 2) }),
      ]),
    ];

    const result = aggregatePaidFixedExpensesByMonth(cycles);
    expect(result).toEqual({});
    expect(result[monthKey(2025, 9)]).toBeUndefined();
  });
});
