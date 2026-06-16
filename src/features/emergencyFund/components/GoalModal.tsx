import { useState, useEffect } from 'react';
import { Target, Trash2, Lock } from 'lucide-react';
import { Modal, Button, Input, Select, ConfirmDialog } from '../../../components/shared';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentGoal?: {
    goalAmount?: number;
    goalType?: 'fixed' | 'months';
    goalMonths?: number;
  };
  averageMonthlySpending: number;
  cycleCount: number;
  onSubmit: (goal: {
    goalAmount?: number;
    goalType?: 'fixed' | 'months';
    goalMonths?: number;
  }) => Promise<void>;
}

const SMART_UNLOCK_CYCLE = 7;

export const GoalModal = ({
  isOpen,
  onClose,
  currentGoal,
  averageMonthlySpending,
  cycleCount,
  onSubmit,
}: GoalModalProps) => {
  const [goalType, setGoalType] = useState<'fixed' | 'months' | 'none'>(
    currentGoal?.goalType || 'none'
  );
  const [goalAmount, setGoalAmount] = useState(
    currentGoal?.goalAmount?.toString() || ''
  );
  const [goalMonths, setGoalMonths] = useState(
    currentGoal?.goalMonths?.toString() || '6'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const hasSmartMode = cycleCount >= SMART_UNLOCK_CYCLE;
  const cyclesRemaining = Math.max(0, SMART_UNLOCK_CYCLE - cycleCount);

  useEffect(() => {
    if (isOpen) {
      if (currentGoal) {
        setGoalType(currentGoal.goalType || 'none');
        setGoalAmount(currentGoal.goalAmount?.toString() || '');
        setGoalMonths(currentGoal.goalMonths?.toString() || '6');
      } else {
        setGoalType('none');
        setGoalAmount('');
        setGoalMonths('6');
      }
    }
  }, [isOpen, currentGoal]);

  const calculatedGoal =
    goalType === 'months'
      ? averageMonthlySpending * (parseFloat(goalMonths) || 6)
      : parseFloat(goalAmount) || 0;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (goalType === 'none') {
        // Remove goal entirely - clear all goal-related fields
        await onSubmit({
          goalAmount: undefined,
          goalType: undefined,
          goalMonths: undefined,
        });
      } else if (goalType === 'fixed') {
        // Fixed goal - clear goalMonths
        await onSubmit({
          goalAmount: calculatedGoal,
          goalType: 'fixed',
          goalMonths: undefined,
        });
      } else {
        // Months-based goal
        await onSubmit({
          goalAmount: calculatedGoal,
          goalType: 'months',
          goalMonths: parseFloat(goalMonths) || 6,
        });
      }
      onClose();
    } catch (error) {
      console.error('Failed to update goal:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveGoal = async () => {
    setShowRemoveConfirm(false);
    setIsSubmitting(true);
    try {
      await onSubmit({});
      onClose();
    } catch (error) {
      console.error('Failed to remove goal:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Build goal type options based on smart mode availability
  const goalTypeOptions = [
    { value: 'none', label: 'No goal (free-form saving)' },
    { value: 'fixed', label: 'Fixed dollar amount' },
  ];

  if (hasSmartMode) {
    goalTypeOptions.splice(1, 0, {
      value: 'months',
      label: 'Months of expenses (recommended)',
    });
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Set Emergency Fund Goal" size="md">
      <div className="space-y-5">
        {/* Smart Mode Unlock Banner */}
        {!hasSmartMode && cycleCount > 0 && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-start gap-3">
            <Lock className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-700 dark:text-yellow-300">
              <p className="font-medium">Smart Goals locked</p>
              <p className="mt-1">
                Complete {cyclesRemaining} more cycle{cyclesRemaining !== 1 ? 's' : ''} to unlock
                months-based goals and smart suggestions based on your actual spending patterns.
              </p>
            </div>
          </div>
        )}

        {/* Smart Mode Unlocked Banner */}
        {hasSmartMode && (
          <div className="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm text-green-700 dark:text-green-300">
              <strong>🎉 Smart Goals Unlocked!</strong> Based on {cycleCount} cycles, your average
              monthly spending is ${averageMonthlySpending.toFixed(0)}.
            </p>
          </div>
        )}

        {/* Goal Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Choose Your Goal Type
          </label>
          <Select
            value={goalType}
            onChange={(e) => setGoalType(e.target.value as 'fixed' | 'months' | 'none')}
            options={goalTypeOptions}
          />
        </div>

        {/* Goal Amount (if fixed) */}
        {goalType === 'fixed' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Target Amount
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                $
              </span>
              <input
                type="number"
                value={goalAmount}
                onChange={(e) => setGoalAmount(e.target.value)}
                placeholder="10000"
                step="100"
                min="0"
                autoFocus
                className="w-full pl-10 pr-4 py-3 text-xl font-semibold border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400"
              />
            </div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Set a specific dollar amount you want to save
            </p>
          </div>
        )}

        {/* Goal Months (if months) */}
        {goalType === 'months' && hasSmartMode && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Number of Months of Expenses
            </label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[3, 6, 12].map((months) => (
                <button
                  key={months}
                  type="button"
                  onClick={() => setGoalMonths(months.toString())}
                  className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                    goalMonths === months.toString()
                      ? 'border-green-500 dark:border-green-400 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  {months} months
                  <br />
                  <span className="text-xs">
                    ${(averageMonthlySpending * months).toFixed(0)}
                  </span>
                </button>
              ))}
            </div>
            <Input
              type="number"
              value={goalMonths}
              onChange={(e) => setGoalMonths(e.target.value)}
              placeholder="6"
              step="1"
              min="1"
              max="24"
              label="Or enter custom months:"
            />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Based on average monthly spending: ${averageMonthlySpending.toFixed(0)}
            </p>
            <p className="mt-1 text-sm font-medium text-green-600 dark:text-green-400">
              Goal: ${calculatedGoal.toFixed(0)}
            </p>
          </div>
        )}

        {/* Free-form info */}
        {goalType === 'none' && (
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Save money whenever you can without a specific target. You can always set a goal
              later.
            </p>
          </div>
        )}

        {/* Recommendation */}
        {goalType !== 'none' && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>💡 Recommendation:</strong> Financial experts suggest saving 3-6 months of
              expenses for most situations. Adjust based on your job stability and personal
              circumstances.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div>
            {currentGoal && currentGoal.goalAmount && (
              <Button
                variant="secondary"
                onClick={() => setShowRemoveConfirm(true)}
                disabled={isSubmitting}
                className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remove Goal
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              isLoading={isSubmitting}
              disabled={goalType === 'fixed' && !goalAmount}
              className="bg-green-600 hover:bg-green-700"
            >
              <Target className="w-4 h-4 mr-2" />
              {currentGoal?.goalAmount ? 'Update Goal' : 'Set Goal'}
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showRemoveConfirm}
        onClose={() => setShowRemoveConfirm(false)}
        onConfirm={handleRemoveGoal}
        title="Remove Emergency Fund Goal"
        message="Remove your emergency fund goal?"
        description="Your balance will remain unchanged."
        confirmLabel="Remove Goal"
        isLoading={isSubmitting}
      />
    </Modal>
  );
};
