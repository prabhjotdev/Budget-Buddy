import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { WishlistItem } from '../../types';
import * as wishlistService from '../../services/firebase/wishlistItems';

interface WishlistState {
  byId: Record<string, WishlistItem>;
  allIds: string[];
  isLoading: boolean;
  error: string | null;
}

const initialState: WishlistState = {
  byId: {},
  allIds: [],
  isLoading: false,
  error: null,
};

export const fetchWishlistItems = createAsyncThunk(
  'wishlist/fetch',
  async (userId: string, { rejectWithValue }) => {
    try {
      return await wishlistService.getWishlistItems(userId);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const createWishlistItem = createAsyncThunk(
  'wishlist/create',
  async (
    {
      userId,
      item,
    }: {
      userId: string;
      item: Omit<WishlistItem, 'id' | 'createdAt' | 'updatedAt' | 'isPurchased'>;
    },
    { rejectWithValue }
  ) => {
    try {
      const id = await wishlistService.createWishlistItem(userId, item);
      return { id, ...item, isPurchased: false };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const updateWishlistItem = createAsyncThunk(
  'wishlist/update',
  async (
    {
      userId,
      itemId,
      updates,
    }: {
      userId: string;
      itemId: string;
      updates: Partial<Omit<WishlistItem, 'id' | 'createdAt' | 'updatedAt'>>;
    },
    { rejectWithValue }
  ) => {
    try {
      await wishlistService.updateWishlistItem(userId, itemId, updates);
      return { itemId, updates };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const markWishlistItemPurchased = createAsyncThunk(
  'wishlist/markPurchased',
  async (
    { userId, itemId }: { userId: string; itemId: string },
    { rejectWithValue }
  ) => {
    try {
      await wishlistService.markItemPurchased(userId, itemId);
      return itemId;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const deleteWishlistItem = createAsyncThunk(
  'wishlist/delete',
  async ({ userId, itemId }: { userId: string; itemId: string }, { rejectWithValue }) => {
    try {
      await wishlistService.deleteWishlistItem(userId, itemId);
      return itemId;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

const organizeItems = (items: WishlistItem[]) => {
  const byId: Record<string, WishlistItem> = {};
  const allIds: string[] = [];

  // Sort: unpurchased first (needs before wants, then by priority), then purchased
  const sorted = [...items].sort((a, b) => {
    // Purchased items go to the end
    if (a.isPurchased !== b.isPurchased) {
      return a.isPurchased ? 1 : -1;
    }
    // Needs before wants
    if (a.type !== b.type) {
      return a.type === 'need' ? -1 : 1;
    }
    // By priority (high > medium > low)
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (a.priority !== b.priority) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    // By price (lower first)
    return a.price - b.price;
  });

  sorted.forEach((item) => {
    byId[item.id] = item;
    allIds.push(item.id);
  });

  return { byId, allIds };
};

const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState,
  reducers: {
    clearWishlist: (state) => {
      state.byId = {};
      state.allIds = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWishlistItems.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchWishlistItems.fulfilled, (state, action: PayloadAction<WishlistItem[]>) => {
        state.isLoading = false;
        const organized = organizeItems(action.payload);
        state.byId = organized.byId;
        state.allIds = organized.allIds;
      })
      .addCase(fetchWishlistItems.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(createWishlistItem.fulfilled, (state, action) => {
        const item = action.payload as WishlistItem;
        state.byId[item.id] = item;
        // Re-sort by re-organizing
        const items = Object.values(state.byId);
        const organized = organizeItems(items);
        state.byId = organized.byId;
        state.allIds = organized.allIds;
      })
      .addCase(updateWishlistItem.fulfilled, (state, action) => {
        const { itemId, updates } = action.payload;
        if (state.byId[itemId]) {
          state.byId[itemId] = { ...state.byId[itemId], ...updates };
          // Re-sort
          const items = Object.values(state.byId);
          const organized = organizeItems(items);
          state.byId = organized.byId;
          state.allIds = organized.allIds;
        }
      })
      .addCase(markWishlistItemPurchased.fulfilled, (state, action) => {
        const itemId = action.payload;
        if (state.byId[itemId]) {
          state.byId[itemId].isPurchased = true;
          // Re-sort
          const items = Object.values(state.byId);
          const organized = organizeItems(items);
          state.byId = organized.byId;
          state.allIds = organized.allIds;
        }
      })
      .addCase(deleteWishlistItem.fulfilled, (state, action) => {
        const itemId = action.payload;
        if (state.byId[itemId]) {
          delete state.byId[itemId];
          state.allIds = state.allIds.filter((id) => id !== itemId);
        }
      });
  },
});

export const { clearWishlist } = wishlistSlice.actions;
export default wishlistSlice.reducer;
