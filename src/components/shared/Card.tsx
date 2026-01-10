import { ReactNode } from 'react';
import clsx from 'clsx';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card = ({ children, className, padding = 'md' }: CardProps) => {
  return (
    <div
      className={clsx(
        'bg-white rounded-xl shadow-sm border border-gray-200',
        'dark:bg-gray-800 dark:border-gray-700',
        {
          'p-0': padding === 'none',
          'p-3 md:p-4': padding === 'sm',
          'p-4 md:p-6': padding === 'md',
          'p-6 md:p-8': padding === 'lg',
        },
        className
      )}
    >
      {children}
    </div>
  );
};

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export const CardHeader = ({ title, subtitle, action }: CardHeaderProps) => {
  return (
    <div className="flex items-start justify-between mb-3 md:mb-4">
      <div>
        <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        {subtitle && <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
};
