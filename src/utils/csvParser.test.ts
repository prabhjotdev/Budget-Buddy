import { describe, it, expect } from 'vitest';
import { parseCSV } from './csvParser';

describe('parseCSV — error handling', () => {
  it('reports an error for an empty file', () => {
    const result = parseCSV('');
    expect(result.transactions).toEqual([]);
    expect(result.errors).toContain('CSV file is empty or has no data rows');
  });

  it('reports an error when only a header row is present', () => {
    const result = parseCSV('Date,Description,Amount');
    expect(result.transactions).toEqual([]);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('parseCSV — bank detection', () => {
  it('detects a TD statement from withdrawal/deposit headers', () => {
    const csv = [
      'Date,Description,Withdrawals,Deposits,Balance',
      '2025-01-10,ATM Cash,60.00,,1000.00',
      '2025-01-11,Paycheque,,2000.00,3000.00',
    ].join('\n');

    const result = parseCSV(csv);
    expect(result.bank).toBe('TD');
    expect(result.transactions).toHaveLength(2);
  });

  it('detects an RBC statement from "Description 1"', () => {
    const csv = [
      'Account Type,Date,Description 1,Description 2,CAD$',
      'Chequing,01/10/2025,PURCHASE,STORE,-25.00',
    ].join('\n');

    const result = parseCSV(csv);
    expect(result.bank).toBe('RBC');
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].amount).toBe(25);
  });

  it('falls back to Generic for an unrecognized header', () => {
    const csv = ['Date,Memo,Amount', '2025-01-10,Coffee,4.50'].join('\n');
    const result = parseCSV(csv);
    expect(result.bank).toBe('Generic');
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].description).toBe('Coffee');
    expect(result.transactions[0].amount).toBe(4.5);
  });
});

describe('parseCSV — amount parsing', () => {
  it('strips currency symbols and thousands separators', () => {
    const csv = ['Date,Description,Amount', '2025-01-10,Big Buy,"$1,234.56"'].join('\n');
    const result = parseCSV(csv);
    expect(result.transactions[0].amount).toBeCloseTo(1234.56);
  });

  it('treats parenthesized amounts as a magnitude', () => {
    const csv = ['Date,Description,Amount', '2025-01-10,Reversal,(50.00)'].join('\n');
    const result = parseCSV(csv);
    expect(result.transactions[0].amount).toBe(50);
  });

  it('skips rows whose amount is zero', () => {
    const csv = [
      'Date,Description,Amount',
      '2025-01-10,Zero Row,0.00',
      '2025-01-11,Real Row,10.00',
    ].join('\n');
    const result = parseCSV(csv);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].description).toBe('Real Row');
  });
});

describe('parseCSV — transfer / payment exclusions', () => {
  it('flags e-transfers and credit-card payments as excluded', () => {
    const csv = [
      'Date,Description,Amount',
      '2025-01-10,E-Transfer to John,100.00',
      '2025-01-11,PAYMENT - THANK YOU,200.00',
      '2025-01-12,Coffee Shop,5.00',
    ].join('\n');

    const result = parseCSV(csv);
    const byDesc = Object.fromEntries(result.transactions.map((t) => [t.description, t]));

    expect(byDesc['E-Transfer to John'].excluded).toBe(true);
    expect(byDesc['E-Transfer to John'].excludeReason).toBe('Transfer');
    expect(byDesc['PAYMENT - THANK YOU'].excluded).toBe(true);
    expect(byDesc['PAYMENT - THANK YOU'].excludeReason).toBe('Credit Card Payment');
    expect(byDesc['Coffee Shop'].excluded).toBe(false);
  });
});

describe('parseCSV — dates', () => {
  it('parses multiple date formats and sorts newest first', () => {
    const csv = [
      'Date,Description,Amount',
      '01/05/2025,Oldest,10.00',
      '2025-03-15,Newest,30.00',
      '"Feb 10, 2025",Middle,20.00',
    ].join('\n');

    const result = parseCSV(csv);
    expect(result.transactions.map((t) => t.description)).toEqual([
      'Newest',
      'Middle',
      'Oldest',
    ]);
  });

  it('interprets ambiguous slash dates as MM/DD/YYYY (North American convention)', () => {
    const csv = ['Date,Description,Amount', '03/04/2025,Slash Date,10.00'].join('\n');
    const { date } = parseCSV(csv).transactions[0];
    expect(date.getMonth()).toBe(2); // March (0-indexed) — month-first, not day-first
    expect(date.getDate()).toBe(4);
  });
});
