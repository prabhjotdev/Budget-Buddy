import { useState, useMemo, useEffect } from 'react';
import { Save, Trash2, Tag, CreditCard, X, Plus, Check } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { updateSpendingTransaction, deleteSpendingTransaction } from '../spendingTransactionsSlice';
import { updateCycleSpending } from '../paycheckCyclesSlice';
import { incrementTagUsage, createSpendingTag } from '../spendingTagsSlice';
import { Modal, Button, Input } from '../../../components/shared';
import { SpendingTransaction } from '../../../types';

// Helper to get local date string (YYYY-MM-DD) without timezone issues
const getLocalDateString = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface EditSpendingModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: SpendingTransaction | null;
}

export const EditSpendingModal = ({ isOpen, onClose, transaction }: EditSpendingModalProps) => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { byId: paymentMethodsById, allIds: paymentMethodIds } = useAppSelector(
    (state) => state.paymentMethods
  );
  const { byId: tagsById, allIds: tagIds } = useAppSelector((state) => state.spendingTags);
  const { byId: cyclesById } = useAppSelector((state) => state.paycheckCycles);

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [date, setDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Populate form when transaction changes
  useEffect(() => {
    if (isOpen && transaction) {
      setAmount(transaction.amount.toString());
      setDescription(transaction.description);
      setPaymentMethodId(transaction.paymentMethodId);
      setSelectedTagIds(transaction.tagIds);
      setDate(getLocalDateString(transaction.date.toDate()));
      setShowNewTagInput(false);
      setNewTagName('');
      setShowDeleteConfirm(false);
    }
  }, [isOpen, transaction]);

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
  const originalAmount = transaction?.amount || 0;
  const amountDifference = parsedAmount - originalAmount;

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
    if (!user || !transaction || parsedAmount <= 0) return;

    setIsSubmitting(true);
    try {
      const selectedPaymentMethod = paymentMethodsById[paymentMethodId];
      const selectedTags = selectedTagIds.map((id) => tagsById[id]).filter(Boolean);

      // Update the transaction
      // Parse date as local time (not UTC) to avoid timezone issues
      const [year, month, day] = date.split('-').map(Number);
      const localDate = new Date(year, month - 1, day, 12, 0, 0); // noon local time

      await dispatch(
        updateSpendingTransaction({
          userId: user.uid,
          transactionId: transaction.id,
          updates: {
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

      // Update cycle spending totals if amount changed
      if (amountDifference !== 0) {
        const cycle = cyclesById[transaction.cycleId];
        if (cycle) {
          const newTotalSpent = cycle.totalSpent + amountDifference;
          const newRemaining = cycle.spendingLimit - newTotalSpent;
          await dispatch(
            updateCycleSpending({
              userId: user.uid,
              cycleId: transaction.cycleId,
              totalSpent: newTotalSpent,
              remainingToSpend: newRemaining,
            })
          ).unwrap();
        }
      }

      // Increment usage for new tags
      const newTagIds = selectedTagIds.filter((id) => !transaction.tagIds.includes(id));
      for (const tagId of newTagIds) {
        dispatch(incrementTagUsage({ userId: user.uid, tagId }));
      }

      onClose();
    } catch (error) {
      console.error('Failed to update spending:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !transaction) return;

    setIsSubmitting(true);
    try {
      // Delete the transaction
      await dispatch(
        deleteSpendingTransaction({
          userId: user.uid,
          transactionId: transaction.id,
        })
      ).unwrap();

      // Update cycle spending totals
      const cycle = cyclesById[transaction.cycleId];
      if (cycle) {
        const newTotalSpent = cycle.totalSpent - transaction.amount;
        const newRemaining = cycle.spendingLimit - newTotalSpent;
        await dispatch(
          updateCycleSpending({
            userId: user.uid,
            cycleId: transaction.cycleId,
            totalSpent: newTotalSpent,
            remainingToSpend: newRemaining,
          })
        ).unwrap();
      }

      onClose();
    } catch (error) {
      console.error('Failed to delete spending:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!transaction) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Transaction" size="md">
      <div className="space-y-5">
        {/* Amount Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-xl">
              $
            </span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="w-full pl-10 pr-4 py-3 text-2xl font-semibold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
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
          <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
          <div className="flex flex-wrap gap-2">
            {paymentMethods.map((method) => (
              <button
                key={method.id}
                type="button"
                onClick={() => setPaymentMethodId(method.id)}
                className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                  paymentMethodId === method.id
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <CreditCard className="w-4 h-4 inline mr-2" />
                {method.name}
              </button>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tags (optional)</label>
          <div className="flex flex-wrap gap-2">
            {tags.slice(0, 10).map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => handleTagToggle(tag.id)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  selectedTagIds.includes(tag.id)
                    ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-300'
                    : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
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
                className="px-3 py-1.5 rounded-full text-sm bg-gray-50 text-gray-500 border-2 border-dashed border-gray-300 hover:bg-gray-100"
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
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        {/* Delete Confirmation */}
        {showDeleteConfirm ? (
          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
            <p className="text-sm text-red-700 mb-3">
              Are you sure you want to delete this transaction? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleDelete}
                isLoading={isSubmitting}
                className="bg-red-600 hover:bg-red-700"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            </div>
          </div>
        ) : (
          /* Actions */
          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="ghost"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                isLoading={isSubmitting}
                disabled={parsedAmount <= 0 || !paymentMethodId}
              >
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
