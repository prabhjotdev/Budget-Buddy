import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { RecurringTransaction } from '../../types';
import * as recurringService from '../../services/firebase/recurringTransactions';

interface RecurringState {
  byId: Record<string, RecurringTransaction>;
  allIds: string[];
  isLoading: boolean;
  error: string | null;
}

const initialState: RecurringState = {
  byId: {},
  allIds: [],
  isLoading: false,
  error: null,
};

export const fetchRecurringTransactions = createAsyncThunk(
  'recurring/fetch',
  async (userId: string, { rejectWithValue }) => {
    try {
      return await recurringService.getRecurringTransactions(userId);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const createRecurringTransaction = createAsyncThunk(
  'recurring/create',
  async (
    {
      userId,
      recurring,
    }: {
      userId: string;
      recurring: Omit<RecurringTransaction, 'id' | 'createdAt' | 'updatedAt' | 'lastGeneratedPeriodId'>;
    },
    { rejectWithValue }
  ) => {
    try {
      const id = await recurringService.createRecurringTransaction(userId, recurring);
      return { id, ...recurring, lastGeneratedPeriodId: null };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const updateRecurringTransaction = createAsyncThunk(
  'recurring/update',
  async (
    {
      userId,
      recurringId,
      updates,
    }: {
      userId: string;
      recurringId: string;
      updates: Partial<Omit<RecurringTransaction, 'id' | 'createdAt' | 'updatedAt'>>;
    },
    { rejectWithValue }
  ) => {
    try {
      await recurringService.updateRecurringTransaction(userId, recurringId, updates);
      return { recurringId, updates };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const deleteRecurringTransaction = createAsyncThunk(
  'recurring/delete',
  async ({ userId, recurringId }: { userId: string; recurringId: string }, { rejectWithValue }) => {
    try {
      await recurringService.deleteRecurringTransaction(userId, recurringId);
      return recurringId;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

const recurringSlice = createSlice({
  name: 'recurring',
  initialState,
  reducers: {
    clearRecurring: (state) => {
      state.byId = {};
      state.allIds = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRecurringTransactions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(
        fetchRecurringTransactions.fulfilled,
        (state, action: PayloadAction<RecurringTransaction[]>) => {
          state.isLoading = false;
          state.byId = {};
          state.allIds = [];
          action.payload.forEach((recurring) => {
            state.byId[recurring.id] = recurring;
            state.allIds.push(recurring.id);
          });
        }
      )
      .addCase(fetchRecurringTransactions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(createRecurringTransaction.fulfilled, (state, action) => {
        const recurring = action.payload as RecurringTransaction;
        state.byId[recurring.id] = recurring;
        state.allIds.push(recurring.id);
      })
      .addCase(updateRecurringTransaction.fulfilled, (state, action) => {
        const { recurringId, updates } = action.payload;
        if (state.byId[recurringId]) {
          state.byId[recurringId] = { ...state.byId[recurringId], ...updates };
        }
      })
      .addCase(deleteRecurringTransaction.fulfilled, (state, action) => {
        const recurringId = action.payload;
        delete state.byId[recurringId];
        state.allIds = state.allIds.filter((id) => id !== recurringId);
      });
  },
});

export const { clearRecurring } = recurringSlice.actions;
export default recurringSlice.reducer;
