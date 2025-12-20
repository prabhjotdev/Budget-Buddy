import { useState, useEffect, forwardRef, InputHTMLAttributes } from 'react';
import clsx from 'clsx';

interface CurrencyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  error?: string;
  currency?: string;
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, label, error, currency = 'USD', className, id, ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState(value.toFixed(2));
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    useEffect(() => {
      setDisplayValue(value.toFixed(2));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value.replace(/[^0-9.]/g, '');
      setDisplayValue(input);
    };

    const handleBlur = () => {
      const numValue = parseFloat(displayValue) || 0;
      onChange(numValue);
      setDisplayValue(numValue.toFixed(2));
    };

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
          <input
            ref={ref}
            id={inputId}
            type="text"
            inputMode="decimal"
            value={displayValue}
            onChange={handleChange}
            onBlur={handleBlur}
            className={clsx(
              'w-full pl-7 pr-3 py-2 border rounded-lg shadow-sm',
              'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500',
              {
                'border-gray-300': !error,
                'border-red-500 focus:ring-red-500 focus:border-red-500': error,
              },
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    );
  }
);

CurrencyInput.displayName = 'CurrencyInput';
