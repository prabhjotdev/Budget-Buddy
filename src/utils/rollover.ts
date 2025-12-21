import { BudgetPeriod } from '../types';
import { areDatesInSameMonth } from './date';

export const calculateRollover = (closingPeriod: BudgetPeriod): number => {
  const totalAvailable = closingPeriod.totalIncome + closingPeriod.rolloverIn;
  const unused = totalAvailable - closingPeriod.totalSpent;
  return Math.max(0, unused);
};

export const canApplyRollover = (
  closingPeriodEndDate: Date,
  nextPeriodStartDate: Date
): boolean => {
  return areDatesInSameMonth(closingPeriodEndDate, nextPeriodStartDate);
};

export interface BudgetSummary {
  totalIncome: number;
  rolloverIn: number;
  totalAvailable: number;
  totalAllocated: number;
  totalSpent: number;
  remainingUnallocated: number;
  remainingBudget: number;
  utilizationPercent: number;
  isOverBudget: boolean;
}

export const calculateBudgetSummary = (period: BudgetPeriod): BudgetSummary => {
  const totalAvailable = period.totalIncome + period.rolloverIn;
  const remainingUnallocated = totalAvailable - period.totalAllocated;
  const remainingBudget = totalAvailable - period.totalSpent;

  return {
    totalIncome: period.totalIncome,
    rolloverIn: period.rolloverIn,
    totalAvailable,
    totalAllocated: period.totalAllocated,
    totalSpent: period.totalSpent,
    remainingUnallocated,
    remainingBudget,
    utilizationPercent: totalAvailable > 0 ? (period.totalSpent / totalAvailable) * 100 : 0,
    isOverBudget: period.totalSpent > totalAvailable,
  };
};

export const calculateAllocationProgress = (
  budgetedAmount: number,
  spentAmount: number
): { percent: number; isOverBudget: boolean } => {
  const percent = budgetedAmount > 0 ? (spentAmount / budgetedAmount) * 100 : 0;
  return {
    percent: Math.min(percent, 100),
    isOverBudget: spentAmount > budgetedAmount,
  };
};
