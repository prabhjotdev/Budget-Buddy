import { NavLink } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { useAppSelector } from '../../app/hooks';
import { ROUTES } from '../../constants';

interface HeaderProps {
  title: string;
}

export const Header = ({ title }: HeaderProps) => {
  const { user } = useAppSelector((state) => state.auth);

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 dark:bg-gray-800 dark:border-gray-700">
      <h1 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100">{title}</h1>

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
