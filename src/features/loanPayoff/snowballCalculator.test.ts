import { describe, it, expect } from 'vitest';
import { calculateSnowball, type LoanInput } from './snowballCalculator';

const loan = (over: Partial<LoanInput> & { id: string }): LoanInput => ({
  name: over.name ?? over.id,
  remainingBalance: 0,
  monthlyPayment: 0,
  interestRate: 0,
  ...over,
});

describe('calculateSnowball', () => {
  it('returns an all-zero result for no loans', () => {
    const result = calculateSnowball([], 100);
    expect(result.loanResults).toEqual([]);
    expect(result.originalTotalMonths).toBe(0);
    expect(result.snowballTotalMonths).toBe(0);
    expect(result.totalMonthsSaved).toBe(0);
    expect(result.totalInterestSaved).toBe(0);
  });

  it('pays off a zero-interest loan in balance / payment months with no extra', () => {
    const loans = [loan({ id: 'a', remainingBalance: 1200, monthlyPayment: 100 })];
    const result = calculateSnowball(loans, 0);

    expect(result.loanResults[0].originalPayoffMonths).toBe(12);
    expect(result.loanResults[0].snowballPayoffMonths).toBe(12);
    expect(result.loanResults[0].originalTotalInterest).toBe(0);
    expect(result.totalMonthsSaved).toBe(0);
  });

  it('an extra payment shortens a zero-interest loan payoff', () => {
    const loans = [loan({ id: 'a', remainingBalance: 1200, monthlyPayment: 100 })];
    // 100 min + 100 extra = 200/month -> 6 months.
    const result = calculateSnowball(loans, 100);

    expect(result.snowballTotalMonths).toBe(6);
    expect(result.originalTotalMonths).toBe(12);
    expect(result.totalMonthsSaved).toBe(6);
  });

  it('applies the snowball smallest-balance-first across multiple loans', () => {
    const loans = [
      loan({ id: 'big', remainingBalance: 1000, monthlyPayment: 100 }),
      loan({ id: 'small', remainingBalance: 500, monthlyPayment: 50 }),
    ];
    const result = calculateSnowball(loans, 50);

    const small = result.loanResults.find((r) => r.id === 'small')!;
    const big = result.loanResults.find((r) => r.id === 'big')!;

    // Smallest loan clears first (month 5), freeing its payment into the big one.
    expect(small.snowballPayoffMonths).toBe(5);
    expect(big.snowballPayoffMonths).toBe(8);

    // Independently, each takes 10 months on its own.
    expect(small.originalPayoffMonths).toBe(10);
    expect(big.originalPayoffMonths).toBe(10);

    expect(result.originalTotalMonths).toBe(10);
    expect(result.snowballTotalMonths).toBe(8);
    expect(result.totalMonthsSaved).toBe(2);
  });

  it('reduces total interest paid when interest is involved', () => {
    const loans = [
      loan({ id: 'card', remainingBalance: 3000, monthlyPayment: 150, interestRate: 18 }),
      loan({ id: 'car', remainingBalance: 8000, monthlyPayment: 250, interestRate: 6 }),
    ];
    const withExtra = calculateSnowball(loans, 300);

    expect(withExtra.snowballTotalInterest).toBeLessThan(withExtra.originalTotalInterest);
    expect(withExtra.totalInterestSaved).toBeGreaterThan(0);
    expect(withExtra.snowballTotalMonths).toBeLessThanOrEqual(withExtra.originalTotalMonths);
  });

  it('caps payoff at the safety limit when the payment cannot cover interest', () => {
    // 12% APR = 1%/mo on 1000 = $10 interest, but only $1 is paid -> never amortizes.
    const loans = [loan({ id: 'trap', remainingBalance: 1000, monthlyPayment: 1, interestRate: 12 })];
    const result = calculateSnowball(loans, 0);

    expect(result.loanResults[0].originalPayoffMonths).toBe(600); // MAX_MONTHS cap
    expect(result.loanResults[0].originalTotalInterest).toBe(Infinity);
  });
});
