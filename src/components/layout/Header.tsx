import { Plus } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { openModal } from '../../features/auth/uiSlice';
import { Button } from '../shared';
import { formatPeriodRange } from '../../utils/date';

interface HeaderProps {
  title: string;
}

export const Header = ({ title }: HeaderProps) => {
  const dispatch = useAppDispatch();
  const { byId, activePeriodId } = useAppSelector((state) => state.budgetPeriods);
  const activePeriod = activePeriodId ? byId[activePeriodId] : null;

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        {activePeriod && (
          <p className="text-sm text-gray-500">
            Current period:{' '}
            {formatPeriodRange(
              activePeriod.startDate.toDate(),
              activePeriod.endDate.toDate()
            )}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Button
          onClick={() => dispatch(openModal('addTransaction'))}
          size="sm"
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Transaction
        </Button>
        {!activePeriod && (
          <Button
            onClick={() => dispatch(openModal('createBudgetPeriod'))}
            size="sm"
            variant="secondary"
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Period
          </Button>
        )}
      </div>
    </header>
  );
};
