import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

interface UIState {
  modals: {
    createBudgetPeriod: boolean;
    addTransaction: boolean;
    editCategory: boolean;
    selectTemplate: boolean;
    editIncomeSource: boolean;
    editRecurring: boolean;
    confirmation: boolean;
  };
  selectedPeriodId: string | null;
  selectedCategoryId: string | null;
  editingItemId: string | null;
  confirmationData: {
    title: string;
    message: string;
    onConfirm: string;
  } | null;
  notifications: Notification[];
  sidebarCollapsed: boolean;
}

const initialState: UIState = {
  modals: {
    createBudgetPeriod: false,
    addTransaction: false,
    editCategory: false,
    selectTemplate: false,
    editIncomeSource: false,
    editRecurring: false,
    confirmation: false,
  },
  selectedPeriodId: null,
  selectedCategoryId: null,
  editingItemId: null,
  confirmationData: null,
  notifications: [],
  sidebarCollapsed: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    openModal: (state, action: PayloadAction<keyof UIState['modals']>) => {
      state.modals[action.payload] = true;
    },
    closeModal: (state, action: PayloadAction<keyof UIState['modals']>) => {
      state.modals[action.payload] = false;
      if (action.payload === 'confirmation') {
        state.confirmationData = null;
      }
    },
    closeAllModals: (state) => {
      Object.keys(state.modals).forEach((key) => {
        state.modals[key as keyof UIState['modals']] = false;
      });
      state.confirmationData = null;
    },
    setSelectedPeriodId: (state, action: PayloadAction<string | null>) => {
      state.selectedPeriodId = action.payload;
    },
    setSelectedCategoryId: (state, action: PayloadAction<string | null>) => {
      state.selectedCategoryId = action.payload;
    },
    setEditingItemId: (state, action: PayloadAction<string | null>) => {
      state.editingItemId = action.payload;
    },
    showConfirmation: (
      state,
      action: PayloadAction<{ title: string; message: string; onConfirm: string }>
    ) => {
      state.confirmationData = action.payload;
      state.modals.confirmation = true;
    },
    addNotification: (
      state,
      action: PayloadAction<Omit<Notification, 'id'>>
    ) => {
      state.notifications.push({
        ...action.payload,
        id: Date.now().toString(),
      });
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter((n) => n.id !== action.payload);
    },
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
  },
});

export const {
  openModal,
  closeModal,
  closeAllModals,
  setSelectedPeriodId,
  setSelectedCategoryId,
  setEditingItemId,
  showConfirmation,
  addNotification,
  removeNotification,
  toggleSidebar,
} = uiSlice.actions;

export default uiSlice.reducer;
