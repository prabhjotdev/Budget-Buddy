import { Timestamp } from 'firebase/firestore';

// ============================================
// PAYCHECK-BASED BUDGETING SYSTEM MODELS
// ============================================

// --- User Settings for Paycheck System ---

export type PaycheckScheduleType = 'semi-monthly' | 'bi-weekly';

export interface PaycheckUserSettings {
  // Schedule type
  scheduleType: PaycheckScheduleType;

  // For semi-monthly: fixed dates (e.g., [1, 15])
  semiMonthlyDays?: [number, number];

  // For bi-weekly: anchor date to calculate from
  biWeeklyAnchorDate?: Timestamp;

  // Default minimum save per cycle
  defaultMinimumSave: number;

  // Currency
  currency: string;

  // Timezone
  timezone: string;

  // System mode: 'legacy' (old category-based) or 'paycheck' (new system)
  systemMode: 'legacy' | 'paycheck';

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// --- Payment Methods ---

export type PaymentMethodType = 'credit' | 'debit' | 'cash';

export interface PaymentMethod {
  id: string;
  name: string; // "Chase Sapphire", "Checking Debit", "Cash"
  type: PaymentMethodType;

  // For credit cards only
  currentBalance?: number; // What you currently owe
  statementDate?: number; // Day of month (1-31)
  dueDate?: number; // Day of month (1-31)

  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// --- Bills ---

export type BillFrequency = 'monthly' | 'quarterly' | 'semi-annual' | 'annual' | 'one-time';

export interface Bill {
  id: string;
  name: string; // "Rent", "Electric", "Car Insurance"
  amount: number; // Fixed or estimated amount
  isVariable: boolean; // If true, user confirms amount each cycle

  dueDay: number; // Day of month (1-31)
  frequency: BillFrequency;

  // Which payment method pays this bill
  paymentMethodId: string | null;

  // Is this on autopay? (for awareness)
  isAutoPay: boolean;

  isActive: boolean;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// --- Spending Tags ---

export interface SpendingTag {
  id: string;
  name: string; // "groceries", "gas", "food", etc.
  isCustom: boolean; // User-created vs predefined
  usageCount: number; // How often used (for sorting suggestions)

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// --- Paycheck Cycle ---

export type CycleStatus = 'upcoming' | 'active' | 'completed' | 'deficit';

export interface CycleBillEntry {
  billId: string;
  billName: string;
  amount: number; // Actual amount for this cycle (may differ from bill.amount if variable)
  dueDate: Timestamp;
  isPaid: boolean;
  isDeferred: boolean; // Pushed to next cycle
}

export interface PaycheckCycle {
  id: string;

  // Cycle dates
  startDate: Timestamp; // Paycheck date
  endDate: Timestamp; // Day before next paycheck

  // Income
  paycheckAmount: number; // User enters this each cycle

  // Bills reserved for this cycle
  bills: CycleBillEntry[];
  billsTotal: number; // Sum of bills

  // Savings
  minimumSave: number; // User-set for this cycle (can be $0)
  actualSaved: number; // What was actually saved

  // Spending
  spendingLimit: number; // paycheckAmount - billsTotal - minimumSave
  totalSpent: number; // Sum of spending transactions
  remainingToSpend: number; // spendingLimit - totalSpent

  // Buffer contribution (leftover at end)
  bufferContribution: number;

  // Status
  status: CycleStatus;

  // End of cycle reflection (optional)
  reflection?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// --- Spending Transaction ---

export interface SpendingTransaction {
  id: string;
  cycleId: string;

  amount: number;
  description: string; // Optional freeform note

  // Payment method used
  paymentMethodId: string;
  paymentMethodName: string; // Denormalized for display

  // Optional tags
  tagIds: string[];
  tagNames: string[]; // Denormalized for display

  // When it happened
  date: Timestamp;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// --- Buffer ---

export type BufferTransactionType = 'deposit' | 'withdrawal';

export interface BufferTransaction {
  id: string;
  type: BufferTransactionType;
  amount: number;
  reason: string; // Why was buffer used/added
  cycleId: string | null; // Which cycle this relates to

  createdAt: Timestamp;
}

export interface Buffer {
  totalAmount: number;
  updatedAt: Timestamp;
}

// --- Credit Card Balance Tracking (Awareness) ---

export interface CreditCardSnapshot {
  id: string;
  paymentMethodId: string;
  balance: number;
  asOfDate: Timestamp;
  cycleId: string; // Which cycle this was recorded in

  createdAt: Timestamp;
}

// ============================================
// HELPER TYPES
// ============================================

// For cycle creation wizard
export interface CycleSetupData {
  paycheckAmount: number;
  minimumSave: number;
  bills: {
    billId: string;
    amount: number; // Confirmed amount for variable bills
    isDeferred: boolean;
  }[];
}

// Computed cycle summary for display
export interface CycleSummary {
  paycheck: number;
  billsReserved: number;
  minimumSave: number;
  spendingLimit: number;
  spent: number;
  remaining: number;
  isDeficit: boolean;
  daysRemaining: number;
}
