import clsx from 'clsx';

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  isOverBudget?: boolean;
}

export const ProgressBar = ({
  value,
  max = 100,
  color,
  showLabel = false,
  size = 'md',
  isOverBudget = false,
}: ProgressBarProps) => {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div className="w-full">
      <div
        className={clsx('w-full bg-gray-200 rounded-full overflow-hidden', {
          'h-1.5': size === 'sm',
          'h-2.5': size === 'md',
          'h-4': size === 'lg',
        })}
      >
        <div
          className={clsx('h-full rounded-full transition-all duration-300', {
            'bg-red-500': isOverBudget,
            'bg-indigo-600': !isOverBudget && !color,
          })}
          style={{
            width: `${percentage}%`,
            backgroundColor: !isOverBudget && color ? color : undefined,
          }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between mt-1 text-xs text-gray-500">
          <span>{value.toFixed(0)}%</span>
          {isOverBudget && <span className="text-red-500 font-medium">Over budget</span>}
        </div>
      )}
    </div>
  );
};
