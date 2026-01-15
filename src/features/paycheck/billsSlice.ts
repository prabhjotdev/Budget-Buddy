import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Bill, PaycheckCycle } from '../../types';
import * as billsService from '../../services/firebase/bills';
import * as paycheckCyclesService from '../../services/firebase/paycheckCycles';

interface BillsState {
  byId: Record<string, Bill>;
  allIds: string[];
  activeIds: string[];
  isLoading: boolean;
  error: string | null;
}

const initialState: BillsState = {
  byId: {},
  allIds: [],
  activeIds: [],
  isLoading: false,
  error: null,
};

export const fetchBills = createAsyncThunk(
  'bills/fetch',
  async (userId: string, { rejectWithValue }) => {
    try {
      return await billsService.getBills(userId);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const fetchActiveBills = createAsyncThunk(
  'bills/fetchActive',
  async (userId: string, { rejectWithValue }) => {
    try {
      return await billsService.getActiveBills(userId);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const createBill = createAsyncThunk(
  'bills/create',
  async (
    { userId, bill }: { userId: string; bill: Omit<Bill, 'id' | 'createdAt' | 'updatedAt'> },
    { rejectWithValue }
  ) => {
    try {
      const id = await billsService.createBill(userId, bill);
      return { id, ...bill };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const updateBill = createAsyncThunk(
  'bills/update',
  async (
    {
      userId,
      billId,
      updates,
    }: {
      userId: string;
      billId: string;
      updates: Partial<Omit<Bill, 'id' | 'createdAt' | 'updatedAt'>>;
    },
    { rejectWithValue }
  ) => {
    try {
      await billsService.updateBill(userId, billId, updates);

      // If amount or name changed, sync to active cycles
      let cycleUpdate: { cycleId: string; updates: Partial<PaycheckCycle> } | null = null;
      if (updates.amount !== undefined || updates.name !== undefined) {
        cycleUpdate = await paycheckCyclesService.syncBillAmountToActiveCycles(
          userId,
          billId,
          updates.amount!,
          updates.name
        );
      }

      return { billId, updates, cycleUpdate };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const deleteBill = createAsyncThunk(
  'bills/delete',
  async ({ userId, billId }: { userId: string; billId: string }, { rejectWithValue }) => {
    try {
      await billsService.deleteBill(userId, billId);
      return billId;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

const organizeBills = (bills: Bill[]) => {
  const byId: Record<string, Bill> = {};
  const allIds: string[] = [];
  const activeIds: string[] = [];

  // Sort by due day
  const sorted = [...bills].sort((a, b) => a.dueDay - b.dueDay);

  sorted.forEach((bill) => {
    byId[bill.id] = bill;
    allIds.push(bill.id);
    if (bill.isActive) {
      activeIds.push(bill.id);
    }
  });

  return { byId, allIds, activeIds };
};

const billsSlice = createSlice({
  name: 'bills',
  initialState,
  reducers: {
    clearBills: (state) => {
      state.byId = {};
      state.allIds = [];
      state.activeIds = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBills.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchBills.fulfilled, (state, action: PayloadAction<Bill[]>) => {
        state.isLoading = false;
        const organized = organizeBills(action.payload);
        state.byId = organized.byId;
        state.allIds = organized.allIds;
        state.activeIds = organized.activeIds;
      })
      .addCase(fetchBills.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchActiveBills.fulfilled, (state, action: PayloadAction<Bill[]>) => {
        // This only updates active bills - merge with existing
        const activeBills = action.payload;
        const activeIds: string[] = [];

        activeBills.forEach((bill) => {
          state.byId[bill.id] = bill;
          if (!state.allIds.includes(bill.id)) {
            state.allIds.push(bill.id);
          }
          activeIds.push(bill.id);
        });

        state.activeIds = activeIds;
      })
      .addCase(createBill.fulfilled, (state, action) => {
        const bill = action.payload as Bill;
        state.byId[bill.id] = bill;
        state.allIds.push(bill.id);
        if (bill.isActive) {
          state.activeIds.push(bill.id);
        }
        // Re-sort by due day
        state.allIds.sort((a, b) => state.byId[a].dueDay - state.byId[b].dueDay);
        state.activeIds.sort((a, b) => state.byId[a].dueDay - state.byId[b].dueDay);
      })
      .addCase(updateBill.fulfilled, (state, action) => {
        const { billId, updates } = action.payload;
        if (state.byId[billId]) {
          const wasActive = state.byId[billId].isActive;
          state.byId[billId] = { ...state.byId[billId], ...updates };

          // Handle active status change
          if (updates.isActive !== undefined && updates.isActive !== wasActive) {
            if (updates.isActive) {
              state.activeIds.push(billId);
              state.activeIds.sort((a, b) => state.byId[a].dueDay - state.byId[b].dueDay);
            } else {
              state.activeIds = state.activeIds.filter((id) => id !== billId);
            }
          }

          // Re-sort if dueDay changed
          if (updates.dueDay !== undefined) {
            state.allIds.sort((a, b) => state.byId[a].dueDay - state.byId[b].dueDay);
            state.activeIds.sort((a, b) => state.byId[a].dueDay - state.byId[b].dueDay);
          }
        }
      })
      .addCase(deleteBill.fulfilled, (state, action) => {
        const billId = action.payload;
        if (state.byId[billId]) {
          delete state.byId[billId];
          state.allIds = state.allIds.filter((id) => id !== billId);
          state.activeIds = state.activeIds.filter((id) => id !== billId);
        }
      });
  },
});

export const { clearBills } = billsSlice.actions;
export default billsSlice.reducer;
