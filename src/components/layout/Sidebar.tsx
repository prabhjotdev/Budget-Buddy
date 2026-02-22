import { NavLink, useLocation } from 'react-router-dom';
import {
  Settings,
  LogOut,
  Wallet,
  Menu,
  Calendar,
  CalendarDays,
  ShieldCheck,
  ClipboardList,
  Receipt,
  Heart,
  History,
  Target,
  Umbrella,
} from 'lucide-react';
import clsx from 'clsx';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { signOut } from '../../features/auth/authSlice';
import { toggleSidebar } from '../../features/auth/uiSlice';
import { ROUTES } from '../../constants';

const navGroups = [
  {
    label: 'OVERVIEW',
    items: [
      { to: ROUTES.PAYCHECK, icon: Calendar, label: 'Paycheck' },
      { to: ROUTES.SPENDING, icon: Receipt, label: 'Spending' },
      { to: ROUTES.CALENDAR, icon: CalendarDays, label: 'Bill Calendar' },
    ],
  },
  {
    label: 'SAFETY NET',
    items: [
      { to: ROUTES.BUFFER, icon: Umbrella, label: 'Buffer' },
      { to: ROUTES.EMERGENCY_FUND, icon: ShieldCheck, label: 'Emergency Fund' },
      { to: ROUTES.SAVINGS_GOALS, icon: Target, label: 'Savings Goals' },
    ],
  },
  {
    label: 'PLANNING',
    items: [
      { to: ROUTES.WISHLIST, icon: Heart, label: 'Wishlist' },
      { to: ROUTES.HISTORY, icon: History, label: 'History' },
    ],
  },
];

const utilityItems = [
  { to: ROUTES.SETTINGS, icon: Settings, label: 'Settings' },
  { to: ROUTES.MANAGE, icon: ClipboardList, label: 'Manage' },
];

export const Sidebar = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { sidebarCollapsed } = useAppSelector((state) => state.ui);
  const { pathname } = useLocation();

  const activeGroupLabel = navGroups.find((g) =>
    g.items.some((i) => i.to === pathname)
  )?.label;

  const handleSignOut = () => {
    dispatch(signOut());
  };

  const renderNavLink = (item: { to: string; icon: React.ElementType; label: string }) => (
    <NavLink
      key={item.to}
      to={item.to}
      title={sidebarCollapsed ? item.label : undefined}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
          {
            'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400': isActive,
            'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700': !isActive,
            'md:justify-center': sidebarCollapsed,
          }
        )
      }
    >
      <item.icon className="w-5 h-5 flex-shrink-0" />
      <span className={clsx('font-medium', { 'md:hidden': sidebarCollapsed, 'md:inline': !sidebarCollapsed })}>
        {item.label}
      </span>
    </NavLink>
  );

  return (
    <>
      <aside
        className={clsx(
          'fixed left-0 top-0 h-full bg-white border-r border-gray-200 transition-all duration-300 z-50',
          'dark:bg-gray-800 dark:border-gray-700',
          // Hidden on mobile — navigation is handled by MobileBottomNav
          'hidden md:flex md:flex-col',
          {
            'md:w-64': !sidebarCollapsed,
            'md:w-20': sidebarCollapsed,
          }
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className={clsx(
            'flex items-center h-16 px-4 border-b border-gray-200 dark:border-gray-700',
            {
              'justify-between': !sidebarCollapsed,
              'md:justify-center md:px-2': sidebarCollapsed,
            }
          )}>
            <div className={clsx('flex items-center gap-3', { 'md:hidden': sidebarCollapsed })}>
              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center">
                <Wallet className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <span className={clsx('font-semibold text-gray-900 dark:text-gray-100', { 'md:hidden': sidebarCollapsed })}>
                Budget Buddy
              </span>
            </div>
            <button
              onClick={() => dispatch(toggleSidebar())}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Menu className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-4 px-3 space-y-4 overflow-y-auto">
            {navGroups.map((group, groupIndex) => (
              <div key={group.label}>
                {groupIndex > 0 && (
                  <div className={clsx(
                    'border-t border-gray-100 dark:border-gray-700',
                    { 'mx-1 mb-3': !sidebarCollapsed, 'mx-2 mb-3': sidebarCollapsed }
                  )} />
                )}
                {/* Section label — animates in/out when sidebar collapses */}
                <div className={clsx(
                  'overflow-hidden transition-all duration-300',
                  sidebarCollapsed ? 'max-h-0 mb-0 opacity-0' : 'max-h-8 mb-1 opacity-100'
                )}>
                  <p className={clsx(
                    'px-3 text-xs font-semibold tracking-wider uppercase transition-colors duration-200',
                    activeGroupLabel === group.label
                      ? 'text-indigo-500 dark:text-indigo-400'
                      : 'text-gray-400 dark:text-gray-500'
                  )}>
                    {group.label}
                  </p>
                </div>
                <div className="space-y-1">
                  {group.items.map(renderNavLink)}
                </div>
              </div>
            ))}
          </nav>

          {/* Utility items (Settings, Manage) */}
          <div className="px-3 pb-2 border-t border-gray-100 dark:border-gray-700 pt-2">
            <div className="space-y-1">
              {utilityItems.map(renderNavLink)}
            </div>
          </div>

          {/* User */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div
              className={clsx('flex items-center gap-3', {
                'md:justify-center': sidebarCollapsed,
              })}
            >
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                  <span className="text-gray-600 dark:text-gray-300 font-medium">
                    {user?.displayName?.charAt(0) || 'U'}
                  </span>
                </div>
              )}
              <div className={clsx('flex-1 min-w-0', { 'md:hidden': sidebarCollapsed, 'md:block': !sidebarCollapsed })}>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {user?.displayName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className={clsx(
                'mt-3 w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700',
                { 'md:justify-center': sidebarCollapsed }
              )}
            >
              <LogOut className="w-4 h-4" />
              <span className={clsx({ 'md:hidden': sidebarCollapsed, 'md:inline': !sidebarCollapsed })}>
                Sign out
              </span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
