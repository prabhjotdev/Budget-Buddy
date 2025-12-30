import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { SpendingTag } from '../../types';
import * as spendingTagsService from '../../services/firebase/spendingTags';

interface SpendingTagsState {
  byId: Record<string, SpendingTag>;
  allIds: string[];
  customIds: string[];
  isLoading: boolean;
  error: string | null;
}

const initialState: SpendingTagsState = {
  byId: {},
  allIds: [],
  customIds: [],
  isLoading: false,
  error: null,
};

export const fetchSpendingTags = createAsyncThunk(
  'spendingTags/fetch',
  async (userId: string, { rejectWithValue }) => {
    try {
      return await spendingTagsService.getSpendingTags(userId);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const createSpendingTag = createAsyncThunk(
  'spendingTags/create',
  async (
    { userId, tag }: { userId: string; tag: Omit<SpendingTag, 'id' | 'createdAt' | 'updatedAt'> },
    { rejectWithValue }
  ) => {
    try {
      const id = await spendingTagsService.createSpendingTag(userId, tag);
      return { id, ...tag };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const updateSpendingTag = createAsyncThunk(
  'spendingTags/update',
  async (
    {
      userId,
      tagId,
      updates,
    }: {
      userId: string;
      tagId: string;
      updates: Partial<Omit<SpendingTag, 'id' | 'createdAt' | 'updatedAt'>>;
    },
    { rejectWithValue }
  ) => {
    try {
      await spendingTagsService.updateSpendingTag(userId, tagId, updates);
      return { tagId, updates };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const deleteSpendingTag = createAsyncThunk(
  'spendingTags/delete',
  async ({ userId, tagId }: { userId: string; tagId: string }, { rejectWithValue }) => {
    try {
      await spendingTagsService.deleteSpendingTag(userId, tagId);
      return tagId;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const incrementTagUsage = createAsyncThunk(
  'spendingTags/incrementUsage',
  async ({ userId, tagId }: { userId: string; tagId: string }, { rejectWithValue }) => {
    try {
      await spendingTagsService.incrementTagUsage(userId, tagId);
      return tagId;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const createDefaultSpendingTags = createAsyncThunk(
  'spendingTags/createDefaults',
  async (userId: string, { rejectWithValue }) => {
    try {
      await spendingTagsService.createDefaultSpendingTags(userId);
      return await spendingTagsService.getSpendingTags(userId);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

const organizeTags = (tags: SpendingTag[]) => {
  const byId: Record<string, SpendingTag> = {};
  const allIds: string[] = [];
  const customIds: string[] = [];

  // Sort by usage count (descending) then name
  const sorted = [...tags].sort((a, b) => {
    if (b.usageCount !== a.usageCount) {
      return b.usageCount - a.usageCount;
    }
    return a.name.localeCompare(b.name);
  });

  sorted.forEach((tag) => {
    byId[tag.id] = tag;
    allIds.push(tag.id);
    if (tag.isCustom) {
      customIds.push(tag.id);
    }
  });

  return { byId, allIds, customIds };
};

const spendingTagsSlice = createSlice({
  name: 'spendingTags',
  initialState,
  reducers: {
    clearSpendingTags: (state) => {
      state.byId = {};
      state.allIds = [];
      state.customIds = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSpendingTags.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchSpendingTags.fulfilled, (state, action: PayloadAction<SpendingTag[]>) => {
        state.isLoading = false;
        const organized = organizeTags(action.payload);
        state.byId = organized.byId;
        state.allIds = organized.allIds;
        state.customIds = organized.customIds;
      })
      .addCase(fetchSpendingTags.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(createSpendingTag.fulfilled, (state, action) => {
        const tag = action.payload as SpendingTag;
        state.byId[tag.id] = tag;
        state.allIds.push(tag.id);
        if (tag.isCustom) {
          state.customIds.push(tag.id);
        }
      })
      .addCase(updateSpendingTag.fulfilled, (state, action) => {
        const { tagId, updates } = action.payload;
        if (state.byId[tagId]) {
          state.byId[tagId] = { ...state.byId[tagId], ...updates };
        }
      })
      .addCase(deleteSpendingTag.fulfilled, (state, action) => {
        const tagId = action.payload;
        if (state.byId[tagId]) {
          delete state.byId[tagId];
          state.allIds = state.allIds.filter((id) => id !== tagId);
          state.customIds = state.customIds.filter((id) => id !== tagId);
        }
      })
      .addCase(incrementTagUsage.fulfilled, (state, action) => {
        const tagId = action.payload;
        if (state.byId[tagId]) {
          state.byId[tagId].usageCount += 1;
        }
      })
      .addCase(createDefaultSpendingTags.fulfilled, (state, action: PayloadAction<SpendingTag[]>) => {
        const organized = organizeTags(action.payload);
        state.byId = organized.byId;
        state.allIds = organized.allIds;
        state.customIds = organized.customIds;
      });
  },
});

export const { clearSpendingTags } = spendingTagsSlice.actions;
export default spendingTagsSlice.reducer;
