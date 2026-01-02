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

// Paycheck-based system reducers
import {
  paymentMethodsReducer,
  billsReducer,
  spendingTagsReducer,
  paycheckCyclesReducer,
  spendingTransactionsReducer,
  bufferReducer,
  wishlistReducer,
} from '../features/paycheck';

export const store = configureStore({
  reducer: {
    // Legacy system
    auth: authReducer,
    settings: settingsReducer,
    categories: categoriesReducer,
    templates: templatesReducer,
    budgetPeriods: budgetPeriodsReducer,
    transactions: transactionsReducer,
    incomeSources: incomeSourcesReducer,
    recurring: recurringReducer,
    ui: uiReducer,

    // Paycheck-based system
    paymentMethods: paymentMethodsReducer,
    bills: billsReducer,
    spendingTags: spendingTagsReducer,
    paycheckCycles: paycheckCyclesReducer,
    spendingTransactions: spendingTransactionsReducer,
    buffer: bufferReducer,
    wishlist: wishlistReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          'budgetPeriods/setActivePeriod',
          'budgetPeriods/setPeriods',
          'transactions/setTransactions',
          'transactions/addTransactions',
          // Settings actions with Timestamps
          'settings/fetchSettings/fulfilled',
          'settings/updateSettings/fulfilled',
          // Paycheck system actions with Timestamps
          'paymentMethods/fetch/fulfilled',
          'paymentMethods/create/fulfilled',
          'paymentMethods/update/fulfilled',
          'bills/fetch/fulfilled',
          'bills/create/fulfilled',
          'bills/update/fulfilled',
          'spendingTags/fetch/fulfilled',
          'spendingTags/create/fulfilled',
          'spendingTags/update/fulfilled',
          'paycheckCycles/fetch/fulfilled',
          'paycheckCycles/fetchActive/fulfilled',
          'paycheckCycles/create/fulfilled',
          'spendingTransactions/fetch/fulfilled',
          'spendingTransactions/fetchByCycle/fulfilled',
          'spendingTransactions/create/fulfilled',
          'buffer/fetch/fulfilled',
          'buffer/fetchTransactions/fulfilled',
          'buffer/add/fulfilled',
          'buffer/withdraw/fulfilled',
          'buffer/initialize/fulfilled',
          'wishlist/fetch/fulfilled',
          'wishlist/create/fulfilled',
          'wishlist/update/fulfilled',
          'wishlist/markPurchased/fulfilled',
        ],
        ignoredPaths: [
          'budgetPeriods.byId',
          'budgetPeriods.allocationsByPeriodId',
          'transactions.byId',
          'transactions.lastDoc',
          // Settings paths with Timestamps
          'settings.data',
          // Paycheck system paths with Timestamps
          'paycheckCycles.byId',
          'spendingTransactions.byId',
          'buffer.buffer',
          'buffer.transactions',
          'paymentMethods.byId',
          'bills.byId',
          'spendingTags.byId',
          'wishlist.byId',
        ],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
