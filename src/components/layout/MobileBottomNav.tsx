import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Calendar,
  Receipt,
  PiggyBank,
  MoreHorizontal,
  CalendarDays,
  Heart,
  History,
  Umbrella,
  ShieldCheck,
  ClipboardList,
  Settings,
  X,
  RefreshCw,
  Landmark,
} from 'lucide-react';
import clsx from 'clsx';
import { useAppDispatch } from '../../app/hooks';
import { signOut } from '../../features/auth/authSlice';
import { ROUTES } from '../../constants';

const primaryTabs = [
  { to: ROUTES.PAYCHECK, icon: Calendar, label: 'Home' },
  { to: ROUTES.SPENDING, icon: Receipt, label: 'Spend' },
  { to: ROUTES.SAVINGS_GOALS, icon: PiggyBank, label: 'Save' },
];

const moreItems = [
  { to: ROUTES.CALENDAR, icon: CalendarDays, label: 'Bill Calendar' },
  { to: ROUTES.SUBSCRIPTIONS, icon: RefreshCw, label: 'Subscriptions' },
  { to: ROUTES.LOAN_PAYOFF, icon: Landmark, label: 'Loan Payoff' },
  { to: ROUTES.WISHLIST, icon: Heart, label: 'Wishlist' },
  { to: ROUTES.HISTORY, icon: History, label: 'History' },
  { to: ROUTES.BUFFER, icon: Umbrella, label: 'Buffer' },
  { to: ROUTES.EMERGENCY_FUND, icon: ShieldCheck, label: 'Emergency Fund' },
  { to: ROUTES.MANAGE, icon: ClipboardList, label: 'Manage' },
  { to: ROUTES.SETTINGS, icon: Settings, label: 'Settings' },
];

// Routes reachable from the "More" sheet, used to highlight the More tab
const moreRoutes = new Set<string>(moreItems.map((i) => i.to));

export const MobileBottomNav = () => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleMoreItemClick = (to: string) => {
    setSheetOpen(false);
    navigate(to);
  };

  const handleSignOut = () => {
    setSheetOpen(false);
    dispatch(signOut());
  };

  // Detect if current path belongs to the "More" group so we can highlight the tab
  const isMoreActive = moreRoutes.has(pathname);

  return (
    <>
      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 flex items-stretch z-40 md:hidden dark:bg-gray-800 dark:border-gray-700">
        {primaryTabs.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors',
                {
                  'text-indigo-600 dark:text-indigo-400': isActive,
                  'text-gray-500 dark:text-gray-400': !isActive,
                }
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="w-5 h-5" />
                <span>{label}</span>
                {isActive && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                )}
              </>
            )}
          </NavLink>
        ))}

        {/* More tab */}
        <button
          onClick={() => setSheetOpen(true)}
          className={clsx(
            'flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors',
            {
              'text-indigo-600 dark:text-indigo-400': isMoreActive,
              'text-gray-500 dark:text-gray-400': !isMoreActive,
            }
          )}
        >
          <MoreHorizontal className="w-5 h-5" />
          <span>More</span>
          {isMoreActive && (
            <span className="absolute bottom-1 w-1 h-1 rounded-full bg-indigo-600 dark:bg-indigo-400" />
          )}
        </button>
      </nav>

      {/* "More" bottom sheet */}
      {sheetOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-50 md:hidden"
            onClick={() => setSheetOpen(false)}
          />

          {/* Sheet */}
          <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white dark:bg-gray-800 rounded-t-2xl shadow-xl animate-slide-up">
            {/* Handle + header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
              <span className="text-base font-semibold text-gray-900 dark:text-gray-100">More</span>
              <button
                onClick={() => setSheetOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <div className="border-t border-gray-100 dark:border-gray-700" />

            {/* Nav items */}
            <ul className="py-2 px-3">
              {moreItems.map(({ to, icon: Icon, label }) => (
                <li key={to}>
                  <button
                    onClick={() => handleMoreItemClick(to)}
                    className={clsx(
                      'w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors',
                      pathname === to
                        ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    )}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {label}
                  </button>
                </li>
              ))}
            </ul>

            <div className="border-t border-gray-100 dark:border-gray-700 mx-4" />

            {/* Sign out */}
            <div className="px-3 py-2 pb-8">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};
