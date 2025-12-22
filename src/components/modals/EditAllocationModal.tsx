import { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { closeModal } from '../../features/auth/uiSlice';
import { updateAllocation } from '../../services/firebase/budgetPeriods';
import { fetchAllocations } from '../../features/budget-periods/budgetPeriodsSlice';
import { Modal, Button, CurrencyInput, Input } from '../shared';
import { formatCurrency } from '../../utils/currency';
import { BudgetAllocation } from '../../types';

interface EditAllocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  allocation: BudgetAllocation | null;
  periodId: string | null;
}

export const EditAllocationModal = ({ isOpen, onClose, allocation, periodId }: EditAllocationModalProps) => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  const [budgetedAmount, setBudgetedAmount] = useState(0);
  const [note, setNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (allocation) {
      setBudgetedAmount(allocation.budgetedAmount);
      setNote(allocation.note || '');
    }
  }, [allocation]);

  const handleSave = async () => {
    if (!user || !allocation || !periodId) return;

    setIsLoading(true);
    try {
      await updateAllocation(user.uid, periodId, allocation.id, {
        budgetedAmount,
        remainingAmount: budgetedAmount - allocation.spentAmount,
        note,
      });

      // Refresh allocations
      dispatch(fetchAllocations({ userId: user.uid, periodId }));
      onClose();
    } catch (error) {
      console.error('Failed to update allocation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!allocation) return null;

  const newRemaining = budgetedAmount - allocation.spentAmount;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Category Budget" size="md">
      <div className="space-y-4">
        {/* Category Info */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: allocation.categoryColor + '20' }}
          >
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: allocation.categoryColor }}
            />
          </div>
          <div>
            <p className="font-medium text-gray-900">{allocation.categoryName}</p>
            <p className="text-sm text-gray-500">
              Spent: {formatCurrency(allocation.spentAmount)}
            </p>
          </div>
        </div>

        {/* Budget Amount */}
        <CurrencyInput
          label="Budgeted Amount"
          value={budgetedAmount}
          onChange={setBudgetedAmount}
        />

        {/* Note */}
        <Input
          label="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g., Increased for holiday spending"
        />

        {/* Preview */}
        <div className="p-3 bg-gray-50 rounded-lg space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">New Budget</span>
            <span className="font-medium">{formatCurrency(budgetedAmount)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Already Spent</span>
            <span className="font-medium text-red-600">-{formatCurrency(allocation.spentAmount)}</span>
          </div>
          <div className="flex justify-between text-sm font-medium border-t pt-2">
            <span>Remaining</span>
            <span className={newRemaining < 0 ? 'text-red-600' : 'text-green-600'}>
              {formatCurrency(newRemaining)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} isLoading={isLoading}>
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  );
};
