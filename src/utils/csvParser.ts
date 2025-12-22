// CSV Parser for Canadian Bank Statements
// Supports: TD, RBC, Amex, and Generic formats

export interface ParsedTransaction {
  date: Date;
  description: string;
  amount: number;
  type: 'expense' | 'income';
  originalRow: string[];
  excluded: boolean;
  excludeReason?: string;
}

export interface ParseResult {
  bank: 'TD' | 'RBC' | 'Amex' | 'Generic';
  transactions: ParsedTransaction[];
  errors: string[];
}

// Patterns to identify transfers and credit card payments
const TRANSFER_PATTERNS = [
  /transfer\s*(to|from|between)/i,
  /tfr\s*(to|from)/i,
  /e-?transfer/i,
  /interac\s*e-?transfer/i,
  /internal\s*transfer/i,
  /xfer/i,
  /moving\s*money/i,
];

const CC_PAYMENT_PATTERNS = [
  /payment\s*-?\s*thank\s*you/i,
  /payment\s*received/i,
  /cc\s*payment/i,
  /credit\s*card\s*payment/i,
  /online\s*payment/i,
  /payment\s*from\s*(chequing|savings|checking)/i,
  /pymt/i,
  /autopay/i,
  /pre-authorized\s*payment/i,
  /pmt\s*rcvd/i,
];

const INTERNAL_ACCOUNT_PATTERNS = [
  /^(to|from)\s*(chequing|savings|checking|tfsa|rrsp)/i,
  /account\s*transfer/i,
  /between\s*accounts/i,
];

function isTransfer(description: string): boolean {
  return TRANSFER_PATTERNS.some(pattern => pattern.test(description));
}

function isCCPayment(description: string): boolean {
  return CC_PAYMENT_PATTERNS.some(pattern => pattern.test(description));
}

function isInternalTransfer(description: string): boolean {
  return INTERNAL_ACCOUNT_PATTERNS.some(pattern => pattern.test(description));
}

function getExcludeReason(description: string): string | undefined {
  if (isTransfer(description)) return 'Transfer';
  if (isCCPayment(description)) return 'Credit Card Payment';
  if (isInternalTransfer(description)) return 'Internal Transfer';
  return undefined;
}

// Parse CSV string into rows
function parseCSVRows(content: string): string[][] {
  const rows: string[][] = [];
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim()) continue;

    const row: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current.trim());
    rows.push(row);
  }

  return rows;
}

// Parse date from various formats
function parseDate(dateStr: string): Date | null {
  const cleaned = dateStr.trim().replace(/['"]/g, '');

  // Try MM/DD/YYYY
  let match = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, month, day, year] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0);
  }

  // Try YYYY-MM-DD
  match = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const [, year, month, day] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0);
  }

  // Try DD/MM/YYYY
  match = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    // Ambiguous - assume MM/DD/YYYY for North American banks
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0);
  }

  // Try Month DD, YYYY (e.g., "Dec 15, 2025")
  match = cleaned.match(/^([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (match) {
    const [, monthStr, day, year] = match;
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    const month = months[monthStr.toLowerCase()];
    if (month !== undefined) {
      return new Date(parseInt(year), month, parseInt(day), 12, 0, 0);
    }
  }

  return null;
}

// Parse amount string to number
function parseAmount(amountStr: string): number {
  const cleaned = amountStr.trim().replace(/['"$,\s]/g, '');
  if (!cleaned || cleaned === '-') return 0;

  // Handle parentheses for negative numbers
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    return -Math.abs(parseFloat(cleaned.slice(1, -1)));
  }

  return parseFloat(cleaned) || 0;
}

// Detect bank format from header row
function detectBank(headers: string[]): 'TD' | 'RBC' | 'Amex' | 'Generic' {
  const headerStr = headers.join(',').toLowerCase();

  // TD format: typically has "Date", "Description", "Withdrawals", "Deposits", "Balance"
  if (headerStr.includes('withdrawals') && headerStr.includes('deposits')) {
    return 'TD';
  }

  // RBC format: has "Account Type", "Account Number", or "Description 1", "Description 2"
  if (headerStr.includes('account type') || headerStr.includes('description 1')) {
    return 'RBC';
  }

  // Amex format: simpler, typically "Date", "Description", "Amount" or "Card Member"
  if (headerStr.includes('card member') || (headerStr.includes('reference') && headerStr.includes('amount'))) {
    return 'Amex';
  }

  // Check for Amex by column count and structure
  if (headers.length >= 3 && headers.length <= 5) {
    const hasDate = headers.some(h => h.toLowerCase().includes('date'));
    const hasAmount = headers.some(h => h.toLowerCase().includes('amount'));
    if (hasDate && hasAmount) {
      return 'Amex';
    }
  }

  return 'Generic';
}

// Parse TD Bank CSV
function parseTD(rows: string[][], headers: string[]): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const headerLower = headers.map(h => h.toLowerCase());

  const dateIdx = headerLower.findIndex(h => h.includes('date'));
  const descIdx = headerLower.findIndex(h => h.includes('description'));
  const withdrawalIdx = headerLower.findIndex(h => h.includes('withdrawal'));
  const depositIdx = headerLower.findIndex(h => h.includes('deposit'));

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 3) continue;

    const dateStr = row[dateIdx] || row[0];
    const date = parseDate(dateStr);
    if (!date) continue;

    const description = row[descIdx] || row[1] || '';
    const withdrawal = parseAmount(row[withdrawalIdx] || row[2] || '');
    const deposit = parseAmount(row[depositIdx] || row[3] || '');

    const amount = withdrawal > 0 ? withdrawal : deposit;
    const type: 'expense' | 'income' = withdrawal > 0 ? 'expense' : 'income';

    if (amount === 0) continue;

    const excludeReason = getExcludeReason(description);

    transactions.push({
      date,
      description: description.trim(),
      amount: Math.abs(amount),
      type,
      originalRow: row,
      excluded: !!excludeReason,
      excludeReason,
    });
  }

  return transactions;
}

// Parse RBC CSV
function parseRBC(rows: string[][], headers: string[]): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const headerLower = headers.map(h => h.toLowerCase());

  // RBC has multiple formats
  const dateIdx = headerLower.findIndex(h => h.includes('date'));
  const desc1Idx = headerLower.findIndex(h => h === 'description 1' || h.includes('description'));
  const desc2Idx = headerLower.findIndex(h => h === 'description 2');
  const cadIdx = headerLower.findIndex(h => h.includes('cad'));
  const amountIdx = cadIdx >= 0 ? cadIdx : headerLower.findIndex(h => h.includes('amount'));

  // Check for withdrawal/deposit columns (alternative format)
  const withdrawalIdx = headerLower.findIndex(h => h.includes('withdrawal'));
  const depositIdx = headerLower.findIndex(h => h.includes('deposit'));

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 3) continue;

    const dateStr = row[dateIdx] || row[0];
    const date = parseDate(dateStr);
    if (!date) continue;

    let description = row[desc1Idx] || row[1] || '';
    if (desc2Idx >= 0 && row[desc2Idx]) {
      description += ' ' + row[desc2Idx];
    }

    let amount: number;
    let type: 'expense' | 'income';

    if (withdrawalIdx >= 0 && depositIdx >= 0) {
      // Separate withdrawal/deposit columns
      const withdrawal = parseAmount(row[withdrawalIdx] || '');
      const deposit = parseAmount(row[depositIdx] || '');
      amount = withdrawal > 0 ? withdrawal : deposit;
      type = withdrawal > 0 ? 'expense' : 'income';
    } else {
      // Single amount column (negative = expense)
      amount = parseAmount(row[amountIdx] || row[2] || '');
      type = amount < 0 ? 'expense' : 'income';
      amount = Math.abs(amount);
    }

    if (amount === 0) continue;

    const excludeReason = getExcludeReason(description);

    transactions.push({
      date,
      description: description.trim(),
      amount,
      type,
      originalRow: row,
      excluded: !!excludeReason,
      excludeReason,
    });
  }

  return transactions;
}

// Parse Amex CSV
function parseAmex(rows: string[][], headers: string[]): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const headerLower = headers.map(h => h.toLowerCase());

  const dateIdx = headerLower.findIndex(h => h.includes('date'));
  const descIdx = headerLower.findIndex(h => h.includes('description'));
  const amountIdx = headerLower.findIndex(h => h.includes('amount'));

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 3) continue;

    const dateStr = row[dateIdx] || row[0];
    const date = parseDate(dateStr);
    if (!date) continue;

    const description = row[descIdx] || row[1] || '';
    let amount = parseAmount(row[amountIdx] || row[2] || '');

    if (amount === 0) continue;

    // Amex: positive = charge (expense), negative = credit/payment (income)
    const type: 'expense' | 'income' = amount > 0 ? 'expense' : 'income';
    amount = Math.abs(amount);

    const excludeReason = getExcludeReason(description);

    transactions.push({
      date,
      description: description.trim(),
      amount,
      type,
      originalRow: row,
      excluded: !!excludeReason,
      excludeReason,
    });
  }

  return transactions;
}

// Parse Generic CSV
function parseGeneric(rows: string[][], headers: string[]): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const headerLower = headers.map(h => h.toLowerCase());

  // Try to find relevant columns
  const dateIdx = headerLower.findIndex(h => h.includes('date'));
  const descIdx = headerLower.findIndex(h =>
    h.includes('description') || h.includes('memo') || h.includes('payee')
  );
  const amountIdx = headerLower.findIndex(h => h.includes('amount'));
  const debitIdx = headerLower.findIndex(h =>
    h.includes('debit') || h.includes('withdrawal') || h.includes('out')
  );
  const creditIdx = headerLower.findIndex(h =>
    h.includes('credit') || h.includes('deposit') || h.includes('in')
  );

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 2) continue;

    const dateStr = row[dateIdx >= 0 ? dateIdx : 0];
    const date = parseDate(dateStr);
    if (!date) continue;

    const description = row[descIdx >= 0 ? descIdx : 1] || '';

    let amount: number;
    let type: 'expense' | 'income';

    if (debitIdx >= 0 && creditIdx >= 0) {
      const debit = parseAmount(row[debitIdx] || '');
      const credit = parseAmount(row[creditIdx] || '');
      amount = debit > 0 ? debit : credit;
      type = debit > 0 ? 'expense' : 'income';
    } else if (amountIdx >= 0) {
      amount = parseAmount(row[amountIdx]);
      type = amount < 0 ? 'expense' : 'income';
      amount = Math.abs(amount);
    } else {
      // Try to find any numeric column
      amount = 0;
      type = 'expense';
      for (let j = 0; j < row.length; j++) {
        const val = parseAmount(row[j]);
        if (val !== 0 && j !== dateIdx) {
          amount = Math.abs(val);
          type = val < 0 ? 'expense' : 'income';
          break;
        }
      }
    }

    if (amount === 0) continue;

    const excludeReason = getExcludeReason(description);

    transactions.push({
      date,
      description: description.trim(),
      amount,
      type,
      originalRow: row,
      excluded: !!excludeReason,
      excludeReason,
    });
  }

  return transactions;
}

// Main parse function
export function parseCSV(content: string): ParseResult {
  const errors: string[] = [];

  try {
    const rows = parseCSVRows(content);

    if (rows.length < 2) {
      return { bank: 'Generic', transactions: [], errors: ['CSV file is empty or has no data rows'] };
    }

    const headers = rows[0];
    const bank = detectBank(headers);

    let transactions: ParsedTransaction[];

    switch (bank) {
      case 'TD':
        transactions = parseTD(rows, headers);
        break;
      case 'RBC':
        transactions = parseRBC(rows, headers);
        break;
      case 'Amex':
        transactions = parseAmex(rows, headers);
        break;
      default:
        transactions = parseGeneric(rows, headers);
    }

    // Sort by date descending (newest first)
    transactions.sort((a, b) => b.date.getTime() - a.date.getTime());

    return { bank, transactions, errors };
  } catch (error) {
    return {
      bank: 'Generic',
      transactions: [],
      errors: [`Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

// Helper to read file as text
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
