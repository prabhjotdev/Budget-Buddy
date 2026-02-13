import { useState } from 'react';
import { Modal, Button, Input } from '../../../components/shared';

interface CreateGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, targetAmount?: number) => Promise<void>;
}

export const CreateGoalModal = ({ isOpen, onClose, onSubmit }: CreateGoalModalProps) => {
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      const target = targetAmount ? parseFloat(targetAmount) : undefined;
      await onSubmit(name.trim(), target && target > 0 ? target : undefined);
      setName('');
      setTargetAmount('');
      onClose();
    } catch (error) {
      console.error('Failed to create goal:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Savings Goal">
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
              className="w-full pl-8 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Leave blank if you don't have a specific target.
          </p>
        </div>
        <div className="flex gap-3 pt-2">
          <Button onClick={handleSubmit} disabled={!name.trim() || isSubmitting} isLoading={isSubmitting}>
            Create Goal
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
};
