import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { IncomeSource } from '../../types';
import * as incomeSourcesService from '../../services/firebase/incomeSources';

interface IncomeSourcesState {
  byId: Record<string, IncomeSource>;
  allIds: string[];
  isLoading: boolean;
  error: string | null;
}

const initialState: IncomeSourcesState = {
  byId: {},
  allIds: [],
  isLoading: false,
  error: null,
};

export const fetchIncomeSources = createAsyncThunk(
  'incomeSources/fetch',
  async (userId: string, { rejectWithValue }) => {
    try {
      return await incomeSourcesService.getIncomeSources(userId);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const createIncomeSource = createAsyncThunk(
  'incomeSources/create',
  async (
    {
      userId,
      source,
    }: { userId: string; source: Omit<IncomeSource, 'id' | 'createdAt' | 'updatedAt'> },
    { rejectWithValue }
  ) => {
    try {
      const id = await incomeSourcesService.createIncomeSource(userId, source);
      return { id, ...source };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const updateIncomeSource = createAsyncThunk(
  'incomeSources/update',
  async (
    {
      userId,
      sourceId,
      updates,
    }: {
      userId: string;
      sourceId: string;
      updates: Partial<Omit<IncomeSource, 'id' | 'createdAt' | 'updatedAt'>>;
    },
    { rejectWithValue }
  ) => {
    try {
      await incomeSourcesService.updateIncomeSource(userId, sourceId, updates);
      return { sourceId, updates };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const deleteIncomeSource = createAsyncThunk(
  'incomeSources/delete',
  async ({ userId, sourceId }: { userId: string; sourceId: string }, { rejectWithValue }) => {
    try {
      await incomeSourcesService.deleteIncomeSource(userId, sourceId);
      return sourceId;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

const incomeSourcesSlice = createSlice({
  name: 'incomeSources',
  initialState,
  reducers: {
    clearIncomeSources: (state) => {
      state.byId = {};
      state.allIds = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchIncomeSources.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchIncomeSources.fulfilled, (state, action: PayloadAction<IncomeSource[]>) => {
        state.isLoading = false;
        state.byId = {};
        state.allIds = [];
        action.payload.forEach((source) => {
          state.byId[source.id] = source;
          state.allIds.push(source.id);
        });
      })
      .addCase(fetchIncomeSources.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(createIncomeSource.fulfilled, (state, action) => {
        const source = action.payload as IncomeSource;
        state.byId[source.id] = source;
        state.allIds.push(source.id);
      })
      .addCase(updateIncomeSource.fulfilled, (state, action) => {
        const { sourceId, updates } = action.payload;
        if (state.byId[sourceId]) {
          state.byId[sourceId] = { ...state.byId[sourceId], ...updates };
        }
      })
      .addCase(deleteIncomeSource.fulfilled, (state, action) => {
        const sourceId = action.payload;
        delete state.byId[sourceId];
        state.allIds = state.allIds.filter((id) => id !== sourceId);
      });
  },
});

export const { clearIncomeSources } = incomeSourcesSlice.actions;
export default incomeSourcesSlice.reducer;
