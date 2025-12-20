import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { BudgetTemplate, TemplateAllocation } from '../../types';
import * as templatesService from '../../services/firebase/templates';

interface TemplatesState {
  byId: Record<string, BudgetTemplate>;
  allIds: string[];
  isLoading: boolean;
  error: string | null;
}

const initialState: TemplatesState = {
  byId: {},
  allIds: [],
  isLoading: false,
  error: null,
};

export const fetchTemplates = createAsyncThunk(
  'templates/fetch',
  async (userId: string, { rejectWithValue }) => {
    try {
      return await templatesService.getTemplates(userId);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const createTemplate = createAsyncThunk(
  'templates/create',
  async (
    {
      userId,
      template,
    }: {
      userId: string;
      template: { name: string; description: string; allocations: TemplateAllocation[]; isDefault: boolean };
    },
    { rejectWithValue }
  ) => {
    try {
      const id = await templatesService.createTemplate(userId, template);
      return { id, ...template };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const updateTemplate = createAsyncThunk(
  'templates/update',
  async (
    {
      userId,
      templateId,
      updates,
    }: {
      userId: string;
      templateId: string;
      updates: Partial<Omit<BudgetTemplate, 'id' | 'createdAt' | 'updatedAt'>>;
    },
    { rejectWithValue }
  ) => {
    try {
      await templatesService.updateTemplate(userId, templateId, updates);
      return { templateId, updates };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const deleteTemplate = createAsyncThunk(
  'templates/delete',
  async ({ userId, templateId }: { userId: string; templateId: string }, { rejectWithValue }) => {
    try {
      await templatesService.deleteTemplate(userId, templateId);
      return templateId;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

const templatesSlice = createSlice({
  name: 'templates',
  initialState,
  reducers: {
    clearTemplates: (state) => {
      state.byId = {};
      state.allIds = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTemplates.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTemplates.fulfilled, (state, action: PayloadAction<BudgetTemplate[]>) => {
        state.isLoading = false;
        state.byId = {};
        state.allIds = [];
        action.payload.forEach((template) => {
          state.byId[template.id] = template;
          state.allIds.push(template.id);
        });
      })
      .addCase(fetchTemplates.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(createTemplate.fulfilled, (state, action) => {
        const template = action.payload as BudgetTemplate;
        state.byId[template.id] = template;
        state.allIds.unshift(template.id);
      })
      .addCase(updateTemplate.fulfilled, (state, action) => {
        const { templateId, updates } = action.payload;
        if (state.byId[templateId]) {
          state.byId[templateId] = { ...state.byId[templateId], ...updates };
        }
      })
      .addCase(deleteTemplate.fulfilled, (state, action) => {
        const templateId = action.payload;
        delete state.byId[templateId];
        state.allIds = state.allIds.filter((id) => id !== templateId);
      });
  },
});

export const { clearTemplates } = templatesSlice.actions;
export default templatesSlice.reducer;
