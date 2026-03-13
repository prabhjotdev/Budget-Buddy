import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { VariableObligation } from '../../types';
import * as variableObligationsService from '../../services/firebase/variableObligations';

interface VariableObligationsState {
  byId: Record<string, VariableObligation>;
  allIds: string[];
  activeIds: string[];
  isLoading: boolean;
  error: string | null;
}

const initialState: VariableObligationsState = {
  byId: {},
  allIds: [],
  activeIds: [],
  isLoading: false,
  error: null,
};

export const fetchVariableObligations = createAsyncThunk(
  'variableObligations/fetch',
  async (userId: string, { rejectWithValue }) => {
    try {
      return await variableObligationsService.getVariableObligations(userId);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const createVariableObligation = createAsyncThunk(
  'variableObligations/create',
  async (
    {
      userId,
      obligation,
    }: {
      userId: string;
      obligation: Omit<VariableObligation, 'id' | 'createdAt' | 'updatedAt'>;
    },
    { rejectWithValue }
  ) => {
    try {
      const id = await variableObligationsService.createVariableObligation(userId, obligation);
      return { id, ...obligation };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const updateVariableObligation = createAsyncThunk(
  'variableObligations/update',
  async (
    {
      userId,
      obligationId,
      updates,
    }: {
      userId: string;
      obligationId: string;
      updates: Partial<Omit<VariableObligation, 'id' | 'createdAt' | 'updatedAt'>>;
    },
    { rejectWithValue }
  ) => {
    try {
      await variableObligationsService.updateVariableObligation(userId, obligationId, updates);
      return { obligationId, updates };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const deleteVariableObligation = createAsyncThunk(
  'variableObligations/delete',
  async (
    { userId, obligationId }: { userId: string; obligationId: string },
    { rejectWithValue }
  ) => {
    try {
      await variableObligationsService.deleteVariableObligation(userId, obligationId);
      return obligationId;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

const organizeObligations = (obligations: VariableObligation[]) => {
  const byId: Record<string, VariableObligation> = {};
  const allIds: string[] = [];
  const activeIds: string[] = [];

  obligations.forEach((obligation) => {
    byId[obligation.id] = obligation;
    allIds.push(obligation.id);
    if (obligation.isActive) {
      activeIds.push(obligation.id);
    }
  });

  return { byId, allIds, activeIds };
};

const variableObligationsSlice = createSlice({
  name: 'variableObligations',
  initialState,
  reducers: {
    clearVariableObligations: (state) => {
      state.byId = {};
      state.allIds = [];
      state.activeIds = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchVariableObligations.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(
        fetchVariableObligations.fulfilled,
        (state, action: PayloadAction<VariableObligation[]>) => {
          state.isLoading = false;
          const organized = organizeObligations(action.payload);
          state.byId = organized.byId;
          state.allIds = organized.allIds;
          state.activeIds = organized.activeIds;
        }
      )
      .addCase(fetchVariableObligations.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(createVariableObligation.fulfilled, (state, action) => {
        const obligation = action.payload as unknown as VariableObligation;
        state.byId[obligation.id] = obligation;
        state.allIds.push(obligation.id);
        if (obligation.isActive) {
          state.activeIds.push(obligation.id);
        }
      })
      .addCase(updateVariableObligation.fulfilled, (state, action) => {
        const { obligationId, updates } = action.payload;
        if (state.byId[obligationId]) {
          const wasActive = state.byId[obligationId].isActive;
          state.byId[obligationId] = { ...state.byId[obligationId], ...updates };
          if (updates.isActive !== undefined && updates.isActive !== wasActive) {
            if (updates.isActive) {
              state.activeIds.push(obligationId);
            } else {
              state.activeIds = state.activeIds.filter((id) => id !== obligationId);
            }
          }
        }
      })
      .addCase(deleteVariableObligation.fulfilled, (state, action) => {
        const obligationId = action.payload;
        delete state.byId[obligationId];
        state.allIds = state.allIds.filter((id) => id !== obligationId);
        state.activeIds = state.activeIds.filter((id) => id !== obligationId);
      });
  },
});

export const { clearVariableObligations } = variableObligationsSlice.actions;
export default variableObligationsSlice.reducer;
