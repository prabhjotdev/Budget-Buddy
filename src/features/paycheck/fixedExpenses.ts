import { PaycheckCycle } from '../../types';

/** Stable per-month key matching MonthData in SpendingLogsPage (year + 0-based month). */
export const monthKey = (year: number, monthIndex: number): string => `${year}-${monthIndex}`;

/**
 * Sum of fixed expenses ACTUALLY PAID per calendar month, across all supplied cycles.
 * For every cycle bill with isPaid === true, adds its `amount` to the month of its `dueDate`.
 * Buckets strictly by dueDate month (there is no paid-on date).
 * Returns a map keyed by monthKey(year, monthIndex) -> total paid amount for that month.
 * Months with no paid bills are simply absent from the map (callers treat missing as $0).
 * Deterministic: no dependency on the current date. NO dedupe (see RESOLVED DECISIONS #1).
 */
export function aggregatePaidFixedExpensesByMonth(
  cycles: PaycheckCycle[]
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const cycle of cycles) {
    for (const bill of cycle.bills) {
      if (bill.isPaid !== true) continue;
      const due = bill.dueDate.toDate();
      const key = monthKey(due.getFullYear(), due.getMonth());
      result[key] = (result[key] ?? 0) + bill.amount;
    }
  }
  return result;
}
