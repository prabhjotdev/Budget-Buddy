import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import settingsReducer from '../features/settings/settingsSlice';
import categoriesReducer from '../features/categories/categoriesSlice';
import templatesReducer from '../features/templates/templatesSlice';
import budgetPeriodsReducer from '../features/budget-periods/budgetPeriodsSlice';
import transactionsReducer from '../features/transactions/transactionsSlice';
import incomeSourcesReducer from '../features/income/incomeSourcesSlice';
import recurringReducer from '../features/recurring/recurringSlice';
import uiReducer from '../features/auth/uiSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    settings: settingsReducer,
    categories: categoriesReducer,
    templates: templatesReducer,
    budgetPeriods: budgetPeriodsReducer,
    transactions: transactionsReducer,
    incomeSources: incomeSourcesReducer,
    recurring: recurringReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          'budgetPeriods/setActivePeriod',
          'budgetPeriods/setPeriods',
          'transactions/setTransactions',
          'transactions/addTransactions',
        ],
        ignoredPaths: [
          'budgetPeriods.byId',
          'budgetPeriods.allocationsByPeriodId',
          'transactions.byId',
          'transactions.lastDoc',
        ],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
