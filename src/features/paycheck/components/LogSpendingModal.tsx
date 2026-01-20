import { useState, useMemo, useEffect } from 'react';
import { DollarSign, Tag, CreditCard, X, Plus, Check } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { createSpendingTransaction } from '../spendingTransactionsSlice';
import { updateCycleSpending } from '../paycheckCyclesSlice';
import { incrementTagUsage, createSpendingTag } from '../spendingTagsSlice';
import { Modal, Button, Input } from '../../../components/shared';
import { formatCurrency } from '../../../utils/currency';

interface LogSpendingModalProps {
  isOpen: boolean;
  onClose: () => void;
  cycleId: string;
  currentSpent: number;
  spendingLimit: number;
}

// Helper to get local date string (YYYY-MM-DD) without timezone issues
const getLocalDateString = (d: Date = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const LogSpendingModal = ({
  isOpen,
  onClose,
  cycleId,
  currentSpent,
  spendingLimit,
}: LogSpendingModalProps) => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { byId: paymentMethodsById, allIds: paymentMethodIds, defaultId } = useAppSelector(
    (state) => state.paymentMethods
  );
  const { byId: tagsById, allIds: tagIds } = useAppSelector((state) => state.spendingTags);

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState(defaultId || '');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [date, setDate] = useState(getLocalDateString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setDescription('');
      setPaymentMethodId(defaultId || paymentMethodIds[0] || '');
      setSelectedTagIds([]);
      setDate(getLocalDateString());
      setShowNewTagInput(false);
      setNewTagName('');
    }
  }, [isOpen, defaultId, paymentMethodIds]);

  const paymentMethods = useMemo(() => {
    return paymentMethodIds.map((id) => paymentMethodsById[id]).filter(Boolean);
  }, [paymentMethodIds, paymentMethodsById]);

  const tags = useMemo(() => {
    return tagIds
      .map((id) => tagsById[id])
      .filter(Boolean)
      .sort((a, b) => b.usageCount - a.usageCount);
  }, [tagIds, tagsById]);

  const parsedAmount = parseFloat(amount) || 0;
  const newTotal = currentSpent + parsedAmount;
  const newRemaining = spendingLimit - newTotal;
  const isOverBudget = newRemaining < 0;

  const handleTagToggle = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleAddNewTag = async () => {
    if (!user || !newTagName.trim()) return;

    try {
      const result = await dispatch(
        createSpendingTag({
          userId: user.uid,
          tag: {
            name: newTagName.trim().toLowerCase(),
            isCustom: true,
            usageCount: 0,
          },
        })
      ).unwrap();

      // Select the new tag
      if (result.id) {
        setSelectedTagIds((prev) => [...prev, result.id]);
      }
      setNewTagName('');
      setShowNewTagInput(false);
    } catch (error) {
      console.error('Failed to create tag:', error);
    }
  };

  const handleSubmit = async () => {
    if (!user || !cycleId || parsedAmount <= 0) return;

    setIsSubmitting(true);
    try {
      const selectedPaymentMethod = paymentMethodsById[paymentMethodId];
      const selectedTags = selectedTagIds.map((id) => tagsById[id]).filter(Boolean);

      // Create the transaction
      // Parse date as local time (not UTC) to avoid timezone issues
      const [year, month, day] = date.split('-').map(Number);
      const localDate = new Date(year, month - 1, day, 12, 0, 0); // noon local time

      await dispatch(
        createSpendingTransaction({
          userId: user.uid,
          transaction: {
            cycleId,
            amount: parsedAmount,
            description: description.trim(),
            paymentMethodId,
            paymentMethodName: selectedPaymentMethod?.name || 'Unknown',
            tagIds: selectedTagIds,
            tagNames: selectedTags.map((t) => t.name),
            date: Timestamp.fromDate(localDate),
          },
        })
      ).unwrap();

      // Update cycle spending totals
      await dispatch(
        updateCycleSpending({
          userId: user.uid,
          cycleId,
          totalSpent: newTotal,
          remainingToSpend: newRemaining,
        })
      ).unwrap();

      // Increment tag usage counts
      for (const tagId of selectedTagIds) {
        dispatch(incrementTagUsage({ userId: user.uid, tagId }));
      }

      onClose();
    } catch (error) {
      console.error('Failed to log spending:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Log Spending" size="md">
      <div className="space-y-5">
        {/* Amount Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount</label>
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
              className="w-full pl-10 pr-4 py-3 text-2xl font-semibold border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
            />
          </div>

          {/* Remaining preview */}
          {parsedAmount > 0 && (
            <div
              className={`mt-2 p-3 rounded-lg ${
                isOverBudget ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              }`}
            >
              <div className="flex justify-between text-sm">
                <span>After this:</span>
                <span className="font-semibold">
                  {formatCurrency(Math.max(0, newRemaining))} remaining
                </span>
              </div>
              {isOverBudget && (
                <p className="text-xs mt-1">
                  This will put you ${Math.abs(newRemaining).toFixed(2)} over your limit
                </p>
              )}
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description (optional)
          </label>
          <Input
            placeholder="What was this for?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Payment Method */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Payment Method</label>
          <div className="flex flex-wrap gap-2">
            {paymentMethods.map((method) => (
              <button
                key={method.id}
                type="button"
                onClick={() => setPaymentMethodId(method.id)}
                className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                  paymentMethodId === method.id
                    ? 'border-indigo-500 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                    : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <CreditCard className="w-4 h-4 inline mr-2" />
                {method.name}
              </button>
            ))}
          </div>
          {paymentMethods.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No payment methods set up. Add them in Settings.
            </p>
          )}
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tags (optional)</label>
          <div className="flex flex-wrap gap-2">
            {tags.slice(0, 10).map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => handleTagToggle(tag.id)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  selectedTagIds.includes(tag.id)
                    ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-2 border-indigo-300 dark:border-indigo-600'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-2 border-transparent hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Tag className="w-3 h-3 inline mr-1" />
                {tag.name}
              </button>
            ))}
            {!showNewTagInput && (
              <button
                type="button"
                onClick={() => setShowNewTagInput(true)}
                className="px-3 py-1.5 rounded-full text-sm bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Plus className="w-3 h-3 inline mr-1" />
                Add tag
              </button>
            )}
          </div>

          {/* New Tag Input */}
          {showNewTagInput && (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value.toLowerCase())}
                placeholder="New tag name"
                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddNewTag();
                  }
                }}
              />
              <Button size="sm" onClick={handleAddNewTag} disabled={!newTagName.trim()}>
                <Check className="w-4 h-4" />
              </Button>
              <button
                type="button"
                onClick={() => {
                  setShowNewTagInput(false);
                  setNewTagName('');
                }}
                className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={isSubmitting}
            disabled={parsedAmount <= 0 || !paymentMethodId}
          >
            <DollarSign className="w-4 h-4 mr-2" />
            Log Spending
          </Button>
        </div>
      </div>
    </Modal>
  );
};
