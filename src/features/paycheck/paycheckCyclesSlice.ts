import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { PaycheckCycle } from '../../types';
import * as paycheckCyclesService from '../../services/firebase/paycheckCycles';

interface PaycheckCyclesState {
  byId: Record<string, PaycheckCycle>;
  allIds: string[];
  activeCycleId: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: PaycheckCyclesState = {
  byId: {},
  allIds: [],
  activeCycleId: null,
  isLoading: false,
  error: null,
};

export const fetchPaycheckCycles = createAsyncThunk(
  'paycheckCycles/fetch',
  async (userId: string, { rejectWithValue }) => {
    try {
      return await paycheckCyclesService.getPaycheckCycles(userId);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const fetchActiveCycle = createAsyncThunk(
  'paycheckCycles/fetchActive',
  async (userId: string, { rejectWithValue }) => {
    try {
      return await paycheckCyclesService.getActiveCycle(userId);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const createPaycheckCycle = createAsyncThunk(
  'paycheckCycles/create',
  async (
    {
      userId,
      cycle,
    }: {
      userId: string;
      cycle: Omit<PaycheckCycle, 'id' | 'createdAt' | 'updatedAt'>;
    },
    { rejectWithValue }
  ) => {
    try {
      return await paycheckCyclesService.createPaycheckCycle(userId, cycle);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const updateCycleSpending = createAsyncThunk(
  'paycheckCycles/updateSpending',
  async (
    {
      userId,
      cycleId,
      totalSpent,
      remainingToSpend,
    }: {
      userId: string;
      cycleId: string;
      totalSpent: number;
      remainingToSpend: number;
    },
    { rejectWithValue }
  ) => {
    try {
      await paycheckCyclesService.updateCycleSpending(userId, cycleId, totalSpent, remainingToSpend);
      return { cycleId, totalSpent, remainingToSpend };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const markCycleBillPaid = createAsyncThunk(
  'paycheckCycles/markBillPaid',
  async (
    {
      userId,
      cycleId,
      billId,
      isPaid,
    }: {
      userId: string;
      cycleId: string;
      billId: string;
      isPaid: boolean;
    },
    { rejectWithValue }
  ) => {
    try {
      await paycheckCyclesService.markCycleBillPaid(userId, cycleId, billId, isPaid);
      return { cycleId, billId, isPaid };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const completeCycle = createAsyncThunk(
  'paycheckCycles/complete',
  async (
    {
      userId,
      cycleId,
      actualSaved,
      bufferContribution,
      reflection,
    }: {
      userId: string;
      cycleId: string;
      actualSaved: number;
      bufferContribution: number;
      reflection?: string;
    },
    { rejectWithValue }
  ) => {
    try {
      await paycheckCyclesService.completeCycle(
        userId,
        cycleId,
        actualSaved,
        bufferContribution,
        reflection
      );
      return { cycleId, actualSaved, bufferContribution, reflection };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

const organizeCycles = (cycles: PaycheckCycle[]) => {
  const byId: Record<string, PaycheckCycle> = {};
  const allIds: string[] = [];
  let activeCycleId: string | null = null;

  // Sort by start date (descending - most recent first)
  const sorted = [...cycles].sort((a, b) => {
    const aTime = a.startDate.toDate().getTime();
    const bTime = b.startDate.toDate().getTime();
    return bTime - aTime;
  });

  sorted.forEach((cycle) => {
    byId[cycle.id] = cycle;
    allIds.push(cycle.id);
    if (cycle.status === 'active') {
      activeCycleId = cycle.id;
    }
  });

  return { byId, allIds, activeCycleId };
};

const paycheckCyclesSlice = createSlice({
  name: 'paycheckCycles',
  initialState,
  reducers: {
    clearPaycheckCycles: (state) => {
      state.byId = {};
      state.allIds = [];
      state.activeCycleId = null;
    },
    setActiveCycleId: (state, action: PayloadAction<string | null>) => {
      state.activeCycleId = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPaycheckCycles.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPaycheckCycles.fulfilled, (state, action: PayloadAction<PaycheckCycle[]>) => {
        state.isLoading = false;
        const organized = organizeCycles(action.payload);
        state.byId = organized.byId;
        state.allIds = organized.allIds;
        state.activeCycleId = organized.activeCycleId;
      })
      .addCase(fetchPaycheckCycles.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchActiveCycle.fulfilled, (state, action: PayloadAction<PaycheckCycle | null>) => {
        if (action.payload) {
          const cycle = action.payload;
          state.byId[cycle.id] = cycle;
          if (!state.allIds.includes(cycle.id)) {
            state.allIds.unshift(cycle.id);
          }
          state.activeCycleId = cycle.id;
        } else {
          state.activeCycleId = null;
        }
      })
      .addCase(createPaycheckCycle.fulfilled, (state, action: PayloadAction<PaycheckCycle>) => {
        const cycle = action.payload;
        state.byId[cycle.id] = cycle;
        state.allIds.unshift(cycle.id);
        if (cycle.status === 'active') {
          // Deactivate previous active cycle
          if (state.activeCycleId && state.byId[state.activeCycleId]) {
            state.byId[state.activeCycleId].status = 'completed';
          }
          state.activeCycleId = cycle.id;
        }
      })
      .addCase(updateCycleSpending.fulfilled, (state, action) => {
        const { cycleId, totalSpent, remainingToSpend } = action.payload;
        if (state.byId[cycleId]) {
          state.byId[cycleId].totalSpent = totalSpent;
          state.byId[cycleId].remainingToSpend = remainingToSpend;
        }
      })
      .addCase(markCycleBillPaid.fulfilled, (state, action) => {
        const { cycleId, billId, isPaid } = action.payload;
        if (state.byId[cycleId]) {
          const cycle = state.byId[cycleId];
          const billEntry = cycle.bills.find((b) => b.billId === billId);
          if (billEntry) {
            billEntry.isPaid = isPaid;
          }
        }
      })
      .addCase(completeCycle.fulfilled, (state, action) => {
        const { cycleId, actualSaved, bufferContribution, reflection } = action.payload;
        if (state.byId[cycleId]) {
          state.byId[cycleId].status = 'completed';
          state.byId[cycleId].actualSaved = actualSaved;
          state.byId[cycleId].bufferContribution = bufferContribution;
          if (reflection) {
            state.byId[cycleId].reflection = reflection;
          }
          if (state.activeCycleId === cycleId) {
            state.activeCycleId = null;
          }
        }
      });
  },
});

export const { clearPaycheckCycles, setActiveCycleId } = paycheckCyclesSlice.actions;
export default paycheckCyclesSlice.reducer;
