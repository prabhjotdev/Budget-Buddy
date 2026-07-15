import { InputHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            'w-full px-3 py-2.5 md:py-2 border rounded-lg shadow-sm text-base md:text-sm',
            'focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500',
            'placeholder:text-gray-400 dark:placeholder:text-gray-500',
            'dark:bg-gray-700 dark:text-gray-100',
            {
              'border-gray-300 dark:border-gray-600': !error,
              'border-red-500 focus:ring-red-500 focus:border-red-500': error,
            },
            className
          )}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
