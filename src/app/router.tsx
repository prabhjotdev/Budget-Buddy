import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from '../constants';
import { LoginPage, AuthGuard } from '../features/auth';
import { CycleDashboard, BufferManager, ManagePage, SpendingLogsPage } from '../features/paycheck/components';
import { SettingsPage } from '../features/settings';

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={ROUTES.LOGIN} element={<LoginPage />} />
        <Route
          path={ROUTES.PAYCHECK}
          element={
            <AuthGuard>
              <CycleDashboard />
            </AuthGuard>
          }
        />
        <Route
          path={ROUTES.SPENDING}
          element={
            <AuthGuard>
              <SpendingLogsPage />
            </AuthGuard>
          }
        />
        <Route
          path={ROUTES.BUFFER}
          element={
            <AuthGuard>
              <BufferManager />
            </AuthGuard>
          }
        />
        <Route
          path={ROUTES.MANAGE}
          element={
            <AuthGuard>
              <ManagePage />
            </AuthGuard>
          }
        />
        <Route
          path={ROUTES.SETTINGS}
          element={
            <AuthGuard>
              <SettingsPage />
            </AuthGuard>
          }
        />
        {/* Redirect all other routes to paycheck dashboard */}
        <Route path={ROUTES.HOME} element={<Navigate to={ROUTES.PAYCHECK} replace />} />
        <Route path="*" element={<Navigate to={ROUTES.PAYCHECK} replace />} />
      </Routes>
    </BrowserRouter>
  );
};
