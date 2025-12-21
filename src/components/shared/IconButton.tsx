import { ButtonHTMLAttributes, forwardRef } from 'react';
import { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  variant?: 'default' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon: Icon, variant = 'default', size = 'md', className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          'inline-flex items-center justify-center rounded-lg transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500',
          {
            'bg-gray-100 text-gray-600 hover:bg-gray-200': variant === 'default',
            'bg-red-100 text-red-600 hover:bg-red-200': variant === 'danger',
            'bg-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-700': variant === 'ghost',
            'p-1': size === 'sm',
            'p-2': size === 'md',
            'p-3': size === 'lg',
          },
          className
        )}
        {...props}
      >
        <Icon
          className={clsx({
            'w-4 h-4': size === 'sm',
            'w-5 h-5': size === 'md',
            'w-6 h-6': size === 'lg',
          })}
        />
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
