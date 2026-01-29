import { useState, useEffect } from 'react';
import { Target } from 'lucide-react';
import { Modal, Button, Input, Select } from '../../../components/shared';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentGoal?: {
    goalAmount?: number;
    goalType?: 'fixed' | 'months';
    goalMonths?: number;
  };
  averageMonthlySpending: number;
  onSubmit: (goal: {
    goalAmount?: number;
    goalType?: 'fixed' | 'months';
    goalMonths?: number;
  }) => Promise<void>;
}

export const GoalModal = ({
  isOpen,
  onClose,
  currentGoal,
  averageMonthlySpending,
  onSubmit,
}: GoalModalProps) => {
  const [goalType, setGoalType] = useState<'fixed' | 'months' | 'none'>(
    currentGoal?.goalType || 'none'
  );
  const [goalAmount, setGoalAmount] = useState(
    currentGoal?.goalAmount?.toString() || ''
  );
  const [goalMonths, setGoalMonths] = useState(
    currentGoal?.goalMonths?.toString() || '3'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && currentGoal) {
      setGoalType(currentGoal.goalType || 'none');
      setGoalAmount(currentGoal.goalAmount?.toString() || '');
      setGoalMonths(currentGoal.goalMonths?.toString() || '3');
    }
  }, [isOpen, currentGoal]);

  const calculatedGoal =
    goalType === 'months'
      ? averageMonthlySpending * (parseFloat(goalMonths) || 3)
      : parseFloat(goalAmount) || 0;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (goalType === 'none') {
        await onSubmit({});
      } else if (goalType === 'fixed') {
        await onSubmit({
          goalAmount: calculatedGoal,
          goalType: 'fixed',
        });
      } else {
        await onSubmit({
          goalAmount: calculatedGoal,
          goalType: 'months',
          goalMonths: parseFloat(goalMonths) || 3,
        });
      }
      onClose();
    } catch (error) {
      console.error('Failed to update goal:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Set Emergency Fund Goal" size="md">
      <div className="space-y-5">
        {/* Goal Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Goal Type
          </label>
          <Select
            value={goalType}
            onChange={(e) => setGoalType(e.target.value as 'fixed' | 'months' | 'none')}
            options={[
              { value: 'none', label: 'No goal (just save freely)' },
              { value: 'months', label: 'Months of expenses' },
              { value: 'fixed', label: 'Fixed dollar amount' },
            ]}
          />
        </div>

        {/* Goal Amount (if fixed) */}
        {goalType === 'fixed' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Goal Amount
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                $
              </span>
              <input
                type="number"
                value={goalAmount}
                onChange={(e) => setGoalAmount(e.target.value)}
                placeholder="5000"
                step="100"
                min="0"
                className="w-full pl-10 pr-4 py-3 text-xl font-semibold border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400"
              />
            </div>
          </div>
        )}

        {/* Goal Months (if months) */}
        {goalType === 'months' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Number of Months
            </label>
            <Input
              type="number"
              value={goalMonths}
              onChange={(e) => setGoalMonths(e.target.value)}
              placeholder="3"
              step="0.5"
              min="1"
              max="12"
            />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Based on average monthly spending: ${averageMonthlySpending.toFixed(0)}
            </p>
            <p className="mt-1 text-sm font-medium text-gray-700 dark:text-gray-300">
              Goal: ${calculatedGoal.toFixed(2)}
            </p>
          </div>
        )}

        {/* Recommendation */}
        {goalType !== 'none' && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Recommendation:</strong> Financial experts suggest saving 3-6 months of
              expenses for emergencies.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={isSubmitting}
            className="bg-green-600 hover:bg-green-700"
          >
            <Target className="w-4 h-4 mr-2" />
            Save Goal
          </Button>
        </div>
      </div>
    </Modal>
  );
};
