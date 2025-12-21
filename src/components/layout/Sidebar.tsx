import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  History,
  FileText,
  Receipt,
  DollarSign,
  Settings,
  LogOut,
  Wallet,
  Menu,
} from 'lucide-react';
import clsx from 'clsx';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { signOut } from '../../features/auth/authSlice';
import { toggleSidebar } from '../../features/auth/uiSlice';
import { ROUTES } from '../../constants';

const navItems = [
  { to: ROUTES.DASHBOARD, icon: LayoutDashboard, label: 'Dashboard' },
  { to: ROUTES.BUDGET_HISTORY, icon: History, label: 'History' },
  { to: ROUTES.TEMPLATES, icon: FileText, label: 'Templates' },
  { to: ROUTES.TRANSACTIONS, icon: Receipt, label: 'Transactions' },
  { to: ROUTES.INCOME, icon: DollarSign, label: 'Income' },
  { to: ROUTES.SETTINGS, icon: Settings, label: 'Settings' },
];

export const Sidebar = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { sidebarCollapsed } = useAppSelector((state) => state.ui);

  const handleSignOut = () => {
    dispatch(signOut());
  };

  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 h-full bg-white border-r border-gray-200 transition-all duration-300 z-40',
        {
          'w-64': !sidebarCollapsed,
          'w-20': sidebarCollapsed,
        }
      )}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Wallet className="w-5 h-5 text-indigo-600" />
            </div>
            {!sidebarCollapsed && (
              <span className="font-semibold text-gray-900">Budget Buddy</span>
            )}
          </div>
          <button
            onClick={() => dispatch(toggleSidebar())}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <Menu className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                  {
                    'bg-indigo-50 text-indigo-600': isActive,
                    'text-gray-600 hover:bg-gray-100': !isActive,
                    'justify-center': sidebarCollapsed,
                  }
                )
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!sidebarCollapsed && <span className="font-medium">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-gray-200">
          <div
            className={clsx('flex items-center gap-3', {
              'justify-center': sidebarCollapsed,
            })}
          >
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName}
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                <span className="text-gray-600 font-medium">
                  {user?.displayName?.charAt(0) || 'U'}
                </span>
              </div>
            )}
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.displayName}
                </p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
            )}
          </div>
          <button
            onClick={handleSignOut}
            className={clsx(
              'mt-3 w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100',
              { 'justify-center': sidebarCollapsed }
            )}
          >
            <LogOut className="w-4 h-4" />
            {!sidebarCollapsed && <span>Sign out</span>}
          </button>
        </div>
      </div>
    </aside>
  );
};
