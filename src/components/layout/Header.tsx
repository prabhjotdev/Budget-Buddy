import { NavLink, useLocation } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { useAppSelector } from '../../app/hooks';
import { ROUTES } from '../../constants';

// Maps each route to the section label shown in the desktop breadcrumb.
// Utility routes (Settings, Manage) intentionally have no section.
const sectionMap: Record<string, string> = {
  [ROUTES.PAYCHECK]:       'Overview',
  [ROUTES.SPENDING]:       'Overview',
  [ROUTES.CALENDAR]:       'Overview',
  [ROUTES.BUFFER]:         'Safety Net',
  [ROUTES.EMERGENCY_FUND]: 'Safety Net',
  [ROUTES.SAVINGS_GOALS]:  'Safety Net',
  [ROUTES.WISHLIST]:       'Planning',
  [ROUTES.HISTORY]:        'Planning',
};

interface HeaderProps {
  title: string;
}

export const Header = ({ title }: HeaderProps) => {
  const { user } = useAppSelector((state) => state.auth);
  const { pathname } = useLocation();
  const section = sectionMap[pathname];

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 dark:bg-gray-800 dark:border-gray-700">
      {/* Title + optional breadcrumb section label (desktop only) */}
      <div className="flex flex-col justify-center">
        {section && (
          <span className="hidden md:block text-xs font-semibold tracking-wider uppercase text-gray-400 dark:text-gray-500 leading-none mb-0.5">
            {section}
          </span>
        )}
        <h1 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100 leading-tight">
          {title}
        </h1>
      </div>

      {/* Mobile: avatar / settings icon — replaces old hamburger */}
      <NavLink
        to={ROUTES.SETTINGS}
        className="md:hidden p-1 rounded-full"
        aria-label="Settings"
      >
        {user?.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName || 'User'}
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
            {user?.displayName ? (
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                {user.displayName.charAt(0)}
              </span>
            ) : (
              <Settings className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            )}
          </div>
        )}
      </NavLink>
    </header>
  );
};
