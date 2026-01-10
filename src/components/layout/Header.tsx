import { Menu } from 'lucide-react';
import { useAppDispatch } from '../../app/hooks';
import { openMobileMenu } from '../../features/auth/uiSlice';

interface HeaderProps {
  title: string;
}

export const Header = ({ title }: HeaderProps) => {
  const dispatch = useAppDispatch();

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 md:px-6 dark:bg-gray-800 dark:border-gray-700">
      {/* Mobile hamburger menu */}
      <button
        onClick={() => dispatch(openMobileMenu())}
        className="p-2 -ml-2 mr-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 md:hidden"
        aria-label="Open menu"
      >
        <Menu className="w-6 h-6 text-gray-600 dark:text-gray-300" />
      </button>
      <h1 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
    </header>
  );
};
