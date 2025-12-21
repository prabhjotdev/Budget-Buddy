import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from '../constants';
import { LoginPage, AuthGuard } from '../features/auth';
import { DashboardPage } from '../features/dashboard';
import { BudgetHistoryPage } from '../features/budget-periods';
import { TransactionsPage } from '../features/transactions';
import { TemplatesPage } from '../features/templates';
import { IncomePage } from '../features/income';
import { CategoriesPage } from '../features/categories';
import { SettingsPage } from '../features/settings';
import { CreateBudgetPeriodModal, AddTransactionModal } from '../components/modals';

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={ROUTES.LOGIN} element={<LoginPage />} />
        <Route
          path={ROUTES.DASHBOARD}
          element={
            <AuthGuard>
              <DashboardPage />
              <Modals />
            </AuthGuard>
          }
        />
        <Route
          path={ROUTES.BUDGET_HISTORY}
          element={
            <AuthGuard>
              <BudgetHistoryPage />
              <Modals />
            </AuthGuard>
          }
        />
        <Route
          path={ROUTES.TRANSACTIONS}
          element={
            <AuthGuard>
              <TransactionsPage />
              <Modals />
            </AuthGuard>
          }
        />
        <Route
          path={ROUTES.TEMPLATES}
          element={
            <AuthGuard>
              <TemplatesPage />
              <Modals />
            </AuthGuard>
          }
        />
        <Route
          path={ROUTES.INCOME}
          element={
            <AuthGuard>
              <IncomePage />
              <Modals />
            </AuthGuard>
          }
        />
        <Route
          path="/categories"
          element={
            <AuthGuard>
              <CategoriesPage />
              <Modals />
            </AuthGuard>
          }
        />
        <Route
          path={ROUTES.SETTINGS}
          element={
            <AuthGuard>
              <SettingsPage />
              <Modals />
            </AuthGuard>
          }
        />
        <Route path={ROUTES.HOME} element={<Navigate to={ROUTES.DASHBOARD} replace />} />
        <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
      </Routes>
    </BrowserRouter>
  );
};

const Modals = () => (
  <>
    <CreateBudgetPeriodModal />
    <AddTransactionModal />
  </>
);
