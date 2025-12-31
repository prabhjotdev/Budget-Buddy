import { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { updatePaycheckCycle } from '../paycheckCyclesSlice';
import { Modal, Button } from '../../../components/shared';
import { formatCurrency } from '../../../utils/currency';

interface EditPaycheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  cycleId: string;
  currentAmount: number;
  billsTotal: number;
  minimumSave: number;
  totalSpent: number;
}

export const EditPaycheckModal = ({
  isOpen,
  onClose,
  cycleId,
  currentAmount,
  billsTotal,
  minimumSave,
  totalSpent,
}: EditPaycheckModalProps) => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const [amount, setAmount] = useState(currentAmount.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAmount(currentAmount.toString());
    }
  }, [isOpen, currentAmount]);

  const newPaycheckAmount = parseFloat(amount) || 0;
  const newSpendingLimit = Math.max(0, newPaycheckAmount - billsTotal - minimumSave);
  const newRemaining = newSpendingLimit - totalSpent;

  const handleSubmit = async () => {
    if (!user || newPaycheckAmount <= 0) return;

    setIsSubmitting(true);
    try {
      await dispatch(
        updatePaycheckCycle({
          userId: user.uid,
          cycleId,
          updates: {
            paycheckAmount: newPaycheckAmount,
            spendingLimit: newSpendingLimit,
            remainingToSpend: newRemaining,
          },
        })
      ).unwrap();
      onClose();
    } catch (error) {
      console.error('Failed to update paycheck:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Paycheck Amount">
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Paycheck Amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full pl-8 pr-4 py-3 text-xl font-semibold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Preview of changes */}
        <div className="p-4 bg-gray-50 rounded-lg space-y-2">
          <h4 className="font-medium text-gray-900 mb-3">Updated Breakdown</h4>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">New Paycheck</span>
            <span className="font-medium">{formatCurrency(newPaycheckAmount)}</span>
          </div>
          <div className="flex justify-between text-sm text-red-600">
            <span>− Bills Reserved</span>
            <span>−{formatCurrency(billsTotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-blue-600">
            <span>− Minimum Save</span>
            <span>−{formatCurrency(minimumSave)}</span>
          </div>
          <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
            <span className="font-medium text-gray-900">= New Spending Limit</span>
            <span className={`font-bold ${newSpendingLimit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(newSpendingLimit)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Already Spent</span>
            <span>−{formatCurrency(totalSpent)}</span>
          </div>
          <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
            <span className="font-medium text-gray-900">= Remaining to Spend</span>
            <span className={`font-bold ${newRemaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(newRemaining)}
            </span>
          </div>
        </div>

        {newRemaining < 0 && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">
              Warning: This will put you over budget by {formatCurrency(Math.abs(newRemaining))}.
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <Button
            onClick={handleSubmit}
            disabled={newPaycheckAmount <= 0 || isSubmitting}
            isLoading={isSubmitting}
            className="flex-1"
          >
            Update Paycheck
          </Button>
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
};
