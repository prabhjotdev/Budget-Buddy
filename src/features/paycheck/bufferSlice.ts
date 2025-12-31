import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Timestamp } from 'firebase/firestore';
import { Buffer, BufferTransaction } from '../../types';
import * as bufferService from '../../services/firebase/buffer';

interface BufferState {
  buffer: Buffer | null;
  transactions: BufferTransaction[];
  isLoading: boolean;
  error: string | null;
}

const initialState: BufferState = {
  buffer: null,
  transactions: [],
  isLoading: false,
  error: null,
};

export const fetchBuffer = createAsyncThunk(
  'buffer/fetch',
  async (userId: string, { rejectWithValue }) => {
    try {
      return await bufferService.getBuffer(userId);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const fetchBufferTransactions = createAsyncThunk(
  'buffer/fetchTransactions',
  async (
    { userId, limit }: { userId: string; limit?: number },
    { rejectWithValue }
  ) => {
    try {
      return await bufferService.getBufferTransactions(userId, limit);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const addToBuffer = createAsyncThunk(
  'buffer/add',
  async (
    {
      userId,
      amount,
      reason,
      cycleId,
    }: {
      userId: string;
      amount: number;
      reason: string;
      cycleId?: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const { newTotal, transactionId } = await bufferService.addToBuffer(
        userId,
        amount,
        reason,
        cycleId
      );
      return {
        newTotal,
        transaction: {
          id: transactionId,
          type: 'deposit' as const,
          amount,
          reason,
          cycleId: cycleId || null,
        },
      };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const withdrawFromBuffer = createAsyncThunk(
  'buffer/withdraw',
  async (
    {
      userId,
      amount,
      reason,
      cycleId,
    }: {
      userId: string;
      amount: number;
      reason: string;
      cycleId?: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const { newTotal, transactionId } = await bufferService.withdrawFromBuffer(
        userId,
        amount,
        reason,
        cycleId
      );
      return {
        newTotal,
        transaction: {
          id: transactionId,
          type: 'withdrawal' as const,
          amount,
          reason,
          cycleId: cycleId || null,
        },
      };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const initializeBuffer = createAsyncThunk(
  'buffer/initialize',
  async (
    { userId, initialAmount }: { userId: string; initialAmount?: number },
    { rejectWithValue }
  ) => {
    try {
      return await bufferService.initializeBuffer(userId, initialAmount);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

const bufferSlice = createSlice({
  name: 'buffer',
  initialState,
  reducers: {
    clearBuffer: (state) => {
      state.buffer = null;
      state.transactions = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBuffer.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchBuffer.fulfilled, (state, action: PayloadAction<Buffer | null>) => {
        state.isLoading = false;
        state.buffer = action.payload;
      })
      .addCase(fetchBuffer.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(
        fetchBufferTransactions.fulfilled,
        (state, action: PayloadAction<BufferTransaction[]>) => {
          state.transactions = action.payload;
        }
      )
      .addCase(addToBuffer.fulfilled, (state, action) => {
        const { newTotal, transaction } = action.payload;
        if (state.buffer) {
          state.buffer.totalAmount = newTotal;
        } else {
          state.buffer = {
            totalAmount: newTotal,
            updatedAt: { toDate: () => new Date() } as unknown as Timestamp,
          };
        }
        // Add transaction to the beginning of the list
        state.transactions.unshift({
          ...transaction,
          createdAt: { toDate: () => new Date() } as unknown as Timestamp,
        });
      })
      .addCase(withdrawFromBuffer.fulfilled, (state, action) => {
        const { newTotal, transaction } = action.payload;
        if (state.buffer) {
          state.buffer.totalAmount = newTotal;
        }
        // Add transaction to the beginning of the list
        state.transactions.unshift({
          ...transaction,
          createdAt: { toDate: () => new Date() } as unknown as Timestamp,
        });
      })
      .addCase(initializeBuffer.fulfilled, (state, action: PayloadAction<Buffer>) => {
        state.buffer = action.payload;
      });
  },
});

export const { clearBuffer } = bufferSlice.actions;
export default bufferSlice.reducer;
