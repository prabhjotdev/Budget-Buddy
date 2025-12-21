# Budget Buddy - Architecture Document

## Overview

A bi-weekly budget management application built with React, Redux, and Firebase. Users manage budgets based on pay periods (1st and 15th of each month), with support for multiple income sources, customizable categories, and rollover logic within the same month.

---

## 1. Firestore Database Schema

### Collection Structure

```
users/{userId}
├── settings (document)
├── categories/{categoryId}
├── templates/{templateId}
├── budgetPeriods/{periodId}
│   └── allocations/{allocationId}
├── transactions/{transactionId}
├── incomeSources/{incomeId}
└── recurringTransactions/{recurringId}
```

### Document Schemas

#### `users/{userId}/settings`

```typescript
interface UserSettings {
  payDays: [number, number];        // Default: [1, 15]
  currency: string;                  // Default: "USD"
  defaultTemplateId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### `users/{userId}/categories/{categoryId}`

```typescript
interface Category {
  id: string;
  name: string;
  icon: string;                      // Icon identifier
  color: string;                     // Hex color
  parentId: string | null;           // null = top-level category
  sortOrder: number;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### `users/{userId}/templates/{templateId}`

```typescript
interface BudgetTemplate {
  id: string;
  name: string;
  description: string;
  allocations: TemplateAllocation[];
  isDefault: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface TemplateAllocation {
  categoryId: string;
  amount: number;
  note: string;
}
```

#### `users/{userId}/budgetPeriods/{periodId}`

```typescript
interface BudgetPeriod {
  id: string;                        // Format: "YYYY-MM-PP" (PP = 01 or 15)
  startDate: Timestamp;
  endDate: Timestamp;
  status: 'active' | 'closed';

  // Income
  totalIncome: number;               // Sum of all income for this period
  incomeBreakdown: IncomeEntry[];

  // Rollover
  rolloverIn: number;                // Amount rolled in from previous period
  rolloverOut: number;               // Calculated when period closes

  // Computed (denormalized for quick reads)
  totalAllocated: number;
  totalSpent: number;
  remainingBudget: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface IncomeEntry {
  sourceId: string;
  sourceName: string;                // Denormalized for display
  amount: number;
}
```

#### `users/{userId}/budgetPeriods/{periodId}/allocations/{allocationId}`

```typescript
interface BudgetAllocation {
  id: string;
  categoryId: string;
  categoryName: string;              // Denormalized
  categoryColor: string;             // Denormalized
  budgetedAmount: number;
  spentAmount: number;               // Updated via Cloud Function or client
  remainingAmount: number;           // budgetedAmount - spentAmount
  note: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### `users/{userId}/transactions/{transactionId}`

```typescript
interface Transaction {
  id: string;
  budgetPeriodId: string;
  categoryId: string;
  categoryName: string;              // Denormalized

  type: 'expense' | 'income';
  amount: number;
  description: string;
  date: Timestamp;

  // Recurring transaction reference
  recurringTransactionId: string | null;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### `users/{userId}/incomeSources/{incomeId}`

```typescript
interface IncomeSource {
  id: string;
  name: string;                      // e.g., "Primary Job", "Freelance"
  defaultAmount: number;             // Net income default
  frequency: 'per-period' | 'monthly' | 'variable';
  assignToPeriod: 1 | 15 | 'both';   // Which pay period(s) to auto-assign
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### `users/{userId}/recurringTransactions/{recurringId}`

```typescript
interface RecurringTransaction {
  id: string;
  categoryId: string;
  categoryName: string;              // Denormalized

  type: 'expense' | 'income';
  amount: number;
  description: string;

  // Scheduling
  frequency: 'per-period' | 'monthly';
  assignToPeriod: 1 | 15;            // Which period to assign (for monthly bills)
  dayOfMonth: number | null;         // Optional: specific day for monthly

  isActive: boolean;
  lastGeneratedPeriodId: string | null;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Firestore Indexes

```javascript
// Required composite indexes

// Transactions by period and date
{ collectionGroup: "transactions", fields: ["budgetPeriodId", "date"] }

// Transactions by category
{ collectionGroup: "transactions", fields: ["categoryId", "date"] }

// Budget periods by status and date
{ collection: "budgetPeriods", fields: ["status", "startDate"] }

// Categories by parent (for hierarchy)
{ collection: "categories", fields: ["parentId", "sortOrder"] }
```

---

## 2. Redux State Structure

```typescript
interface RootState {
  auth: AuthState;
  settings: SettingsState;
  categories: CategoriesState;
  templates: TemplatesState;
  budgetPeriods: BudgetPeriodsState;
  transactions: TransactionsState;
  incomeSources: IncomeSourcesState;
  recurringTransactions: RecurringTransactionsState;
  ui: UIState;
}

// ─────────────────────────────────────────────────────────────
// Auth State
// ─────────────────────────────────────────────────────────────
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
}

// ─────────────────────────────────────────────────────────────
// Settings State
// ─────────────────────────────────────────────────────────────
interface SettingsState {
  data: UserSettings | null;
  isLoading: boolean;
  error: string | null;
}

// ─────────────────────────────────────────────────────────────
// Categories State (Normalized)
// ─────────────────────────────────────────────────────────────
interface CategoriesState {
  byId: Record<string, Category>;
  allIds: string[];
  rootIds: string[];                 // Top-level category IDs
  childrenByParentId: Record<string, string[]>;
  isLoading: boolean;
  error: string | null;
}

// ─────────────────────────────────────────────────────────────
// Templates State
// ─────────────────────────────────────────────────────────────
interface TemplatesState {
  byId: Record<string, BudgetTemplate>;
  allIds: string[];
  isLoading: boolean;
  error: string | null;
}

// ─────────────────────────────────────────────────────────────
// Budget Periods State
// ─────────────────────────────────────────────────────────────
interface BudgetPeriodsState {
  byId: Record<string, BudgetPeriod>;
  allIds: string[];
  activePeriodId: string | null;

  // Allocations nested by period
  allocationsByPeriodId: Record<string, {
    byId: Record<string, BudgetAllocation>;
    allIds: string[];
  }>;

  isLoading: boolean;
  error: string | null;
}

// ─────────────────────────────────────────────────────────────
// Transactions State
// ─────────────────────────────────────────────────────────────
interface TransactionsState {
  byId: Record<string, Transaction>;
  allIds: string[];

  // Grouped references for quick lookups
  idsByPeriod: Record<string, string[]>;
  idsByCategory: Record<string, string[]>;

  // Pagination
  hasMore: boolean;
  lastDoc: DocumentSnapshot | null;

  isLoading: boolean;
  error: string | null;
}

// ─────────────────────────────────────────────────────────────
// Income Sources State
// ─────────────────────────────────────────────────────────────
interface IncomeSourcesState {
  byId: Record<string, IncomeSource>;
  allIds: string[];
  isLoading: boolean;
  error: string | null;
}

// ─────────────────────────────────────────────────────────────
// Recurring Transactions State
// ─────────────────────────────────────────────────────────────
interface RecurringTransactionsState {
  byId: Record<string, RecurringTransaction>;
  allIds: string[];
  isLoading: boolean;
  error: string | null;
}

// ─────────────────────────────────────────────────────────────
// UI State
// ─────────────────────────────────────────────────────────────
interface UIState {
  // Modal states
  modals: {
    createBudgetPeriod: boolean;
    addTransaction: boolean;
    editCategory: boolean;
    selectTemplate: boolean;
  };

  // Current selections
  selectedPeriodId: string | null;
  selectedCategoryId: string | null;

  // Filters
  transactionFilters: {
    periodId: string | null;
    categoryId: string | null;
    type: 'all' | 'expense' | 'income';
    dateRange: { start: Date | null; end: Date | null };
  };

  // Notifications
  notifications: Notification[];

  // Theme
  theme: 'light' | 'dark' | 'system';
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration: number;
}
```

### Redux Toolkit Slice Structure

```typescript
// Slices
/store
  /slices
    authSlice.ts
    settingsSlice.ts
    categoriesSlice.ts
    templatesSlice.ts
    budgetPeriodsSlice.ts
    transactionsSlice.ts
    incomeSourcesSlice.ts
    recurringTransactionsSlice.ts
    uiSlice.ts
  /selectors
    categorySelectors.ts      // Memoized selectors with reselect
    budgetSelectors.ts
    transactionSelectors.ts
  store.ts
  hooks.ts                    // Typed useAppSelector, useAppDispatch
```

---

## 3. Component Hierarchy

```
App
├── AuthProvider
│   └── FirebaseAuthGate
│
├── Router
│   ├── PublicRoutes
│   │   └── LoginPage
│   │       └── GoogleLoginButton
│   │
│   └── ProtectedRoutes
│       ├── AppLayout
│       │   ├── Sidebar
│       │   │   ├── Logo
│       │   │   ├── NavLinks
│       │   │   ├── ActivePeriodCard
│       │   │   └── UserMenu
│       │   │
│       │   ├── Header
│       │   │   ├── PageTitle
│       │   │   ├── PeriodSelector
│       │   │   └── QuickActions
│       │   │
│       │   └── MainContent
│       │       └── <Page Routes>
│       │
│       ├── DashboardPage
│       │   ├── PeriodSummaryCard
│       │   │   ├── IncomeDisplay
│       │   │   ├── SpendingProgress
│       │   │   └── RolloverBadge
│       │   ├── CategoryBreakdownChart
│       │   ├── RecentTransactionsList
│       │   ├── BudgetAllocationGrid
│       │   │   └── AllocationCard
│       │   │       ├── CategoryIcon
│       │   │       ├── ProgressBar
│       │   │       └── QuickAddTransaction
│       │   └── UpcomingRecurringList
│       │
│       ├── BudgetHistoryPage
│       │   ├── PeriodFilters
│       │   ├── PeriodList
│       │   │   └── PeriodHistoryCard
│       │   │       ├── PeriodDateRange
│       │   │       ├── SummaryStats
│       │   │       └── ExpandedDetails
│       │   └── ComparisonChart
│       │
│       ├── TemplatesPage
│       │   ├── TemplateList
│       │   │   └── TemplateCard
│       │   │       ├── TemplateHeader
│       │   │       ├── AllocationPreview
│       │   │       └── TemplateActions
│       │   └── TemplateEditor
│       │       ├── TemplateNameInput
│       │       ├── AllocationBuilder
│       │       │   └── AllocationRow
│       │       │       ├── CategoryPicker
│       │       │       ├── AmountInput
│       │       │       └── DeleteButton
│       │       └── SaveTemplateButton
│       │
│       ├── TransactionsPage
│       │   ├── TransactionFilters
│       │   │   ├── PeriodFilter
│       │   │   ├── CategoryFilter
│       │   │   ├── TypeToggle
│       │   │   └── DateRangePicker
│       │   ├── TransactionList
│       │   │   └── TransactionRow
│       │   │       ├── TransactionIcon
│       │   │       ├── TransactionDetails
│       │   │       ├── AmountDisplay
│       │   │       └── TransactionActions
│       │   ├── TransactionPagination
│       │   └── AddTransactionFAB
│       │
│       ├── IncomePage
│       │   ├── IncomeSourcesList
│       │   │   └── IncomeSourceCard
│       │   │       ├── SourceName
│       │   │       ├── DefaultAmount
│       │   │       ├── FrequencyBadge
│       │   │       └── SourceActions
│       │   ├── AddIncomeSourceForm
│       │   └── PeriodIncomeEditor
│       │       └── IncomeEntryRow
│       │
│       └── SettingsPage
│           ├── PayDaysSettings
│           ├── CurrencySettings
│           ├── CategoryManager
│           │   ├── CategoryTree
│           │   │   └── CategoryNode
│           │   │       ├── CategoryDisplay
│           │   │       ├── SubCategoryList
│           │   │       └── CategoryActions
│           │   └── CategoryForm
│           │       ├── NameInput
│           │       ├── IconPicker
│           │       ├── ColorPicker
│           │       └── ParentCategorySelect
│           ├── DefaultTemplateSelect
│           ├── DataExport
│           └── AccountSettings
│
└── Modals (Portal-based)
    ├── CreateBudgetPeriodModal
    │   ├── PeriodDatePicker
    │   ├── TemplateSelector
    │   ├── IncomeInputSection
    │   │   └── IncomeSourceRow
    │   ├── RolloverPreview
    │   └── CreateButton
    │
    ├── AddTransactionModal
    │   ├── TransactionTypeToggle
    │   ├── AmountInput
    │   ├── CategoryPicker
    │   │   └── CategoryTreeSelect
    │   ├── DescriptionInput
    │   ├── DatePicker
    │   └── SaveButton
    │
    ├── EditCategoryModal
    │   └── CategoryForm
    │
    ├── ConfirmationModal
    │   ├── ConfirmMessage
    │   └── ActionButtons
    │
    └── NotificationToast
```

### Shared/Reusable Components

```
/components/shared
├── Button
├── Input
├── Select
├── Modal
├── Card
├── Badge
├── ProgressBar
├── Spinner
├── EmptyState
├── ErrorBoundary
├── IconPicker
├── ColorPicker
├── DatePicker
├── CurrencyInput
├── Tooltip
├── Dropdown
├── Tabs
├── Table
└── Chart (wrapper around chart library)
```

---

## 4. Rollover Calculation Logic

### Rules

1. **Rollover is income-based, not category-based**
2. **Rollover only occurs within the same calendar month**
3. **Only unused income rolls forward**

### Calculation Flow

```typescript
/**
 * Calculate rollover when closing a budget period
 */
function calculateRollover(closingPeriod: BudgetPeriod): number {
  const totalAvailable = closingPeriod.totalIncome + closingPeriod.rolloverIn;
  const totalSpent = closingPeriod.totalSpent;
  const unused = totalAvailable - totalSpent;

  return Math.max(0, unused); // Never negative rollover
}

/**
 * Determine if rollover can be applied to next period
 */
function canApplyRollover(
  closingPeriod: BudgetPeriod,
  nextPeriod: BudgetPeriod
): boolean {
  const closingMonth = closingPeriod.startDate.toDate().getMonth();
  const nextMonth = nextPeriod.startDate.toDate().getMonth();

  // Only rollover within the same month
  // Period 1 (1st-14th) can roll into Period 2 (15th-end)
  // Period 2 cannot roll into next month's Period 1
  return closingMonth === nextMonth;
}

/**
 * Full rollover workflow when creating a new period
 */
async function applyRolloverToNewPeriod(
  userId: string,
  newPeriod: BudgetPeriod
): Promise<number> {
  const previousPeriod = await getPreviousPeriod(userId, newPeriod.startDate);

  if (!previousPeriod || previousPeriod.status !== 'closed') {
    return 0;
  }

  if (!canApplyRollover(previousPeriod, newPeriod)) {
    return 0; // Cross-month boundary, no rollover
  }

  const rolloverAmount = calculateRollover(previousPeriod);

  // Update the previous period with rolloverOut
  await updateBudgetPeriod(userId, previousPeriod.id, {
    rolloverOut: rolloverAmount
  });

  return rolloverAmount;
}
```

### Period Date Logic

```typescript
/**
 * Determine period boundaries based on pay days
 */
function getPeriodBoundaries(
  date: Date,
  payDays: [number, number] = [1, 15]
): { startDate: Date; endDate: Date; periodIdentifier: string } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const [firstPayDay, secondPayDay] = payDays;

  const dayOfMonth = date.getDate();

  if (dayOfMonth < secondPayDay) {
    // First period of the month
    const startDate = new Date(year, month, firstPayDay);
    const endDate = new Date(year, month, secondPayDay - 1);
    endDate.setHours(23, 59, 59, 999);

    return {
      startDate,
      endDate,
      periodIdentifier: `${year}-${String(month + 1).padStart(2, '0')}-01`
    };
  } else {
    // Second period of the month
    const startDate = new Date(year, month, secondPayDay);
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const endDate = new Date(year, month, lastDayOfMonth);
    endDate.setHours(23, 59, 59, 999);

    return {
      startDate,
      endDate,
      periodIdentifier: `${year}-${String(month + 1).padStart(2, '0')}-15`
    };
  }
}

/**
 * Rollover decision matrix
 *
 * | Closing Period | Next Period | Same Month? | Rollover? |
 * |----------------|-------------|-------------|-----------|
 * | Jan 1-14       | Jan 15-31   | Yes         | Yes       |
 * | Jan 15-31      | Feb 1-14    | No          | No        |
 * | Feb 1-14       | Feb 15-28   | Yes         | Yes       |
 * | Feb 15-28      | Mar 1-14    | No          | No        |
 */
```

### Rollover Display Logic

```typescript
/**
 * Calculate display values for the dashboard
 */
function calculateBudgetSummary(period: BudgetPeriod): BudgetSummary {
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
    utilizationPercent: (period.totalSpent / totalAvailable) * 100,
    isOverBudget: period.totalSpent > totalAvailable
  };
}
```

---

## 5. API / Data Access Patterns

### Service Layer Structure

```typescript
// /services/firebase/
├── config.ts           // Firebase initialization
├── auth.ts             // Authentication methods
├── users.ts            // User profile operations
├── settings.ts         // Settings CRUD
├── categories.ts       // Category CRUD
├── templates.ts        // Template CRUD
├── budgetPeriods.ts    // Period + allocation CRUD
├── transactions.ts     // Transaction CRUD
├── incomeSources.ts    // Income source CRUD
├── recurringTransactions.ts
└── index.ts            // Unified export
```

### Data Access Patterns

#### Pattern 1: Real-time Subscriptions (Dashboard, Active Period)

```typescript
// Subscribe to active budget period with allocations
export function subscribeToActivePeriod(
  userId: string,
  onData: (period: BudgetPeriod, allocations: BudgetAllocation[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const periodsRef = collection(db, `users/${userId}/budgetPeriods`);
  const activeQuery = query(
    periodsRef,
    where('status', '==', 'active'),
    limit(1)
  );

  return onSnapshot(activeQuery, async (snapshot) => {
    if (snapshot.empty) {
      onData(null, []);
      return;
    }

    const periodDoc = snapshot.docs[0];
    const period = { id: periodDoc.id, ...periodDoc.data() } as BudgetPeriod;

    // Fetch allocations
    const allocationsRef = collection(
      db,
      `users/${userId}/budgetPeriods/${period.id}/allocations`
    );
    const allocationsSnap = await getDocs(allocationsRef);
    const allocations = allocationsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as BudgetAllocation[];

    onData(period, allocations);
  }, onError);
}
```

#### Pattern 2: Paginated Queries (Transactions, History)

```typescript
const PAGE_SIZE = 25;

export async function getTransactionsPaginated(
  userId: string,
  periodId: string | null,
  lastDoc: DocumentSnapshot | null
): Promise<{ transactions: Transaction[]; lastDoc: DocumentSnapshot | null; hasMore: boolean }> {
  const transactionsRef = collection(db, `users/${userId}/transactions`);

  let q = query(
    transactionsRef,
    orderBy('date', 'desc'),
    limit(PAGE_SIZE + 1) // Fetch one extra to check for more
  );

  if (periodId) {
    q = query(q, where('budgetPeriodId', '==', periodId));
  }

  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }

  const snapshot = await getDocs(q);
  const docs = snapshot.docs;
  const hasMore = docs.length > PAGE_SIZE;

  const transactions = docs
    .slice(0, PAGE_SIZE)
    .map(doc => ({ id: doc.id, ...doc.data() })) as Transaction[];

  const newLastDoc = docs.length > 0 ? docs[docs.length - 1] : null;

  return { transactions, lastDoc: newLastDoc, hasMore };
}
```

#### Pattern 3: Batch Writes (Creating Period with Allocations)

```typescript
export async function createBudgetPeriodWithAllocations(
  userId: string,
  periodData: Omit<BudgetPeriod, 'id'>,
  allocations: Omit<BudgetAllocation, 'id'>[]
): Promise<string> {
  const batch = writeBatch(db);

  // Create period document
  const periodRef = doc(collection(db, `users/${userId}/budgetPeriods`));
  batch.set(periodRef, {
    ...periodData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  // Create allocation documents
  for (const allocation of allocations) {
    const allocationRef = doc(
      collection(db, `users/${userId}/budgetPeriods/${periodRef.id}/allocations`)
    );
    batch.set(allocationRef, {
      ...allocation,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  await batch.commit();
  return periodRef.id;
}
```

#### Pattern 4: Transaction with Running Totals Update

```typescript
export async function addTransactionWithTotals(
  userId: string,
  transaction: Omit<Transaction, 'id'>
): Promise<string> {
  const transactionRef = doc(collection(db, `users/${userId}/transactions`));

  await runTransaction(db, async (firestoreTransaction) => {
    // Get current allocation
    const allocationQuery = query(
      collection(db, `users/${userId}/budgetPeriods/${transaction.budgetPeriodId}/allocations`),
      where('categoryId', '==', transaction.categoryId)
    );
    const allocationSnap = await getDocs(allocationQuery);

    if (!allocationSnap.empty) {
      const allocationDoc = allocationSnap.docs[0];
      const currentSpent = allocationDoc.data().spentAmount || 0;

      // Update allocation spent amount
      firestoreTransaction.update(allocationDoc.ref, {
        spentAmount: currentSpent + transaction.amount,
        remainingAmount: increment(-transaction.amount),
        updatedAt: serverTimestamp()
      });
    }

    // Get and update period totals
    const periodRef = doc(db, `users/${userId}/budgetPeriods/${transaction.budgetPeriodId}`);
    firestoreTransaction.update(periodRef, {
      totalSpent: increment(transaction.amount),
      remainingBudget: increment(-transaction.amount),
      updatedAt: serverTimestamp()
    });

    // Create the transaction
    firestoreTransaction.set(transactionRef, {
      ...transaction,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });

  return transactionRef.id;
}
```

### Redux Async Thunks

```typescript
// Example: Fetch budget periods with Redux Toolkit
export const fetchBudgetPeriods = createAsyncThunk(
  'budgetPeriods/fetchAll',
  async (userId: string, { rejectWithValue }) => {
    try {
      const periods = await budgetPeriodsService.getAllPeriods(userId);
      return periods;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Real-time subscription setup
export const subscribeToActivePeriod = createAsyncThunk(
  'budgetPeriods/subscribe',
  async (userId: string, { dispatch }) => {
    const unsubscribe = budgetPeriodsService.subscribeToActivePeriod(
      userId,
      (period, allocations) => {
        dispatch(setActivePeriod({ period, allocations }));
      },
      (error) => {
        dispatch(setError(error.message));
      }
    );

    // Return unsubscribe function for cleanup
    return unsubscribe;
  }
);
```

---

## 6. Folder Structure

```
/src
├── /app                          # App configuration
│   ├── store.ts                  # Redux store configuration
│   ├── hooks.ts                  # Typed Redux hooks
│   └── router.tsx                # React Router configuration
│
├── /components
│   ├── /shared                   # Reusable UI components
│   │   ├── /Button
│   │   │   ├── Button.tsx
│   │   │   ├── Button.styles.ts  # or .css/.scss
│   │   │   ├── Button.test.tsx
│   │   │   └── index.ts
│   │   ├── /Input
│   │   ├── /Modal
│   │   ├── /Card
│   │   ├── /ProgressBar
│   │   ├── /CurrencyInput
│   │   ├── /DatePicker
│   │   ├── /CategoryPicker
│   │   └── index.ts              # Barrel export
│   │
│   ├── /layout                   # Layout components
│   │   ├── AppLayout.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── index.ts
│   │
│   └── /modals                   # Modal components
│       ├── CreateBudgetPeriodModal.tsx
│       ├── AddTransactionModal.tsx
│       ├── EditCategoryModal.tsx
│       ├── ConfirmationModal.tsx
│       └── index.ts
│
├── /features                     # Feature-based modules
│   ├── /auth
│   │   ├── /components
│   │   │   ├── LoginPage.tsx
│   │   │   ├── GoogleLoginButton.tsx
│   │   │   └── AuthGuard.tsx
│   │   ├── authSlice.ts
│   │   ├── authSelectors.ts
│   │   └── index.ts
│   │
│   ├── /dashboard
│   │   ├── /components
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── PeriodSummaryCard.tsx
│   │   │   ├── CategoryBreakdownChart.tsx
│   │   │   ├── BudgetAllocationGrid.tsx
│   │   │   ├── AllocationCard.tsx
│   │   │   └── RecentTransactionsList.tsx
│   │   └── index.ts
│   │
│   ├── /budget-periods
│   │   ├── /components
│   │   │   ├── BudgetHistoryPage.tsx
│   │   │   ├── PeriodHistoryCard.tsx
│   │   │   └── PeriodFilters.tsx
│   │   ├── budgetPeriodsSlice.ts
│   │   ├── budgetPeriodsSelectors.ts
│   │   ├── budgetPeriodsThunks.ts
│   │   └── index.ts
│   │
│   ├── /transactions
│   │   ├── /components
│   │   │   ├── TransactionsPage.tsx
│   │   │   ├── TransactionList.tsx
│   │   │   ├── TransactionRow.tsx
│   │   │   └── TransactionFilters.tsx
│   │   ├── transactionsSlice.ts
│   │   ├── transactionsSelectors.ts
│   │   └── index.ts
│   │
│   ├── /templates
│   │   ├── /components
│   │   │   ├── TemplatesPage.tsx
│   │   │   ├── TemplateCard.tsx
│   │   │   └── TemplateEditor.tsx
│   │   ├── templatesSlice.ts
│   │   └── index.ts
│   │
│   ├── /income
│   │   ├── /components
│   │   │   ├── IncomePage.tsx
│   │   │   ├── IncomeSourceCard.tsx
│   │   │   └── PeriodIncomeEditor.tsx
│   │   ├── incomeSourcesSlice.ts
│   │   └── index.ts
│   │
│   ├── /categories
│   │   ├── /components
│   │   │   ├── CategoryManager.tsx
│   │   │   ├── CategoryTree.tsx
│   │   │   └── CategoryForm.tsx
│   │   ├── categoriesSlice.ts
│   │   ├── categoriesSelectors.ts
│   │   └── index.ts
│   │
│   ├── /settings
│   │   ├── /components
│   │   │   ├── SettingsPage.tsx
│   │   │   ├── PayDaysSettings.tsx
│   │   │   └── CurrencySettings.tsx
│   │   ├── settingsSlice.ts
│   │   └── index.ts
│   │
│   └── /recurring
│       ├── /components
│       │   └── RecurringTransactionsList.tsx
│       ├── recurringSlice.ts
│       └── index.ts
│
├── /services                     # External service integrations
│   └── /firebase
│       ├── config.ts             # Firebase initialization
│       ├── auth.ts               # Auth methods
│       ├── settings.ts
│       ├── categories.ts
│       ├── templates.ts
│       ├── budgetPeriods.ts
│       ├── transactions.ts
│       ├── incomeSources.ts
│       ├── recurringTransactions.ts
│       └── index.ts
│
├── /hooks                        # Custom React hooks
│   ├── useAuth.ts
│   ├── useBudgetPeriod.ts
│   ├── useTransactions.ts
│   ├── useCategories.ts
│   ├── useFirestoreSubscription.ts
│   └── index.ts
│
├── /utils                        # Utility functions
│   ├── date.ts                   # Date/period calculations
│   ├── currency.ts               # Currency formatting
│   ├── rollover.ts               # Rollover calculations
│   ├── validation.ts             # Form validation schemas
│   └── index.ts
│
├── /types                        # TypeScript type definitions
│   ├── models.ts                 # Data model interfaces
│   ├── firebase.ts               # Firebase-specific types
│   ├── redux.ts                  # Redux state types
│   └── index.ts
│
├── /constants                    # App constants
│   ├── routes.ts
│   ├── categories.ts             # Default categories
│   └── index.ts
│
├── /styles                       # Global styles
│   ├── variables.css
│   ├── globals.css
│   └── theme.ts
│
├── App.tsx                       # Root component
├── main.tsx                      # Entry point
└── vite-env.d.ts
```

### Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| Feature-based structure | Co-locates related components, slices, and selectors for better maintainability |
| Normalized Redux state | Prevents data duplication and simplifies updates |
| Service layer abstraction | Isolates Firebase specifics, enables easier testing and potential backend swap |
| Denormalized Firestore data | Reduces reads by storing computed/referenced values (category names in transactions) |
| Real-time subscriptions for active data | Ensures dashboard always shows current state |
| Paginated queries for historical data | Manages performance with growing data |
| Batch writes for related operations | Ensures atomicity when creating periods with allocations |

---

## Quick Reference

### Period Creation Flow

```
1. User clicks "Create Budget Period"
2. Modal opens with date picker (defaults to next period)
3. System calculates rollover from previous period (if same month)
4. User selects template or creates allocations manually
5. User enters/confirms income for this period
6. System creates period + allocations in batch
7. Previous period marked as closed
```

### Transaction Flow

```
1. User adds transaction via modal or quick-add
2. System validates category and period assignment
3. Transaction created with Firestore transaction
4. Allocation spent amount updated atomically
5. Period totals updated atomically
6. Redux state updated via subscription or manual fetch
```

### Rollover Summary

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Jan 1-14      │     │   Jan 15-31     │     │   Feb 1-14      │
│   Period        │────▶│   Period        │──╳──│   Period        │
│                 │     │                 │     │                 │
│ Unused: $200    │     │ RolloverIn:$200 │     │ RolloverIn: $0  │
│ RolloverOut:$200│     │ Unused: $150    │     │ (New month)     │
└─────────────────┘     │ RolloverOut:$0  │     └─────────────────┘
                        └─────────────────┘
                        (End of month, no rollover)
```
