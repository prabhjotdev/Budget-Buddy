import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { SavingsGoalsState } from '../../types/savingsGoals';
import * as savingsGoalsService from '../../services/firebase/savingsGoals';

const initialState: SavingsGoalsState = {
  goals: {
    byId: {},
    allIds: [],
  },
  transactions: {
    byId: {},
    allIds: [],
  },
  status: 'idle',
  error: null,
};

// --- Thunks ---

export const fetchSavingsGoals = createAsyncThunk(
  'savingsGoals/fetch',
  async (userId: string, { rejectWithValue }) => {
    try {
      return await savingsGoalsService.getSavingsGoals(userId);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const createSavingsGoal = createAsyncThunk(
  'savingsGoals/create',
  async (
    {
      userId,
      goal,
    }: {
      userId: string;
      goal: { name: string; targetAmount?: number; currentBalance: number; isActive: boolean };
    },
    { rejectWithValue }
  ) => {
    try {
      return await savingsGoalsService.createSavingsGoal(userId, goal);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const updateSavingsGoal = createAsyncThunk(
  'savingsGoals/update',
  async (
    {
      userId,
      goalId,
      updates,
    }: {
      userId: string;
      goalId: string;
      updates: { name?: string; targetAmount?: number; isActive?: boolean };
    },
    { rejectWithValue }
  ) => {
    try {
      await savingsGoalsService.updateSavingsGoal(userId, goalId, updates);
      return { goalId, updates };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const deleteSavingsGoal = createAsyncThunk(
  'savingsGoals/delete',
  async (
    { userId, goalId }: { userId: string; goalId: string },
    { rejectWithValue }
  ) => {
    try {
      await savingsGoalsService.deleteSavingsGoal(userId, goalId);
      return goalId;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const depositToSavingsGoal = createAsyncThunk(
  'savingsGoals/deposit',
  async (
    {
      userId,
      goalId,
      amount,
      description,
      cycleId,
    }: {
      userId: string;
      goalId: string;
      amount: number;
      description: string;
      cycleId: string | null;
    },
    { rejectWithValue }
  ) => {
    try {
      return await savingsGoalsService.depositToSavingsGoal(
        userId,
        goalId,
        amount,
        description,
        cycleId
      );
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const withdrawFromSavingsGoal = createAsyncThunk(
  'savingsGoals/withdraw',
  async (
    {
      userId,
      goalId,
      amount,
      description,
      cycleId,
    }: {
      userId: string;
      goalId: string;
      amount: number;
      description: string;
      cycleId: string | null;
    },
    { rejectWithValue }
  ) => {
    try {
      return await savingsGoalsService.withdrawFromSavingsGoal(
        userId,
        goalId,
        amount,
        description,
        cycleId
      );
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const fetchSavingsGoalTransactions = createAsyncThunk(
  'savingsGoals/fetchTransactions',
  async (
    { userId, goalId }: { userId: string; goalId?: string },
    { rejectWithValue }
  ) => {
    try {
      return await savingsGoalsService.getSavingsGoalTransactions(userId, goalId);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

// --- Slice ---

const savingsGoalsSlice = createSlice({
  name: 'savingsGoals',
  initialState,
  reducers: {
    clearSavingsGoals: (state) => {
      state.goals = { byId: {}, allIds: [] };
      state.transactions = { byId: {}, allIds: [] };
      state.status = 'idle';
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch goals
      .addCase(fetchSavingsGoals.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchSavingsGoals.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.goals.byId = {};
        state.goals.allIds = [];
        action.payload.forEach((goal) => {
          state.goals.byId[goal.id] = goal;
          state.goals.allIds.push(goal.id);
        });
      })
      .addCase(fetchSavingsGoals.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload as string;
      })
      // Create goal
      .addCase(createSavingsGoal.fulfilled, (state, action) => {
        const goal = action.payload;
        state.goals.byId[goal.id] = goal;
        state.goals.allIds.unshift(goal.id);
      })
      // Update goal
      .addCase(updateSavingsGoal.fulfilled, (state, action) => {
        const { goalId, updates } = action.payload;
        if (state.goals.byId[goalId]) {
          Object.assign(state.goals.byId[goalId], updates);
        }
      })
      // Delete goal
      .addCase(deleteSavingsGoal.fulfilled, (state, action) => {
        const goalId = action.payload;
        delete state.goals.byId[goalId];
        state.goals.allIds = state.goals.allIds.filter((id) => id !== goalId);
      })
      // Deposit
      .addCase(depositToSavingsGoal.fulfilled, (state, action) => {
        const { newBalance, transaction } = action.payload;
        if (state.goals.byId[transaction.goalId]) {
          state.goals.byId[transaction.goalId].currentBalance = newBalance;
        }
        state.transactions.byId[transaction.id] = transaction;
        state.transactions.allIds.unshift(transaction.id);
      })
      // Withdraw
      .addCase(withdrawFromSavingsGoal.fulfilled, (state, action) => {
        const { newBalance, transaction } = action.payload;
        if (state.goals.byId[transaction.goalId]) {
          state.goals.byId[transaction.goalId].currentBalance = newBalance;
        }
        state.transactions.byId[transaction.id] = transaction;
        state.transactions.allIds.unshift(transaction.id);
      })
      // Fetch transactions
      .addCase(fetchSavingsGoalTransactions.fulfilled, (state, action) => {
        state.transactions.byId = {};
        state.transactions.allIds = [];
        action.payload.forEach((tx) => {
          state.transactions.byId[tx.id] = tx;
          state.transactions.allIds.push(tx.id);
        });
      });
  },
});

export const { clearSavingsGoals } = savingsGoalsSlice.actions;
export default savingsGoalsSlice.reducer;
