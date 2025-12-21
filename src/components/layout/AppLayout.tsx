import { ReactNode, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { fetchSettings } from '../../features/settings/settingsSlice';
import { fetchCategories } from '../../features/categories/categoriesSlice';
import { fetchBudgetPeriods, fetchAllocations, setActivePeriod } from '../../features/budget-periods/budgetPeriodsSlice';
import { fetchIncomeSources } from '../../features/income/incomeSourcesSlice';
import { fetchTemplates } from '../../features/templates/templatesSlice';
import { fetchRecurringTransactions } from '../../features/recurring/recurringSlice';
import { subscribeToActivePeriod } from '../../services/firebase/budgetPeriods';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import clsx from 'clsx';

interface AppLayoutProps {
  children: ReactNode;
  title: string;
}

export const AppLayout = ({ children, title }: AppLayoutProps) => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { sidebarCollapsed } = useAppSelector((state) => state.ui);

  useEffect(() => {
    if (user) {
      dispatch(fetchSettings(user.uid));
      dispatch(fetchCategories(user.uid));
      dispatch(fetchBudgetPeriods(user.uid));
      dispatch(fetchIncomeSources(user.uid));
      dispatch(fetchTemplates(user.uid));
      dispatch(fetchRecurringTransactions(user.uid));

      // Subscribe to active period
      const unsubscribe = subscribeToActivePeriod(
        user.uid,
        (period, allocations) => {
          dispatch(setActivePeriod({ period, allocations }));
        },
        (error) => {
          console.error('Error subscribing to active period:', error);
        }
      );

      return () => unsubscribe();
    }
  }, [dispatch, user]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div
        className={clsx('transition-all duration-300', {
          'ml-64': !sidebarCollapsed,
          'ml-20': sidebarCollapsed,
        })}
      >
        <Header title={title} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
};
