import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { LoanPayoffState, Loan } from '../../types/loanPayoff';
import { Timestamp } from 'firebase/firestore';
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

export const applyDuePayments = createAsyncThunk(
  'loanPayoff/applyDuePayments',
  async ({ userId, loans }: { userId: string; loans: Loan[] }, { rejectWithValue }) => {
    try {
      const now = new Date();
      const updatedLoans: { loanId: string; remainingBalance: number; lastPaymentDate: Timestamp }[] = [];

      for (const loan of loans) {
        if (loan.remainingBalance <= 0) continue;

        const lastPayment = loan.lastPaymentDate
          ? loan.lastPaymentDate.toDate()
          : loan.createdAt.toDate();

        // Payment day of month is anchored to the loan's creation date (e.g. created on the 15th → due on the 15th each month)
        const paymentDay = loan.createdAt.toDate().getDate();

        const rawMonthsElapsed =
          (now.getFullYear() - lastPayment.getFullYear()) * 12 +
          (now.getMonth() - lastPayment.getMonth());

        // Only count a month if today has reached or passed the payment day in that month
        const nextDueDate = new Date(
          lastPayment.getFullYear(),
          lastPayment.getMonth() + rawMonthsElapsed,
          paymentDay
        );
        const monthsElapsed = now >= nextDueDate ? rawMonthsElapsed : rawMonthsElapsed - 1;

        if (monthsElapsed <= 0) continue;

        const monthlyRate = loan.interestRate / 100 / 12;
        let balance = loan.remainingBalance;

        for (let i = 0; i < monthsElapsed; i++) {
          if (balance <= 0) break;
          const interest = balance * monthlyRate;
          balance = Math.max(0, balance + interest - loan.monthlyPayment);
        }

        balance = Math.round(balance * 100) / 100;
        if (balance === loan.remainingBalance) continue;

        // Record the actual date of the last applied payment
        const newLastPaymentDate = Timestamp.fromDate(
          new Date(lastPayment.getFullYear(), lastPayment.getMonth() + monthsElapsed, paymentDay)
        );

        await loansService.updateLoan(userId, loan.id, {
          remainingBalance: balance,
          lastPaymentDate: newLastPaymentDate,
        });

        updatedLoans.push({ loanId: loan.id, remainingBalance: balance, lastPaymentDate: newLastPaymentDate });
      }

      return updatedLoans;
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
      })
      .addCase(applyDuePayments.fulfilled, (state, action) => {
        for (const { loanId, remainingBalance, lastPaymentDate } of action.payload) {
          if (state.loans.byId[loanId]) {
            state.loans.byId[loanId].remainingBalance = remainingBalance;
            state.loans.byId[loanId].lastPaymentDate = lastPaymentDate;
          }
        }
      });
  },
});

export const { clearLoans } = loanPayoffSlice.actions;
export default loanPayoffSlice.reducer;
