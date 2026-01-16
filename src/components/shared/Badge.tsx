import { ReactNode } from 'react';
import clsx from 'clsx';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
}

export const Badge = ({ children, variant = 'default', size = 'sm' }: BadgeProps) => {
  return (
    <span
      className={clsx(
        'inline-flex items-center font-medium rounded-full',
        {
          'px-2 py-0.5 text-xs': size === 'sm',
          'px-2.5 py-1 text-sm': size === 'md',
          'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300': variant === 'default',
          'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300': variant === 'success',
          'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300': variant === 'warning',
          'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300': variant === 'danger',
          'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300': variant === 'info',
        }
      )}
    >
      {children}
    </span>
  );
};
