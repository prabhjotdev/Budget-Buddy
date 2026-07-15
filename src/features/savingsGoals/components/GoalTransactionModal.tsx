import { useState } from 'react';
import { Modal, Button } from '../../../components/shared';

interface GoalTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'deposit' | 'withdrawal';
  goalName: string;
  currentBalance: number;
  onSubmit: (amount: number, description: string) => Promise<void>;
}

export const GoalTransactionModal = ({
  isOpen,
  onClose,
  type,
  goalName,
  currentBalance,
  onSubmit,
}: GoalTransactionModalProps) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) return;
    if (type === 'withdrawal' && parsedAmount > currentBalance) return;

    setIsSubmitting(true);
    try {
      await onSubmit(parsedAmount, description.trim() || `${type === 'deposit' ? 'Deposit to' : 'Withdrawal from'} ${goalName}`);
      setAmount('');
      setDescription('');
      onClose();
    } catch (error) {
      console.error(`Failed to ${type}:`, error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${type === 'deposit' ? 'Add Money to' : 'Withdraw from'} ${goalName}`}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
              $
            </span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              max={type === 'withdrawal' ? currentBalance : undefined}
              className="w-full pl-8 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          {type === 'withdrawal' && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Available: ${currentBalance.toFixed(2)}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description (optional)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={type === 'deposit' ? 'e.g., Weekly savings' : 'e.g., Partial withdrawal'}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <Button
            onClick={handleSubmit}
            disabled={!parseFloat(amount) || parseFloat(amount) <= 0 || isSubmitting}
            isLoading={isSubmitting}
            className={type === 'deposit' ? 'bg-green-600 hover:bg-green-700' : ''}
          >
            {type === 'deposit' ? 'Add Money' : 'Withdraw'}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
};
