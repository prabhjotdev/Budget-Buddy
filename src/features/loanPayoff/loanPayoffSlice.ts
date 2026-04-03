import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { LoanPayoffState } from '../../types/loanPayoff';
import type { Timestamp } from 'firebase/firestore';
import * as loansService from '../../services/firebase/loans';

const initialState: LoanPayoffState = {
  loans: {
    byId: {},
    allIds: [],
  },
  status: 'idle',
  error: null,
};

export const fetchLoans = createAsyncThunk(
  'loanPayoff/fetch',
  async (userId: string, { rejectWithValue }) => {
    try {
      return await loansService.getLoans(userId);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const createLoan = createAsyncThunk(
  'loanPayoff/create',
  async (
    {
      userId,
      loan,
    }: {
      userId: string;
      loan: {
        name: string;
        description?: string;
        initialAmount: number;
        remainingBalance: number;
        monthlyPayment: number;
        interestRate: number;
        payoffDate?: Timestamp;
      };
    },
    { rejectWithValue }
  ) => {
    try {
      return await loansService.createLoan(userId, loan);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const updateLoan = createAsyncThunk(
  'loanPayoff/update',
  async (
    {
      userId,
      loanId,
      updates,
    }: {
      userId: string;
      loanId: string;
      updates: {
        name?: string;
        description?: string;
        initialAmount?: number;
        remainingBalance?: number;
        monthlyPayment?: number;
        interestRate?: number;
        payoffDate?: Timestamp;
      };
    },
    { rejectWithValue }
  ) => {
    try {
      await loansService.updateLoan(userId, loanId, updates);
      return { loanId, updates };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const deleteLoan = createAsyncThunk(
  'loanPayoff/delete',
  async (
    { userId, loanId }: { userId: string; loanId: string },
    { rejectWithValue }
  ) => {
    try {
      await loansService.deleteLoan(userId, loanId);
      return loanId;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

const loanPayoffSlice = createSlice({
  name: 'loanPayoff',
  initialState,
  reducers: {
    clearLoans: (state) => {
      state.loans = { byId: {}, allIds: [] };
      state.status = 'idle';
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLoans.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchLoans.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.loans.byId = {};
        state.loans.allIds = [];
        action.payload.forEach((loan) => {
          state.loans.byId[loan.id] = loan;
          state.loans.allIds.push(loan.id);
        });
      })
      .addCase(fetchLoans.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload as string;
      })
      .addCase(createLoan.fulfilled, (state, action) => {
        const loan = action.payload;
        state.loans.byId[loan.id] = loan;
        state.loans.allIds.unshift(loan.id);
      })
      .addCase(updateLoan.fulfilled, (state, action) => {
        const { loanId, updates } = action.payload;
        if (state.loans.byId[loanId]) {
          Object.assign(state.loans.byId[loanId], updates);
        }
      })
      .addCase(deleteLoan.fulfilled, (state, action) => {
        const loanId = action.payload;
        delete state.loans.byId[loanId];
        state.loans.allIds = state.loans.allIds.filter((id) => id !== loanId);
      });
  },
});

export const { clearLoans } = loanPayoffSlice.actions;
export default loanPayoffSlice.reducer;
