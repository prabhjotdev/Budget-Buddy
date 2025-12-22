import { Timestamp } from 'firebase/firestore';

// User Settings
export interface UserSettings {
  payDays: [number, number];
  currency: string;
  timezone: string;
  defaultTemplateId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Category
export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Budget Template
export interface TemplateAllocation {
  categoryId: string;
  amount: number;
  note: string;
}

export interface BudgetTemplate {
  id: string;
  name: string;
  description: string;
  allocations: TemplateAllocation[];
  isDefault: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Budget Period
export interface IncomeEntry {
  sourceId: string;
  sourceName: string;
  amount: number;
}

export interface BudgetPeriod {
  id: string;
  startDate: Timestamp;
  endDate: Timestamp;
  status: 'active' | 'closed';
  totalIncome: number;
  incomeBreakdown: IncomeEntry[];
  rolloverIn: number;
  rolloverOut: number;
  totalAllocated: number;
  totalSpent: number;
  remainingBudget: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Budget Allocation
export interface BudgetAllocation {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  budgetedAmount: number;
  spentAmount: number;
  remainingAmount: number;
  note: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Transaction
export interface Transaction {
  id: string;
  budgetPeriodId: string;
  categoryId: string;
  categoryName: string;
  type: 'expense' | 'income';
  amount: number;
  description: string;
  date: Timestamp;
  recurringTransactionId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Income Source
export interface IncomeSource {
  id: string;
  name: string;
  defaultAmount: number;
  frequency: 'per-period' | 'monthly' | 'variable';
  assignToPeriod: 1 | 15 | 'both';
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Recurring Transaction
export interface RecurringTransaction {
  id: string;
  categoryId: string;
  categoryName: string;
  type: 'expense' | 'income';
  amount: number;
  description: string;
  frequency: 'per-period' | 'monthly';
  assignToPeriod: 1 | 15;
  dayOfMonth: number | null;
  isActive: boolean;
  lastGeneratedPeriodId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// User
export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
}
