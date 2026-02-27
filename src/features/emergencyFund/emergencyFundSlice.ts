import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { Timestamp } from 'firebase/firestore';
import type { EmergencyFundState } from '../../types/emergencyFund';
import * as emergencyFundService from '../../services/firebase/emergencyFund';

const initialState: EmergencyFundState = {
  fund: null,
  transactions: {
    byId: {},
    allIds: [],
  },
  status: 'idle',
  error: null,
};

// Async thunks
export const fetchEmergencyFund = createAsyncThunk(
  'emergencyFund/fetch',
  async (userId: string, { rejectWithValue }) => {
    try {
      return await emergencyFundService.getEmergencyFund(userId);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const fetchEmergencyFundTransactions = createAsyncThunk(
  'emergencyFund/fetchTransactions',
  async (userId: string, { rejectWithValue }) => {
    try {
      return await emergencyFundService.getEmergencyFundTransactions(userId);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const updateEmergencyFundGoal = createAsyncThunk(
  'emergencyFund/updateGoal',
  async (
    {
      userId,
      goalAmount,
      goalType,
      goalMonths,
    }: {
      userId: string;
      goalAmount?: number;
      goalType?: 'fixed' | 'months';
      goalMonths?: number;
    },
    { rejectWithValue }
  ) => {
    try {
      return await emergencyFundService.saveEmergencyFund(userId, {
        goalAmount,
        goalType,
        goalMonths,
      });
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const addDeposit = createAsyncThunk(
  'emergencyFund/addDeposit',
  async (
    {
      userId,
      amount,
      description,
      date,
    }: {
      userId: string;
      amount: number;
      description: string;
      date: Timestamp;
    },
    { rejectWithValue }
  ) => {
    try {
      // Add transaction
      const transaction = await emergencyFundService.addEmergencyFundTransaction(userId, {
        type: 'deposit',
        amount,
        description,
        date,
      });

      // Read current balance from Firestore to avoid stale Redux state
      const currentFund = await emergencyFundService.getEmergencyFund(userId);
      const currentBalance = currentFund?.currentBalance || 0;
      const newBalance = currentBalance + amount;

      // If fund doesn't exist, create it
      if (!currentFund) {
        await emergencyFundService.saveEmergencyFund(userId, {
          currentBalance: newBalance,
        });
      } else {
        await emergencyFundService.updateEmergencyFundBalance(userId, newBalance);
      }

      return { transaction, newBalance };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const addWithdrawal = createAsyncThunk(
  'emergencyFund/addWithdrawal',
  async (
    {
      userId,
      amount,
      description,
      date,
    }: {
      userId: string;
      amount: number;
      description: string;
      date: Timestamp;
    },
    { rejectWithValue }
  ) => {
    try {
      // Add transaction
      const transaction = await emergencyFundService.addEmergencyFundTransaction(userId, {
        type: 'withdrawal',
        amount,
        description,
        date,
      });

      // Read current balance from Firestore to avoid stale Redux state
      const currentFund = await emergencyFundService.getEmergencyFund(userId);
      const currentBalance = currentFund?.currentBalance || 0;
      const newBalance = Math.max(0, currentBalance - amount);

      await emergencyFundService.updateEmergencyFundBalance(userId, newBalance);

      return { transaction, newBalance };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const deleteTransaction = createAsyncThunk(
  'emergencyFund/deleteTransaction',
  async (
    {
      userId,
      transactionId,
      amount,
      type,
    }: {
      userId: string;
      transactionId: string;
      amount: number;
      type: 'deposit' | 'withdrawal';
    },
    { rejectWithValue }
  ) => {
    try {
      await emergencyFundService.deleteEmergencyFundTransaction(userId, transactionId);

      // Read current balance from Firestore to avoid stale Redux state
      const currentFund = await emergencyFundService.getEmergencyFund(userId);
      const currentBalance = currentFund?.currentBalance || 0;
      const newBalance =
        type === 'deposit' ? currentBalance - amount : currentBalance + amount;

      await emergencyFundService.updateEmergencyFundBalance(userId, Math.max(0, newBalance));

      return { transactionId, newBalance };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

const emergencyFundSlice = createSlice({
  name: 'emergencyFund',
  initialState,
  reducers: {
    clearEmergencyFund: (state) => {
      state.fund = null;
      state.transactions = { byId: {}, allIds: [] };
      state.status = 'idle';
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch emergency fund
      .addCase(fetchEmergencyFund.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchEmergencyFund.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.fund = action.payload;
      })
      .addCase(fetchEmergencyFund.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload as string;
      })
      // Fetch transactions
      .addCase(fetchEmergencyFundTransactions.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchEmergencyFundTransactions.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.transactions.byId = {};
        state.transactions.allIds = [];
        action.payload.forEach((transaction) => {
          state.transactions.byId[transaction.id] = transaction;
          state.transactions.allIds.push(transaction.id);
        });
      })
      .addCase(fetchEmergencyFundTransactions.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload as string;
      })
      // Update goal
      .addCase(updateEmergencyFundGoal.fulfilled, (state, action) => {
        state.fund = action.payload;
      })
      // Add deposit
      .addCase(addDeposit.fulfilled, (state, action) => {
        const { transaction, newBalance } = action.payload;
        state.transactions.byId[transaction.id] = transaction;
        state.transactions.allIds.unshift(transaction.id);
        if (state.fund) {
          state.fund.currentBalance = newBalance;
        } else {
          state.fund = {
            id: 'main',
            currentBalance: newBalance,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          };
        }
      })
      // Add withdrawal
      .addCase(addWithdrawal.fulfilled, (state, action) => {
        const { transaction, newBalance } = action.payload;
        state.transactions.byId[transaction.id] = transaction;
        state.transactions.allIds.unshift(transaction.id);
        if (state.fund) {
          state.fund.currentBalance = newBalance;
        }
      })
      // Delete transaction
      .addCase(deleteTransaction.fulfilled, (state, action) => {
        const { transactionId, newBalance } = action.payload;
        delete state.transactions.byId[transactionId];
        state.transactions.allIds = state.transactions.allIds.filter((id) => id !== transactionId);
        if (state.fund) {
          state.fund.currentBalance = newBalance;
        }
      });
  },
});

export const { clearEmergencyFund } = emergencyFundSlice.actions;
export default emergencyFundSlice.reducer;
