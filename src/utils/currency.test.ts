import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatCompactCurrency,
  parseCurrencyInput,
  formatCurrencyInput,
} from './currency';

describe('formatCurrency', () => {
  it('formats a positive amount as USD with two decimals', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('formats negative amounts', () => {
    expect(formatCurrency(-42.1)).toBe('-$42.10');
  });

  it('always shows exactly two fraction digits', () => {
    expect(formatCurrency(5)).toBe('$5.00');
    expect(formatCurrency(5.1)).toBe('$5.10');
    expect(formatCurrency(5.129)).toBe('$5.13'); // rounds to 2dp
  });

  it('honours a different currency code', () => {
    // CAD renders with a currency-specific prefix; assert on the numeric part.
    expect(formatCurrency(10, 'CAD')).toContain('10.00');
  });
});

describe('formatCompactCurrency', () => {
  it('uses compact notation for values >= 1000', () => {
    expect(formatCompactCurrency(1500)).toBe('$1.5K');
    expect(formatCompactCurrency(2_000_000)).toBe('$2M');
  });

  it('falls back to full formatting below 1000', () => {
    expect(formatCompactCurrency(999.99)).toBe('$999.99');
    expect(formatCompactCurrency(0)).toBe('$0.00');
  });

  it('compacts large negative values by magnitude', () => {
    expect(formatCompactCurrency(-1500)).toBe('-$1.5K');
  });
});

describe('parseCurrencyInput', () => {
  it('parses a plain numeric string', () => {
    expect(parseCurrencyInput('42.50')).toBe(42.5);
  });

  it('strips currency symbols, commas and spaces', () => {
    expect(parseCurrencyInput('$1,234.56')).toBe(1234.56);
    expect(parseCurrencyInput('  $ 12.00 ')).toBe(12);
  });

  it('returns 0 for non-numeric input', () => {
    expect(parseCurrencyInput('abc')).toBe(0);
    expect(parseCurrencyInput('')).toBe(0);
  });

  it('preserves a leading negative sign', () => {
    expect(parseCurrencyInput('-$5.00')).toBe(-5);
  });
});

// Characterization tests: these pin down how the *current* parser handles
// malformed / hostile input. Several of these are surprising and are flagged in
// docs/V2_ASSESSMENT.md as parsing to tighten in V2 — a shared sanitizeAmount()
// (see features/paycheck/cycleSpendingMath.ts) should reject them instead.
describe('parseCurrencyInput — lenient parsing (documents current behavior)', () => {
  it('accepts a negative amount where a budget value should never be negative', () => {
    // A negative here silently *increases* a spending limit if used unguarded.
    expect(parseCurrencyInput('-50')).toBe(-50);
    expect(parseCurrencyInput('$-5.00')).toBe(-5);
  });

  it('truncates at the second decimal point instead of rejecting', () => {
    expect(parseCurrencyInput('1.2.3')).toBe(1.2);
    expect(parseCurrencyInput('10..5')).toBe(10);
  });

  it('truncates at an embedded minus sign', () => {
    expect(parseCurrencyInput('12-34')).toBe(12);
  });

  it('does NOT honour scientific notation (the "e" is stripped)', () => {
    expect(parseCurrencyInput('5e3')).toBe(53);
  });

  it('keeps sub-cent precision (no rounding to cents)', () => {
    expect(parseCurrencyInput('3.999')).toBe(3.999);
  });

  it('treats whitespace-only and lone punctuation as 0', () => {
    expect(parseCurrencyInput('   ')).toBe(0);
    expect(parseCurrencyInput('-')).toBe(0);
    expect(parseCurrencyInput('.')).toBe(0);
  });

  it('parses a leading decimal point', () => {
    expect(parseCurrencyInput('.5')).toBe(0.5);
  });
});

describe('formatCurrencyInput', () => {
  it('formats a number to a fixed two-decimal string', () => {
    expect(formatCurrencyInput(5)).toBe('5.00');
    expect(formatCurrencyInput(5.1)).toBe('5.10');
    expect(formatCurrencyInput(5.128)).toBe('5.13');
  });
});
