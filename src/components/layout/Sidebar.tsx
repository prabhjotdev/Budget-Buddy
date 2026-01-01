import { NavLink } from 'react-router-dom';
import {
  Settings,
  LogOut,
  Wallet,
  Menu,
  Calendar,
  ShieldCheck,
  ClipboardList,
  Receipt,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { signOut } from '../../features/auth/authSlice';
import { toggleSidebar, closeMobileMenu } from '../../features/auth/uiSlice';
import { ROUTES } from '../../constants';

const navItems = [
  { to: ROUTES.PAYCHECK, icon: Calendar, label: 'Paycheck' },
  { to: ROUTES.SPENDING, icon: Receipt, label: 'Spending' },
  { to: ROUTES.BUFFER, icon: ShieldCheck, label: 'Buffer' },
  { to: ROUTES.MANAGE, icon: ClipboardList, label: 'Manage' },
  { to: ROUTES.SETTINGS, icon: Settings, label: 'Settings' },
];

export const Sidebar = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { sidebarCollapsed, mobileMenuOpen } = useAppSelector((state) => state.ui);

  const handleSignOut = () => {
    dispatch(signOut());
  };

  const handleNavClick = () => {
    // Close mobile menu when navigating
    dispatch(closeMobileMenu());
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => dispatch(closeMobileMenu())}
        />
      )}

      <aside
        className={clsx(
          'fixed left-0 top-0 h-full bg-white border-r border-gray-200 transition-all duration-300 z-50',
          // Mobile: controlled by mobileMenuOpen state
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
          'w-72 md:translate-x-0',
          // Desktop: width based on collapsed state
          {
            'md:w-64': !sidebarCollapsed,
            'md:w-20': sidebarCollapsed,
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
            {/* Always show on mobile, hide on desktop when collapsed */}
            <span className={clsx('font-semibold text-gray-900', { 'md:hidden': sidebarCollapsed })}>
              Budget Buddy
            </span>
          </div>
          {/* Desktop: toggle collapse, Mobile: close menu */}
          <button
            onClick={() => {
              if (window.innerWidth < 768) {
                dispatch(closeMobileMenu());
              } else {
                dispatch(toggleSidebar());
              }
            }}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5 text-gray-500 md:hidden" />
            ) : null}
            <Menu className="w-5 h-5 text-gray-500 hidden md:block" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={handleNavClick}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                  {
                    'bg-indigo-50 text-indigo-600': isActive,
                    'text-gray-600 hover:bg-gray-100': !isActive,
                    'md:justify-center': sidebarCollapsed,
                  }
                )
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {/* Show label on mobile always, desktop depends on collapsed state */}
              <span className={clsx('font-medium', { 'md:hidden': sidebarCollapsed, 'md:inline': !sidebarCollapsed })}>
                {item.label}
              </span>
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-gray-200">
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
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                <span className="text-gray-600 font-medium">
                  {user?.displayName?.charAt(0) || 'U'}
                </span>
              </div>
            )}
            {/* Show user info on mobile always, desktop depends on collapsed state */}
            <div className={clsx('flex-1 min-w-0', { 'md:hidden': sidebarCollapsed, 'md:block': !sidebarCollapsed })}>
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.displayName}
              </p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className={clsx(
              'mt-3 w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100',
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
