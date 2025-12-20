import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Transaction } from '../../types';
import * as transactionsService from '../../services/firebase/transactions';

interface TransactionsState {
  byId: Record<string, Transaction>;
  allIds: string[];
  idsByPeriod: Record<string, string[]>;
  recentByPeriod: Record<string, string[]>;
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
}

const initialState: TransactionsState = {
  byId: {},
  allIds: [],
  idsByPeriod: {},
  recentByPeriod: {},
  isLoading: false,
  error: null,
  hasMore: true,
};

export const fetchTransactions = createAsyncThunk(
  'transactions/fetch',
  async (
    {
      userId,
      filters,
    }: {
      userId: string;
      filters?: { periodId?: string; categoryId?: string; type?: 'expense' | 'income' };
    },
    { rejectWithValue }
  ) => {
    try {
      const result = await transactionsService.getTransactions(userId, filters);
      return { ...result, filters };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const fetchRecentTransactions = createAsyncThunk(
  'transactions/fetchRecent',
  async (
    { userId, periodId }: { userId: string; periodId: string },
    { rejectWithValue }
  ) => {
    try {
      const transactions = await transactionsService.getRecentTransactions(userId, periodId);
      return { periodId, transactions };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const addTransaction = createAsyncThunk(
  'transactions/add',
  async (
    {
      userId,
      transaction,
    }: {
      userId: string;
      transaction: {
        budgetPeriodId: string;
        categoryId: string;
        categoryName: string;
        type: 'expense' | 'income';
        amount: number;
        description: string;
        date: Date;
        recurringTransactionId?: string | null;
      };
    },
    { rejectWithValue }
  ) => {
    try {
      const id = await transactionsService.addTransaction(userId, transaction);
      return { id, ...transaction };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const deleteTransaction = createAsyncThunk(
  'transactions/delete',
  async (
    {
      userId,
      transaction,
    }: {
      userId: string;
      transaction: Transaction;
    },
    { rejectWithValue }
  ) => {
    try {
      await transactionsService.deleteTransaction(
        userId,
        transaction.id,
        transaction.budgetPeriodId,
        transaction.categoryId,
        transaction.amount,
        transaction.type
      );
      return transaction;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

const transactionsSlice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {
    clearTransactions: (state) => {
      state.byId = {};
      state.allIds = [];
      state.idsByPeriod = {};
      state.recentByPeriod = {};
      state.hasMore = true;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTransactions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        state.isLoading = false;
        const { transactions, hasMore, filters } = action.payload;

        // Clear existing if fresh fetch
        state.byId = {};
        state.allIds = [];
        state.idsByPeriod = {};

        transactions.forEach((tx) => {
          state.byId[tx.id] = tx;
          state.allIds.push(tx.id);

          if (!state.idsByPeriod[tx.budgetPeriodId]) {
            state.idsByPeriod[tx.budgetPeriodId] = [];
          }
          state.idsByPeriod[tx.budgetPeriodId].push(tx.id);
        });

        state.hasMore = hasMore;
      })
      .addCase(fetchTransactions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchRecentTransactions.fulfilled, (state, action) => {
        const { periodId, transactions } = action.payload;
        state.recentByPeriod[periodId] = [];

        transactions.forEach((tx) => {
          state.byId[tx.id] = tx;
          if (!state.allIds.includes(tx.id)) {
            state.allIds.push(tx.id);
          }
          state.recentByPeriod[periodId].push(tx.id);
        });
      })
      .addCase(addTransaction.fulfilled, (state, action) => {
        const tx = action.payload as Transaction;
        state.byId[tx.id] = tx;
        state.allIds.unshift(tx.id);

        if (!state.idsByPeriod[tx.budgetPeriodId]) {
          state.idsByPeriod[tx.budgetPeriodId] = [];
        }
        state.idsByPeriod[tx.budgetPeriodId].unshift(tx.id);

        if (state.recentByPeriod[tx.budgetPeriodId]) {
          state.recentByPeriod[tx.budgetPeriodId].unshift(tx.id);
          if (state.recentByPeriod[tx.budgetPeriodId].length > 5) {
            state.recentByPeriod[tx.budgetPeriodId].pop();
          }
        }
      })
      .addCase(deleteTransaction.fulfilled, (state, action) => {
        const tx = action.payload;
        delete state.byId[tx.id];
        state.allIds = state.allIds.filter((id) => id !== tx.id);

        if (state.idsByPeriod[tx.budgetPeriodId]) {
          state.idsByPeriod[tx.budgetPeriodId] = state.idsByPeriod[tx.budgetPeriodId].filter(
            (id) => id !== tx.id
          );
        }
        if (state.recentByPeriod[tx.budgetPeriodId]) {
          state.recentByPeriod[tx.budgetPeriodId] = state.recentByPeriod[tx.budgetPeriodId].filter(
            (id) => id !== tx.id
          );
        }
      });
  },
});

export const { clearTransactions } = transactionsSlice.actions;
export default transactionsSlice.reducer;
