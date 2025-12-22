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
function detectBank(headers: string[], rows: string[][]): 'TD' | 'RBC' | 'Amex' | 'Generic' {
  const headerStr = headers.join(',').toLowerCase();

  // TD EasyWeb export: first line is just "accountactivity" with no real headers
  // Data format: Date, Description, Debit, Credit, Balance
  if (headerStr === 'accountactivity' || headerStr.startsWith('accountactivity,')) {
    return 'TD';
  }

  // TD format variations with proper headers:
  // "Date,Description,Withdrawals,Deposits,Balance"
  // "Date,Transaction Description,Debit Amount,Credit Amount,Balance"
  // "Date,Description,Debit,Credit,Balance"
  if (
    (headerStr.includes('withdrawal') && headerStr.includes('deposit')) ||
    (headerStr.includes('debit') && headerStr.includes('credit')) ||
    (headerStr.includes('date') && headerStr.includes('description') && headerStr.includes('balance'))
  ) {
    return 'TD';
  }

  // RBC format: has "Account Type", "Account Number", or "Description 1", "Description 2"
  if (headerStr.includes('account type') || headerStr.includes('description 1')) {
    return 'RBC';
  }

  // Amex format: "Date", "Description", "Amount" or "Card Member", "Reference"
  if (headerStr.includes('card member') || headerStr.includes('reference')) {
    return 'Amex';
  }

  return 'Generic';
}

// Parse TD Bank CSV
function parseTD(rows: string[][], headers: string[]): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const headerLower = headers.map(h => h.toLowerCase());
  const headerStr = headerLower.join(',');

  // Check if this is the "accountactivity" format (no real headers)
  // Format: Date, Description, Debit, Credit, Balance
  const isAccountActivityFormat = headerStr === 'accountactivity' || headerStr.startsWith('accountactivity,');

  let dateIdx: number;
  let descIdx: number;
  let debitIdx: number;
  let creditIdx: number;
  let startRow: number;

  if (isAccountActivityFormat) {
    // TD EasyWeb "accountactivity" export - fixed column positions, no header row
    // Row 0 is "accountactivity", data starts at row 1
    dateIdx = 0;
    descIdx = 1;
    debitIdx = 2;
    creditIdx = 3;
    startRow = 1;
  } else {
    // Standard header-based parsing
    dateIdx = headerLower.findIndex(h => h.includes('date'));
    descIdx = headerLower.findIndex(h => h.includes('description'));
    debitIdx = headerLower.findIndex(h => h.includes('withdrawal'));
    creditIdx = headerLower.findIndex(h => h.includes('deposit'));

    // Try alternate names
    if (debitIdx < 0) {
      debitIdx = headerLower.findIndex(h => h.includes('debit'));
    }
    if (creditIdx < 0) {
      creditIdx = headerLower.findIndex(h => h.includes('credit'));
    }
    startRow = 1;
  }

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 3) continue;

    const dateStr = row[dateIdx >= 0 ? dateIdx : 0];
    const date = parseDate(dateStr);
    if (!date) continue;

    const description = row[descIdx >= 0 ? descIdx : 1] || '';

    // Get debit and credit values
    const debit = debitIdx >= 0 ? parseAmount(row[debitIdx] || '') : 0;
    const credit = creditIdx >= 0 ? parseAmount(row[creditIdx] || '') : 0;

    // Determine amount and type
    let amount: number;
    let type: 'expense' | 'income';

    if (debit > 0) {
      amount = debit;
      type = 'expense';
    } else if (credit > 0) {
      amount = credit;
      type = 'income';
    } else {
      // Fallback: try to find any numeric value in remaining columns
      amount = 0;
      type = 'expense';
      for (let j = 2; j < row.length - 1; j++) { // Skip last column (balance)
        if (j === debitIdx || j === creditIdx) continue;
        const val = parseAmount(row[j]);
        if (val !== 0) {
          amount = Math.abs(val);
          type = 'expense'; // Default to expense for unknown columns
          break;
        }
      }
    }

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
    const bank = detectBank(headers, rows);

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
