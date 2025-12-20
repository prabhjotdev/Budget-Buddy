import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { UserSettings } from '../../types';
import * as settingsService from '../../services/firebase/settings';
import { Timestamp } from 'firebase/firestore';

interface SettingsState {
  data: UserSettings | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: SettingsState = {
  data: null,
  isLoading: false,
  error: null,
};

export const fetchSettings = createAsyncThunk(
  'settings/fetch',
  async (userId: string, { rejectWithValue }) => {
    try {
      return await settingsService.getOrCreateSettings(userId);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const updateSettings = createAsyncThunk(
  'settings/update',
  async (
    { userId, updates }: { userId: string; updates: Partial<Omit<UserSettings, 'createdAt' | 'updatedAt'>> },
    { rejectWithValue }
  ) => {
    try {
      await settingsService.updateUserSettings(userId, updates);
      return updates;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    clearSettings: (state) => {
      state.data = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSettings.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchSettings.fulfilled, (state, action: PayloadAction<UserSettings>) => {
        state.isLoading = false;
        state.data = action.payload;
      })
      .addCase(fetchSettings.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(updateSettings.fulfilled, (state, action) => {
        if (state.data) {
          state.data = {
            ...state.data,
            ...action.payload,
            updatedAt: Timestamp.now(),
          };
        }
      });
  },
});

export const { clearSettings } = settingsSlice.actions;
export default settingsSlice.reducer;
