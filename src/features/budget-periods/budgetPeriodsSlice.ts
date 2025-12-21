import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { BudgetPeriod, BudgetAllocation, IncomeEntry } from '../../types';
import * as budgetPeriodsService from '../../services/firebase/budgetPeriods';

interface BudgetPeriodsState {
  byId: Record<string, BudgetPeriod>;
  allIds: string[];
  activePeriodId: string | null;
  allocationsByPeriodId: Record<
    string,
    {
      byId: Record<string, BudgetAllocation>;
      allIds: string[];
    }
  >;
  isLoading: boolean;
  error: string | null;
}

const initialState: BudgetPeriodsState = {
  byId: {},
  allIds: [],
  activePeriodId: null,
  allocationsByPeriodId: {},
  isLoading: false,
  error: null,
};

export const fetchBudgetPeriods = createAsyncThunk(
  'budgetPeriods/fetch',
  async (userId: string, { rejectWithValue }) => {
    try {
      return await budgetPeriodsService.getBudgetPeriods(userId);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const fetchAllocations = createAsyncThunk(
  'budgetPeriods/fetchAllocations',
  async ({ userId, periodId }: { userId: string; periodId: string }, { rejectWithValue }) => {
    try {
      const allocations = await budgetPeriodsService.getAllocations(userId, periodId);
      return { periodId, allocations };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const createBudgetPeriod = createAsyncThunk(
  'budgetPeriods/create',
  async (
    {
      userId,
      periodData,
      allocations,
    }: {
      userId: string;
      periodData: {
        startDate: Date;
        endDate: Date;
        totalIncome: number;
        incomeBreakdown: IncomeEntry[];
        rolloverIn: number;
      };
      allocations: Array<{
        categoryId: string;
        categoryName: string;
        categoryColor: string;
        budgetedAmount: number;
        note: string;
      }>;
    },
    { rejectWithValue }
  ) => {
    try {
      // Close any active period first
      const activePeriod = await budgetPeriodsService.getActivePeriod(userId);
      if (activePeriod) {
        const unused = activePeriod.totalIncome + activePeriod.rolloverIn - activePeriod.totalSpent;
        await budgetPeriodsService.closeBudgetPeriod(userId, activePeriod.id, Math.max(0, unused));
      }

      const id = await budgetPeriodsService.createBudgetPeriod(userId, periodData, allocations);
      return { id, periodData, allocations };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const closeBudgetPeriod = createAsyncThunk(
  'budgetPeriods/close',
  async (
    { userId, periodId, rolloverOut }: { userId: string; periodId: string; rolloverOut: number },
    { rejectWithValue }
  ) => {
    try {
      await budgetPeriodsService.closeBudgetPeriod(userId, periodId, rolloverOut);
      return { periodId, rolloverOut };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

const budgetPeriodsSlice = createSlice({
  name: 'budgetPeriods',
  initialState,
  reducers: {
    setActivePeriod: (
      state,
      action: PayloadAction<{ period: BudgetPeriod | null; allocations: BudgetAllocation[] }>
    ) => {
      const { period, allocations } = action.payload;
      if (period) {
        state.byId[period.id] = period;
        if (!state.allIds.includes(period.id)) {
          state.allIds.unshift(period.id);
        }
        state.activePeriodId = period.id;

        state.allocationsByPeriodId[period.id] = {
          byId: {},
          allIds: [],
        };
        allocations.forEach((alloc) => {
          state.allocationsByPeriodId[period.id].byId[alloc.id] = alloc;
          state.allocationsByPeriodId[period.id].allIds.push(alloc.id);
        });
      } else {
        state.activePeriodId = null;
      }
    },
    updateAllocationSpent: (
      state,
      action: PayloadAction<{ periodId: string; allocationId: string; amount: number }>
    ) => {
      const { periodId, allocationId, amount } = action.payload;
      const alloc = state.allocationsByPeriodId[periodId]?.byId[allocationId];
      if (alloc) {
        alloc.spentAmount += amount;
        alloc.remainingAmount -= amount;
      }
      const period = state.byId[periodId];
      if (period) {
        period.totalSpent += amount;
        period.remainingBudget -= amount;
      }
    },
    clearBudgetPeriods: (state) => {
      state.byId = {};
      state.allIds = [];
      state.activePeriodId = null;
      state.allocationsByPeriodId = {};
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBudgetPeriods.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchBudgetPeriods.fulfilled, (state, action: PayloadAction<BudgetPeriod[]>) => {
        state.isLoading = false;
        state.byId = {};
        state.allIds = [];
        action.payload.forEach((period) => {
          state.byId[period.id] = period;
          state.allIds.push(period.id);
          if (period.status === 'active') {
            state.activePeriodId = period.id;
          }
        });
      })
      .addCase(fetchBudgetPeriods.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchAllocations.fulfilled, (state, action) => {
        const { periodId, allocations } = action.payload;
        state.allocationsByPeriodId[periodId] = {
          byId: {},
          allIds: [],
        };
        allocations.forEach((alloc) => {
          state.allocationsByPeriodId[periodId].byId[alloc.id] = alloc;
          state.allocationsByPeriodId[periodId].allIds.push(alloc.id);
        });
      })
      .addCase(closeBudgetPeriod.fulfilled, (state, action) => {
        const { periodId, rolloverOut } = action.payload;
        if (state.byId[periodId]) {
          state.byId[periodId].status = 'closed';
          state.byId[periodId].rolloverOut = rolloverOut;
        }
        if (state.activePeriodId === periodId) {
          state.activePeriodId = null;
        }
      });
  },
});

export const { setActivePeriod, updateAllocationSpent, clearBudgetPeriods } =
  budgetPeriodsSlice.actions;
export default budgetPeriodsSlice.reducer;
