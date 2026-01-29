import { useState, useEffect } from 'react';
import { PlusCircle, MinusCircle, AlertTriangle } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { Modal, Button, Input } from '../../../components/shared';
import { formatCurrency } from '../../../utils/currency';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'deposit' | 'withdrawal';
  currentBalance: number;
  onSubmit: (amount: number, description: string, date: Timestamp) => Promise<void>;
}

// Helper to get local date string (YYYY-MM-DD)
const getLocalDateString = (d: Date = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const TransactionModal = ({
  isOpen,
  onClose,
  type,
  currentBalance,
  onSubmit,
}: TransactionModalProps) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(getLocalDateString());
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setDescription('');
      setDate(getLocalDateString());
    }
  }, [isOpen]);

  const parsedAmount = parseFloat(amount) || 0;
  const newBalance =
    type === 'deposit' ? currentBalance + parsedAmount : currentBalance - parsedAmount;
  const isOverdraft = type === 'withdrawal' && parsedAmount > currentBalance;

  const handleSubmit = async () => {
    if (parsedAmount <= 0) return;
    if (type === 'withdrawal' && isOverdraft) return;

    setIsSubmitting(true);
    try {
      const [year, month, day] = date.split('-').map(Number);
      const localDate = new Date(year, month - 1, day, 12, 0, 0);
      await onSubmit(parsedAmount, description.trim(), Timestamp.fromDate(localDate));
      onClose();
    } catch (error) {
      console.error('Failed to submit transaction:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const Icon = type === 'deposit' ? PlusCircle : MinusCircle;
  const title = type === 'deposit' ? 'Add to Emergency Fund' : 'Withdraw from Emergency Fund';
  const buttonText = type === 'deposit' ? 'Add Money' : 'Withdraw';
  const colorClass =
    type === 'deposit'
      ? 'text-green-600 dark:text-green-400'
      : 'text-orange-600 dark:text-orange-400';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <div className="space-y-5">
        {/* Amount Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Amount
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-xl">
              $
            </span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              autoFocus
              className="w-full pl-10 pr-4 py-3 text-2xl font-semibold border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400"
            />
          </div>

          {/* Balance preview */}
          {parsedAmount > 0 && (
            <div
              className={`mt-2 p-3 rounded-lg ${
                isOverdraft
                  ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                  : 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              }`}
            >
              <div className="flex justify-between text-sm">
                <span>New balance:</span>
                <span className="font-semibold">
                  {formatCurrency(Math.max(0, newBalance))}
                </span>
              </div>
              {isOverdraft && (
                <p className="text-xs mt-1">Insufficient funds for this withdrawal</p>
              )}
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description {type === 'withdrawal' ? '(required)' : '(optional)'}
          </label>
          <Input
            placeholder={
              type === 'deposit'
                ? 'e.g., Monthly savings'
                : 'e.g., Car repair, Medical emergency'
            }
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Withdrawal warning */}
        {type === 'withdrawal' && (
          <div className="p-3 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-orange-700 dark:text-orange-300">
              <p className="font-medium">Emergency fund should only be used for true emergencies</p>
              <p className="mt-1">
                Consider if this expense can wait until your next paycheck before withdrawing.
              </p>
            </div>
          </div>
        )}

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Date
          </label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={isSubmitting}
            disabled={
              parsedAmount <= 0 ||
              (type === 'withdrawal' && (!description.trim() || isOverdraft))
            }
            className={type === 'deposit' ? 'bg-green-600 hover:bg-green-700' : ''}
          >
            <Icon className="w-4 h-4 mr-2" />
            {buttonText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
