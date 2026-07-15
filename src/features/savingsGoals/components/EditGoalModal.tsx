import { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Modal, Button, Input } from '../../../components/shared';

interface EditGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, targetAmount?: number, targetDate?: Timestamp) => Promise<void>;
  initialName: string;
  initialTargetAmount?: number;
  initialTargetDate?: Timestamp;
}

const timestampToDateString = (ts?: Timestamp): string => {
  if (!ts) return '';
  const d = ts.toDate();
  return d.toISOString().split('T')[0];
};

export const EditGoalModal = ({
  isOpen,
  onClose,
  onSubmit,
  initialName,
  initialTargetAmount,
  initialTargetDate,
}: EditGoalModalProps) => {
  const [name, setName] = useState(initialName);
  const [targetAmount, setTargetAmount] = useState(
    initialTargetAmount ? String(initialTargetAmount) : ''
  );
  const [targetDate, setTargetDate] = useState(timestampToDateString(initialTargetDate));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setTargetAmount(initialTargetAmount ? String(initialTargetAmount) : '');
      setTargetDate(timestampToDateString(initialTargetDate));
    }
  }, [isOpen, initialName, initialTargetAmount, initialTargetDate]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      const target = targetAmount ? parseFloat(targetAmount) : undefined;
      const date = targetDate ? Timestamp.fromDate(new Date(targetDate + 'T00:00:00')) : undefined;
      await onSubmit(name.trim(), target && target > 0 ? target : undefined, date);
      onClose();
    } catch (error) {
      console.error('Failed to update goal:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Savings Goal">
      <div className="space-y-4">
        <Input
          label="Goal Name"
          placeholder="e.g., Vacation, New Car, Emergency"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Target Amount (optional)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
              $
            </span>
            <input
              type="number"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              className="w-full pl-8 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Leave blank if you don't have a specific target.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Target Date (optional)
          </label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Set a deadline to see how much to save per paycheck.
          </p>
        </div>
        <div className="flex gap-3 pt-2">
          <Button onClick={handleSubmit} disabled={!name.trim() || isSubmitting} isLoading={isSubmitting}>
            Save Changes
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
};
