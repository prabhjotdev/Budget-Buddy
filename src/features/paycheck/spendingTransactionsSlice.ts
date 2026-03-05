import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { SpendingTransaction } from '../../types';
import * as spendingTransactionsService from '../../services/firebase/spendingTransactions';

interface SpendingTransactionsState {
  byId: Record<string, SpendingTransaction>;
  allIds: string[];
  idsByCycle: Record<string, string[]>;
  hasFullHistory: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: SpendingTransactionsState = {
  byId: {},
  allIds: [],
  idsByCycle: {},
  hasFullHistory: false,
  isLoading: false,
  error: null,
};

export const fetchSpendingTransactions = createAsyncThunk(
  'spendingTransactions/fetch',
  async (userId: string, { rejectWithValue }) => {
    try {
      return await spendingTransactionsService.getSpendingTransactions(userId);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const fetchRecentSpendingTransactions = createAsyncThunk(
  'spendingTransactions/fetchRecent',
  async ({ userId, days }: { userId: string; days: number }, { rejectWithValue }) => {
    try {
      return await spendingTransactionsService.getRecentSpendingTransactions(userId, days);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const fetchTransactionsByCycle = createAsyncThunk(
  'spendingTransactions/fetchByCycle',
  async (
    { userId, cycleId }: { userId: string; cycleId: string },
    { rejectWithValue }
  ) => {
    try {
      const transactions = await spendingTransactionsService.getTransactionsByCycle(
        userId,
        cycleId
      );
      return { cycleId, transactions };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const createSpendingTransaction = createAsyncThunk(
  'spendingTransactions/create',
  async (
    {
      userId,
      transaction,
    }: {
      userId: string;
      transaction: Omit<SpendingTransaction, 'id' | 'createdAt' | 'updatedAt'>;
    },
    { rejectWithValue }
  ) => {
    try {
      const id = await spendingTransactionsService.createSpendingTransaction(userId, transaction);
      return { id, ...transaction };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const updateSpendingTransaction = createAsyncThunk(
  'spendingTransactions/update',
  async (
    {
      userId,
      transactionId,
      updates,
    }: {
      userId: string;
      transactionId: string;
      updates: Partial<Omit<SpendingTransaction, 'id' | 'createdAt' | 'updatedAt'>>;
    },
    { rejectWithValue }
  ) => {
    try {
      await spendingTransactionsService.updateSpendingTransaction(userId, transactionId, updates);
      return { transactionId, updates };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const deleteSpendingTransaction = createAsyncThunk(
  'spendingTransactions/delete',
  async (
    { userId, transactionId }: { userId: string; transactionId: string },
    { rejectWithValue }
  ) => {
    try {
      await spendingTransactionsService.deleteSpendingTransaction(userId, transactionId);
      return transactionId;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

const organizeTransactions = (transactions: SpendingTransaction[]) => {
  const byId: Record<string, SpendingTransaction> = {};
  const allIds: string[] = [];
  const idsByCycle: Record<string, string[]> = {};

  // Sort by date (descending - most recent first)
  const sorted = [...transactions].sort((a, b) => {
    const aTime = a.date.toDate().getTime();
    const bTime = b.date.toDate().getTime();
    return bTime - aTime;
  });

  sorted.forEach((tx) => {
    byId[tx.id] = tx;
    allIds.push(tx.id);

    if (!idsByCycle[tx.cycleId]) {
      idsByCycle[tx.cycleId] = [];
    }
    idsByCycle[tx.cycleId].push(tx.id);
  });

  return { byId, allIds, idsByCycle };
};

const spendingTransactionsSlice = createSlice({
  name: 'spendingTransactions',
  initialState,
  reducers: {
    clearSpendingTransactions: (state) => {
      state.byId = {};
      state.allIds = [];
      state.idsByCycle = {};
      state.hasFullHistory = false;
    },
    clearCycleTransactions: (state, action: PayloadAction<string>) => {
      const cycleId = action.payload;
      const idsToRemove = state.idsByCycle[cycleId] || [];
      idsToRemove.forEach((id) => {
        delete state.byId[id];
      });
      state.allIds = state.allIds.filter((id) => !idsToRemove.includes(id));
      delete state.idsByCycle[cycleId];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSpendingTransactions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(
        fetchSpendingTransactions.fulfilled,
        (state, action: PayloadAction<SpendingTransaction[]>) => {
          state.isLoading = false;
          state.hasFullHistory = true;
          const organized = organizeTransactions(action.payload);
          state.byId = organized.byId;
          state.allIds = organized.allIds;
          state.idsByCycle = organized.idsByCycle;
        }
      )
      .addCase(fetchRecentSpendingTransactions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(
        fetchRecentSpendingTransactions.fulfilled,
        (state, action: PayloadAction<SpendingTransaction[]>) => {
          state.isLoading = false;
          state.hasFullHistory = false;
          const organized = organizeTransactions(action.payload);
          state.byId = organized.byId;
          state.allIds = organized.allIds;
          state.idsByCycle = organized.idsByCycle;
        }
      )
      .addCase(fetchRecentSpendingTransactions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchSpendingTransactions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchTransactionsByCycle.fulfilled, (state, action) => {
        const { cycleId, transactions } = action.payload;

        // Clear existing transactions for this cycle
        const existingIds = state.idsByCycle[cycleId] || [];
        existingIds.forEach((id) => {
          delete state.byId[id];
        });
        state.allIds = state.allIds.filter((id) => !existingIds.includes(id));

        // Add new transactions
        const newIds: string[] = [];
        transactions.forEach((tx) => {
          state.byId[tx.id] = tx;
          state.allIds.push(tx.id);
          newIds.push(tx.id);
        });

        state.idsByCycle[cycleId] = newIds;

        // Re-sort allIds by date
        state.allIds.sort((a, b) => {
          const aTime = state.byId[a].date.toDate().getTime();
          const bTime = state.byId[b].date.toDate().getTime();
          return bTime - aTime;
        });
      })
      .addCase(createSpendingTransaction.fulfilled, (state, action) => {
        const tx = action.payload as SpendingTransaction;
        state.byId[tx.id] = tx;

        // Insert in sorted position (most recent first)
        const txTime = tx.date.toDate().getTime();
        let insertIndex = 0;
        for (let i = 0; i < state.allIds.length; i++) {
          const existingTime = state.byId[state.allIds[i]].date.toDate().getTime();
          if (txTime > existingTime) {
            break;
          }
          insertIndex = i + 1;
        }
        state.allIds.splice(insertIndex, 0, tx.id);

        // Add to cycle index
        if (!state.idsByCycle[tx.cycleId]) {
          state.idsByCycle[tx.cycleId] = [];
        }
        state.idsByCycle[tx.cycleId].unshift(tx.id);
      })
      .addCase(updateSpendingTransaction.fulfilled, (state, action) => {
        const { transactionId, updates } = action.payload;
        if (state.byId[transactionId]) {
          state.byId[transactionId] = { ...state.byId[transactionId], ...updates };
        }
      })
      .addCase(deleteSpendingTransaction.fulfilled, (state, action) => {
        const transactionId = action.payload;
        const tx = state.byId[transactionId];
        if (tx) {
          const cycleId = tx.cycleId;
          delete state.byId[transactionId];
          state.allIds = state.allIds.filter((id) => id !== transactionId);
          if (state.idsByCycle[cycleId]) {
            state.idsByCycle[cycleId] = state.idsByCycle[cycleId].filter(
              (id) => id !== transactionId
            );
          }
        }
      });
  },
});

export const { clearSpendingTransactions, clearCycleTransactions } = spendingTransactionsSlice.actions;
export default spendingTransactionsSlice.reducer;
