import { describe, it, expect } from 'vitest';
import type { BudgetPeriod } from '../types';
import {
  calculateRollover,
  canApplyRollover,
  calculateBudgetSummary,
  calculateAllocationProgress,
} from './rollover';

// Build a BudgetPeriod that carries only the numeric fields these pure
// functions read. The date/Timestamp fields are irrelevant here, so we cast.
const makePeriod = (fields: Partial<BudgetPeriod>): BudgetPeriod =>
  ({
    totalIncome: 0,
    rolloverIn: 0,
    totalAllocated: 0,
    totalSpent: 0,
    ...fields,
  }) as BudgetPeriod;

describe('calculateRollover', () => {
  it('returns unused funds (income + rolloverIn - spent)', () => {
    const period = makePeriod({ totalIncome: 2000, rolloverIn: 100, totalSpent: 1500 });
    expect(calculateRollover(period)).toBe(600);
  });

  it('clamps to 0 when overspent', () => {
    const period = makePeriod({ totalIncome: 1000, rolloverIn: 0, totalSpent: 1200 });
    expect(calculateRollover(period)).toBe(0);
  });

  it('returns 0 when everything is spent exactly', () => {
    const period = makePeriod({ totalIncome: 1000, rolloverIn: 50, totalSpent: 1050 });
    expect(calculateRollover(period)).toBe(0);
  });
});

describe('canApplyRollover', () => {
  it('allows rollover when both dates are in the same month', () => {
    expect(canApplyRollover(new Date(2025, 0, 14), new Date(2025, 0, 15))).toBe(true);
  });

  it('rejects rollover across a month boundary', () => {
    expect(canApplyRollover(new Date(2025, 0, 31), new Date(2025, 1, 1))).toBe(false);
  });

  it('rejects rollover across a year boundary in the same month number', () => {
    // Jan 2025 vs Jan 2026 — same month index, different year.
    expect(canApplyRollover(new Date(2025, 0, 15), new Date(2026, 0, 1))).toBe(false);
  });
});

describe('calculateBudgetSummary', () => {
  it('computes available, remaining and utilization', () => {
    const summary = calculateBudgetSummary(
      makePeriod({
        totalIncome: 2000,
        rolloverIn: 200,
        totalAllocated: 1800,
        totalSpent: 1100,
      })
    );

    expect(summary.totalAvailable).toBe(2200);
    expect(summary.remainingUnallocated).toBe(400); // 2200 - 1800
    expect(summary.remainingBudget).toBe(1100); // 2200 - 1100
    expect(summary.utilizationPercent).toBeCloseTo(50); // 1100 / 2200
    expect(summary.isOverBudget).toBe(false);
  });

  it('flags over budget and negative remaining when spent exceeds available', () => {
    const summary = calculateBudgetSummary(
      makePeriod({ totalIncome: 1000, rolloverIn: 0, totalAllocated: 900, totalSpent: 1200 })
    );

    expect(summary.remainingBudget).toBe(-200);
    expect(summary.isOverBudget).toBe(true);
    expect(summary.utilizationPercent).toBeCloseTo(120);
  });

  it('avoids divide-by-zero when there is no available money', () => {
    const summary = calculateBudgetSummary(
      makePeriod({ totalIncome: 0, rolloverIn: 0, totalAllocated: 0, totalSpent: 0 })
    );
    expect(summary.utilizationPercent).toBe(0);
    expect(summary.isOverBudget).toBe(false);
  });
});

describe('calculateAllocationProgress', () => {
  it('computes percentage of budget spent', () => {
    expect(calculateAllocationProgress(200, 50)).toEqual({ percent: 25, isOverBudget: false });
  });

  it('caps the reported percent at 100 even when overspent', () => {
    const result = calculateAllocationProgress(100, 150);
    expect(result.percent).toBe(100);
    expect(result.isOverBudget).toBe(true);
  });

  it('returns 0 percent when the budgeted amount is 0', () => {
    expect(calculateAllocationProgress(0, 0)).toEqual({ percent: 0, isOverBudget: false });
  });

  it('treats any spend against a 0 budget as over budget', () => {
    const result = calculateAllocationProgress(0, 10);
    expect(result.percent).toBe(0);
    expect(result.isOverBudget).toBe(true);
  });
});
