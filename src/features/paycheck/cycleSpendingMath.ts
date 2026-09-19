import type { PaycheckCycle } from '../../types';

/**
 * Canonical money math for a paycheck cycle.
 *
 * Today this logic is duplicated inline inside StartCycleWizard, LogSpendingModal
 * and EditSpendingModal, and the copies have drifted apart (see docs/V2_ASSESSMENT.md
 * "Value-update correctness"). This module is the single, tested source of truth
 * those call sites should adopt.
 *
 * Invariants:
 *  - Discretionary spend is the ONLY thing that draws down the spending limit.
 *  - Variable-obligation spend (gas, groceries, …) is a separate pool: it adds
 *    to totalSpent but never changes remainingToSpend.
 *  - All stored money is rounded to whole cents so repeated additions do not drift
 *    (e.g. 0.1 + 0.2 = 0.30, not 0.30000000000000004).
 */

/** Round to whole cents, killing binary floating-point dust. */
export const roundCents = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Coerce a user-entered amount into a safe value: a non-negative, cents-rounded
 * number. NaN, Infinity, blanks and negatives all collapse to 0 so a bad input
 * can never silently corrupt a running total.
 */
export const sanitizeAmount = (value: number | string): number => {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (!Number.isFinite(n) || n <= 0) return 0;
  return roundCents(n);
};

export interface SpendingLimitInputs {
  paycheck: number;
  billsTotal: number;
  variableObligationsTotal: number;
  minimumSave: number;
  /** Extra spendable money pulled from the buffer to cover a shortfall. */
  bufferDraw?: number;
}

/**
 * spendingLimit = paycheck − bills − obligations − minimumSave (+ bufferDraw),
 * clamped at 0. Mirrors StartCycleWizard's derivation.
 */
export const computeSpendingLimit = (i: SpendingLimitInputs): number => {
  const raw =
    i.paycheck - i.billsTotal - i.variableObligationsTotal - i.minimumSave + (i.bufferDraw ?? 0);
  return Math.max(0, roundCents(raw));
};

type CycleTotals = Pick<
  PaycheckCycle,
  'spendingLimit' | 'totalSpent' | 'variableObligationsSpent'
>;

/** Discretionary spend = totalSpent − obligation spend. Draws down the limit. */
export const discretionarySpent = (c: CycleTotals): number =>
  roundCents((c.totalSpent ?? 0) - (c.variableObligationsSpent ?? 0));

/** Canonical remaining-to-spend: spendingLimit − discretionarySpent. May go negative (over budget). */
export const remainingToSpend = (c: CycleTotals): number =>
  roundCents(c.spendingLimit - discretionarySpent(c));

export interface SpendingUpdate {
  totalSpent: number;
  remainingToSpend: number;
}

/**
 * Apply a signed DISCRETIONARY change (`delta`) — positive when logging a spend,
 * negative when deleting or lowering one. This is what both the log and the edit
 * paths must use; deriving `remaining` from the full totalSpent (as EditSpendingModal
 * currently does) is wrong whenever the cycle also has obligation spend.
 */
export const applyDiscretionaryDelta = (c: CycleTotals, delta: number): SpendingUpdate => {
  const totalSpent = roundCents(c.totalSpent + delta);
  const newDiscretionary = roundCents(discretionarySpent(c) + delta);
  return {
    totalSpent,
    remainingToSpend: roundCents(c.spendingLimit - newDiscretionary),
  };
};

export interface ObligationUpdate {
  obligationAmountSpent: number;
  variableObligationsSpent: number;
  totalSpent: number;
}

/**
 * Apply a signed change to a variable-obligation's spend. Updates the obligation's
 * own tally, the cycle obligation total and totalSpent — but NOT remainingToSpend.
 */
export const applyObligationDelta = (
  c: CycleTotals,
  currentObligationSpent: number,
  delta: number
): ObligationUpdate => ({
  obligationAmountSpent: roundCents(currentObligationSpent + delta),
  variableObligationsSpent: roundCents((c.variableObligationsSpent ?? 0) + delta),
  totalSpent: roundCents(c.totalSpent + delta),
});
