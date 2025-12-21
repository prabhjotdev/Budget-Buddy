import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Category } from '../../types';
import * as categoriesService from '../../services/firebase/categories';

interface CategoriesState {
  byId: Record<string, Category>;
  allIds: string[];
  rootIds: string[];
  childrenByParentId: Record<string, string[]>;
  isLoading: boolean;
  error: string | null;
}

const initialState: CategoriesState = {
  byId: {},
  allIds: [],
  rootIds: [],
  childrenByParentId: {},
  isLoading: false,
  error: null,
};

export const fetchCategories = createAsyncThunk(
  'categories/fetch',
  async (userId: string, { rejectWithValue }) => {
    try {
      return await categoriesService.getCategories(userId);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const createCategory = createAsyncThunk(
  'categories/create',
  async (
    { userId, category }: { userId: string; category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'> },
    { rejectWithValue }
  ) => {
    try {
      const id = await categoriesService.createCategory(userId, category);
      return { id, ...category };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const updateCategory = createAsyncThunk(
  'categories/update',
  async (
    {
      userId,
      categoryId,
      updates,
    }: { userId: string; categoryId: string; updates: Partial<Omit<Category, 'id' | 'createdAt' | 'updatedAt'>> },
    { rejectWithValue }
  ) => {
    try {
      await categoriesService.updateCategory(userId, categoryId, updates);
      return { categoryId, updates };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const deleteCategory = createAsyncThunk(
  'categories/delete',
  async ({ userId, categoryId }: { userId: string; categoryId: string }, { rejectWithValue }) => {
    try {
      await categoriesService.deleteCategory(userId, categoryId);
      return categoryId;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

const organizeCategories = (categories: Category[]) => {
  const byId: Record<string, Category> = {};
  const allIds: string[] = [];
  const rootIds: string[] = [];
  const childrenByParentId: Record<string, string[]> = {};

  categories.forEach((cat) => {
    byId[cat.id] = cat;
    allIds.push(cat.id);

    if (cat.parentId === null) {
      rootIds.push(cat.id);
    } else {
      if (!childrenByParentId[cat.parentId]) {
        childrenByParentId[cat.parentId] = [];
      }
      childrenByParentId[cat.parentId].push(cat.id);
    }
  });

  return { byId, allIds, rootIds, childrenByParentId };
};

const categoriesSlice = createSlice({
  name: 'categories',
  initialState,
  reducers: {
    clearCategories: (state) => {
      state.byId = {};
      state.allIds = [];
      state.rootIds = [];
      state.childrenByParentId = {};
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCategories.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCategories.fulfilled, (state, action: PayloadAction<Category[]>) => {
        state.isLoading = false;
        const organized = organizeCategories(action.payload);
        state.byId = organized.byId;
        state.allIds = organized.allIds;
        state.rootIds = organized.rootIds;
        state.childrenByParentId = organized.childrenByParentId;
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(createCategory.fulfilled, (state, action) => {
        const cat = action.payload as Category;
        state.byId[cat.id] = cat;
        state.allIds.push(cat.id);
        if (cat.parentId === null) {
          state.rootIds.push(cat.id);
        } else {
          if (!state.childrenByParentId[cat.parentId]) {
            state.childrenByParentId[cat.parentId] = [];
          }
          state.childrenByParentId[cat.parentId].push(cat.id);
        }
      })
      .addCase(updateCategory.fulfilled, (state, action) => {
        const { categoryId, updates } = action.payload;
        if (state.byId[categoryId]) {
          state.byId[categoryId] = { ...state.byId[categoryId], ...updates };
        }
      })
      .addCase(deleteCategory.fulfilled, (state, action) => {
        const categoryId = action.payload;
        const category = state.byId[categoryId];
        if (category) {
          delete state.byId[categoryId];
          state.allIds = state.allIds.filter((id) => id !== categoryId);
          state.rootIds = state.rootIds.filter((id) => id !== categoryId);
          if (category.parentId && state.childrenByParentId[category.parentId]) {
            state.childrenByParentId[category.parentId] = state.childrenByParentId[
              category.parentId
            ].filter((id) => id !== categoryId);
          }
        }
      });
  },
});

export const { clearCategories } = categoriesSlice.actions;
export default categoriesSlice.reducer;
