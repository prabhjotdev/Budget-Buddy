import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { PaymentMethod } from '../../types';
import * as paymentMethodsService from '../../services/firebase/paymentMethods';

interface PaymentMethodsState {
  byId: Record<string, PaymentMethod>;
  allIds: string[];
  defaultId: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: PaymentMethodsState = {
  byId: {},
  allIds: [],
  defaultId: null,
  isLoading: false,
  error: null,
};

export const fetchPaymentMethods = createAsyncThunk(
  'paymentMethods/fetch',
  async (userId: string, { rejectWithValue }) => {
    try {
      return await paymentMethodsService.getPaymentMethods(userId);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const createPaymentMethod = createAsyncThunk(
  'paymentMethods/create',
  async (
    {
      userId,
      paymentMethod,
    }: { userId: string; paymentMethod: Omit<PaymentMethod, 'id' | 'createdAt' | 'updatedAt'> },
    { rejectWithValue }
  ) => {
    try {
      const id = await paymentMethodsService.createPaymentMethod(userId, paymentMethod);
      return { id, ...paymentMethod };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const updatePaymentMethod = createAsyncThunk(
  'paymentMethods/update',
  async (
    {
      userId,
      paymentMethodId,
      updates,
    }: {
      userId: string;
      paymentMethodId: string;
      updates: Partial<Omit<PaymentMethod, 'id' | 'createdAt' | 'updatedAt'>>;
    },
    { rejectWithValue }
  ) => {
    try {
      await paymentMethodsService.updatePaymentMethod(userId, paymentMethodId, updates);
      return { paymentMethodId, updates };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const deletePaymentMethod = createAsyncThunk(
  'paymentMethods/delete',
  async (
    { userId, paymentMethodId }: { userId: string; paymentMethodId: string },
    { rejectWithValue }
  ) => {
    try {
      await paymentMethodsService.deletePaymentMethod(userId, paymentMethodId);
      return paymentMethodId;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const createDefaultPaymentMethods = createAsyncThunk(
  'paymentMethods/createDefaults',
  async (userId: string, { rejectWithValue }) => {
    try {
      await paymentMethodsService.createDefaultPaymentMethods(userId);
      return await paymentMethodsService.getPaymentMethods(userId);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

const organizePaymentMethods = (methods: PaymentMethod[]) => {
  const byId: Record<string, PaymentMethod> = {};
  const allIds: string[] = [];
  let defaultId: string | null = null;

  // Sort by sortOrder
  const sorted = [...methods].sort((a, b) => a.sortOrder - b.sortOrder);

  sorted.forEach((method) => {
    byId[method.id] = method;
    allIds.push(method.id);
    if (method.isDefault) {
      defaultId = method.id;
    }
  });

  return { byId, allIds, defaultId };
};

const paymentMethodsSlice = createSlice({
  name: 'paymentMethods',
  initialState,
  reducers: {
    clearPaymentMethods: (state) => {
      state.byId = {};
      state.allIds = [];
      state.defaultId = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPaymentMethods.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPaymentMethods.fulfilled, (state, action: PayloadAction<PaymentMethod[]>) => {
        state.isLoading = false;
        const organized = organizePaymentMethods(action.payload);
        state.byId = organized.byId;
        state.allIds = organized.allIds;
        state.defaultId = organized.defaultId;
      })
      .addCase(fetchPaymentMethods.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(createPaymentMethod.fulfilled, (state, action) => {
        const method = action.payload as PaymentMethod;
        state.byId[method.id] = method;
        state.allIds.push(method.id);
        if (method.isDefault) {
          // If this is the new default, update old default
          if (state.defaultId && state.byId[state.defaultId]) {
            state.byId[state.defaultId].isDefault = false;
          }
          state.defaultId = method.id;
        }
      })
      .addCase(updatePaymentMethod.fulfilled, (state, action) => {
        const { paymentMethodId, updates } = action.payload;
        if (state.byId[paymentMethodId]) {
          state.byId[paymentMethodId] = { ...state.byId[paymentMethodId], ...updates };
          // Handle default flag change
          if (updates.isDefault === true) {
            if (state.defaultId && state.defaultId !== paymentMethodId && state.byId[state.defaultId]) {
              state.byId[state.defaultId].isDefault = false;
            }
            state.defaultId = paymentMethodId;
          }
        }
      })
      .addCase(deletePaymentMethod.fulfilled, (state, action) => {
        const paymentMethodId = action.payload;
        if (state.byId[paymentMethodId]) {
          if (state.defaultId === paymentMethodId) {
            state.defaultId = null;
          }
          delete state.byId[paymentMethodId];
          state.allIds = state.allIds.filter((id) => id !== paymentMethodId);
        }
      })
      .addCase(createDefaultPaymentMethods.fulfilled, (state, action: PayloadAction<PaymentMethod[]>) => {
        const organized = organizePaymentMethods(action.payload);
        state.byId = organized.byId;
        state.allIds = organized.allIds;
        state.defaultId = organized.defaultId;
      });
  },
});

export const { clearPaymentMethods } = paymentMethodsSlice.actions;
export default paymentMethodsSlice.reducer;
