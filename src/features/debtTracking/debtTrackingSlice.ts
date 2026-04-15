import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { DebtTrackingState } from '../../types/debtTracking';
import type { Timestamp } from 'firebase/firestore';
import * as debtService from '../../services/firebase/debtTracking';

const initialState: DebtTrackingState = {
  entries: {
    byId: {},
    allIds: [],
  },
  status: 'idle',
  error: null,
};

export const fetchDebtEntries = createAsyncThunk(
  'debtTracking/fetch',
  async (userId: string, { rejectWithValue }) => {
    try {
      return await debtService.getDebtEntries(userId);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const createDebtEntry = createAsyncThunk(
  'debtTracking/create',
  async (
    {
      userId,
      entry,
    }: {
      userId: string;
      entry: {
        direction: 'i-owe' | 'they-owe';
        personName: string;
        item: string;
        description?: string;
        amount: number;
        date: Timestamp;
        isPaid: boolean;
      };
    },
    { rejectWithValue }
  ) => {
    try {
      return await debtService.createDebtEntry(userId, entry);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const updateDebtEntry = createAsyncThunk(
  'debtTracking/update',
  async (
    {
      userId,
      entryId,
      updates,
    }: {
      userId: string;
      entryId: string;
      updates: {
        direction?: 'i-owe' | 'they-owe';
        personName?: string;
        item?: string;
        description?: string;
        amount?: number;
        date?: Timestamp;
      };
    },
    { rejectWithValue }
  ) => {
    try {
      await debtService.updateDebtEntry(userId, entryId, updates);
      return { entryId, updates };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const deleteDebtEntry = createAsyncThunk(
  'debtTracking/delete',
  async ({ userId, entryId }: { userId: string; entryId: string }, { rejectWithValue }) => {
    try {
      await debtService.deleteDebtEntry(userId, entryId);
      return entryId;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const markDebtPaid = createAsyncThunk(
  'debtTracking/markPaid',
  async (
    { userId, entryId, isPaid }: { userId: string; entryId: string; isPaid: boolean },
    { rejectWithValue }
  ) => {
    try {
      const result = await debtService.markDebtPaid(userId, entryId, isPaid);
      return { entryId, ...result };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

const debtTrackingSlice = createSlice({
  name: 'debtTracking',
  initialState,
  reducers: {
    clearDebtEntries: (state) => {
      state.entries = { byId: {}, allIds: [] };
      state.status = 'idle';
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDebtEntries.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchDebtEntries.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.entries.byId = {};
        state.entries.allIds = [];
        action.payload.forEach((entry) => {
          state.entries.byId[entry.id] = entry;
          state.entries.allIds.push(entry.id);
        });
      })
      .addCase(fetchDebtEntries.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload as string;
      })
      .addCase(createDebtEntry.fulfilled, (state, action) => {
        const entry = action.payload;
        state.entries.byId[entry.id] = entry;
        state.entries.allIds.unshift(entry.id);
      })
      .addCase(updateDebtEntry.fulfilled, (state, action) => {
        const { entryId, updates } = action.payload;
        if (state.entries.byId[entryId]) {
          Object.assign(state.entries.byId[entryId], updates);
        }
      })
      .addCase(deleteDebtEntry.fulfilled, (state, action) => {
        const entryId = action.payload;
        delete state.entries.byId[entryId];
        state.entries.allIds = state.entries.allIds.filter((id) => id !== entryId);
      })
      .addCase(markDebtPaid.fulfilled, (state, action) => {
        const { entryId, isPaid, paidDate } = action.payload;
        if (state.entries.byId[entryId]) {
          state.entries.byId[entryId].isPaid = isPaid;
          if (paidDate) {
            state.entries.byId[entryId].paidDate = paidDate;
          } else {
            delete state.entries.byId[entryId].paidDate;
          }
        }
      });
  },
});

export const { clearDebtEntries } = debtTrackingSlice.actions;
export default debtTrackingSlice.reducer;
