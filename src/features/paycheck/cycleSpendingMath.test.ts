import { describe, it, expect } from 'vitest';
import {
  roundCents,
  sanitizeAmount,
  computeSpendingLimit,
  discretionarySpent,
  remainingToSpend,
  applyDiscretionaryDelta,
  applyObligationDelta,
} from './cycleSpendingMath';

describe('roundCents', () => {
  it('kills floating-point dust', () => {
    expect(roundCents(0.1 + 0.2)).toBe(0.3);
    expect(roundCents(10.1 * 3)).toBe(30.3);
    expect(roundCents(5)).toBe(5);
  });
});

describe('sanitizeAmount — bad inputs collapse to 0', () => {
  it('accepts valid positive numbers, rounded to cents', () => {
    expect(sanitizeAmount(12.5)).toBe(12.5);
    expect(sanitizeAmount('12.509')).toBe(12.51);
    expect(sanitizeAmount('$1,234.56')).toBe(0); // parseFloat stops at '$' -> NaN -> 0
    expect(sanitizeAmount('42')).toBe(42);
  });

  it('rejects negatives, zero, NaN, Infinity and blanks', () => {
    expect(sanitizeAmount(-5)).toBe(0);
    expect(sanitizeAmount('-5')).toBe(0);
    expect(sanitizeAmount(0)).toBe(0);
    expect(sanitizeAmount('')).toBe(0);
    expect(sanitizeAmount('abc')).toBe(0);
    expect(sanitizeAmount(NaN)).toBe(0);
    expect(sanitizeAmount(Infinity)).toBe(0);
  });
});

describe('computeSpendingLimit', () => {
  it('subtracts bills, obligations and savings from the paycheck', () => {
    expect(
      computeSpendingLimit({ paycheck: 2000, billsTotal: 800, variableObligationsTotal: 300, minimumSave: 100 })
    ).toBe(800);
  });

  it('adds a buffer draw', () => {
    expect(
      computeSpendingLimit({ paycheck: 1000, billsTotal: 900, variableObligationsTotal: 200, minimumSave: 0, bufferDraw: 250 })
    ).toBe(150);
  });

  it('never returns a negative limit', () => {
    expect(
      computeSpendingLimit({ paycheck: 500, billsTotal: 900, variableObligationsTotal: 0, minimumSave: 0 })
    ).toBe(0);
  });
});

describe('discretionarySpent / remainingToSpend', () => {
  const cycle = { spendingLimit: 500, totalSpent: 150, variableObligationsSpent: 50 };

  it('discretionary spend excludes obligation spend', () => {
    expect(discretionarySpent(cycle)).toBe(100);
  });

  it('remaining is the limit minus discretionary spend only', () => {
    expect(remainingToSpend(cycle)).toBe(400); // 500 - 100, NOT 500 - 150
  });

  it('remaining can go negative when over budget', () => {
    expect(remainingToSpend({ spendingLimit: 100, totalSpent: 130, variableObligationsSpent: 0 })).toBe(-30);
  });
});

describe('applyDiscretionaryDelta — logging and editing spends', () => {
  it('logging a discretionary spend lowers remaining by the amount', () => {
    const c = { spendingLimit: 500, totalSpent: 100, variableObligationsSpent: 0 };
    expect(applyDiscretionaryDelta(c, 40)).toEqual({ totalSpent: 140, remainingToSpend: 360 });
  });

  it('deleting a discretionary spend (negative delta) raises remaining', () => {
    const c = { spendingLimit: 500, totalSpent: 140, variableObligationsSpent: 0 };
    expect(applyDiscretionaryDelta(c, -40)).toEqual({ totalSpent: 100, remainingToSpend: 400 });
  });

  it('stays cent-exact across repeated $10.10 spends (no float drift)', () => {
    let c = { spendingLimit: 100, totalSpent: 0, variableObligationsSpent: 0 };
    for (let i = 0; i < 3; i++) {
      const u = applyDiscretionaryDelta(c, 10.1);
      c = { ...c, totalSpent: u.totalSpent };
    }
    expect(c.totalSpent).toBe(30.3);
    expect(remainingToSpend(c)).toBe(69.7);
  });

  it('editing a discretionary spend stays correct even when the cycle has obligation spend', () => {
    // Cycle: limit 500, discretionary 100, obligation 50 -> totalSpent 150, remaining 400.
    const c = { spendingLimit: 500, totalSpent: 150, variableObligationsSpent: 50 };

    // Raise a discretionary tx from $100 to $120 (delta +20) -> discretionary 120, remaining 380.
    const correct = applyDiscretionaryDelta(c, 20);
    expect(correct).toEqual({ totalSpent: 170, remainingToSpend: 380 });

    // The formula EditSpendingModal currently uses (spendingLimit - (totalSpent + delta))
    // ignores that obligation spend is a separate pool, so it under-reports remaining
    // by exactly the obligation total. This asserts the discrepancy the fix removes.
    const buggyRemaining = c.spendingLimit - (c.totalSpent + 20); // = 330
    expect(buggyRemaining).toBe(330);
    expect(buggyRemaining).not.toBe(correct.remainingToSpend);
    expect(correct.remainingToSpend - buggyRemaining).toBe(c.variableObligationsSpent);
  });
});

describe('applyObligationDelta — obligation spend is a separate pool', () => {
  it('updates obligation + totals but never remaining', () => {
    const c = { spendingLimit: 500, totalSpent: 100, variableObligationsSpent: 20 };
    const before = remainingToSpend(c);

    const u = applyObligationDelta(c, 20, 30); // this obligation had $20, add $30
    expect(u.obligationAmountSpent).toBe(50);
    expect(u.variableObligationsSpent).toBe(50);
    expect(u.totalSpent).toBe(130);

    // remaining is computed from discretionary only, so it is unchanged by obligation spend.
    const after = remainingToSpend({ ...c, totalSpent: u.totalSpent, variableObligationsSpent: u.variableObligationsSpent });
    expect(after).toBe(before);
  });
});
