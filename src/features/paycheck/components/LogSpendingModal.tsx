import { useState, useMemo, useEffect } from 'react';
import { DollarSign, Tag, CreditCard, X, Plus, Check, ShoppingCart } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { createSpendingTransaction } from '../spendingTransactionsSlice';
import { updateCycleSpending, updateCycleObligationSpending } from '../paycheckCyclesSlice';
import { incrementTagUsage, createSpendingTag } from '../spendingTagsSlice';
import { Modal, Button, Input } from '../../../components/shared';
import { formatCurrency } from '../../../utils/currency';
import { CycleVariableObligationEntry } from '../../../types';

interface LogSpendingModalProps {
  isOpen: boolean;
  onClose: () => void;
  cycleId: string;
  /** Discretionary spent (totalSpent - variableObligationsSpent) — used for the preview */
  currentSpent: number;
  /** Full total across all spending — used for credit card reconciliation tracking */
  totalSpentInCycle: number;
  spendingLimit: number;
  variableObligations?: CycleVariableObligationEntry[];
  variableObligationsSpent?: number;
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
  totalSpentInCycle,
  spendingLimit,
  variableObligations = [],
  variableObligationsSpent = 0,
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
  const [selectedObligationId, setSelectedObligationId] = useState<string>('');
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
      setSelectedObligationId('');
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

  // Preview: only show discretionary impact when it's a discretionary transaction
  const isObligationTransaction = !!selectedObligationId;
  const newDiscretionaryTotal = isObligationTransaction ? currentSpent : currentSpent + parsedAmount;
  const newRemaining = spendingLimit - newDiscretionaryTotal;
  const isOverBudget = newRemaining < 0;

  // For obligation: show obligation budget progress
  const selectedObligation = variableObligations.find(
    (o) => o.obligationId === selectedObligationId
  );
  const newObligationSpent = selectedObligation
    ? selectedObligation.amountSpent + parsedAmount
    : 0;
  const obligationOver = selectedObligation
    ? newObligationSpent > selectedObligation.estimatedAmount
    : false;

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
    if (!user || !cycleId || parsedAmount <= 0) return;

    setIsSubmitting(true);
    try {
      const selectedPaymentMethod = paymentMethodsById[paymentMethodId];
      const selectedTags = selectedTagIds.map((id) => tagsById[id]).filter(Boolean);

      const [year, month, day] = date.split('-').map(Number);
      const localDate = new Date(year, month - 1, day, 12, 0, 0);

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
            variableObligationId: selectedObligationId || null,
            variableObligationName: selectedObligation?.obligationName || null,
          },
        })
      ).unwrap();

      if (isObligationTransaction && selectedObligation) {
        // Obligation transaction: update obligation tracking, keep remainingToSpend unchanged
        await dispatch(
          updateCycleObligationSpending({
            userId: user.uid,
            cycleId,
            obligationId: selectedObligation.obligationId,
            newObligationAmountSpent: selectedObligation.amountSpent + parsedAmount,
            newVariableObligationsSpent: variableObligationsSpent + parsedAmount,
            newTotalSpent: totalSpentInCycle + parsedAmount,
          })
        ).unwrap();
      } else {
        // Discretionary transaction: deduct from remainingToSpend
        await dispatch(
          updateCycleSpending({
            userId: user.uid,
            cycleId,
            totalSpent: totalSpentInCycle + parsedAmount,
            remainingToSpend: newRemaining,
          })
        ).unwrap();
      }

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
              className="w-full pl-10 pr-4 py-3 text-2xl font-semibold border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400"
            />
          </div>

          {/* Preview */}
          {parsedAmount > 0 && (
            <div className="mt-2 space-y-1">
              {isObligationTransaction && selectedObligation ? (
                <div
                  className={`p-3 rounded-lg ${
                    obligationOver
                      ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                      : 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                  }`}
                >
                  <div className="flex justify-between text-sm">
                    <span>{selectedObligation.obligationName} budget:</span>
                    <span className="font-semibold">
                      {formatCurrency(newObligationSpent)} / {formatCurrency(selectedObligation.estimatedAmount)}
                    </span>
                  </div>
                  {obligationOver && (
                    <p className="text-xs mt-1">
                      {formatCurrency(newObligationSpent - selectedObligation.estimatedAmount)} over obligation budget
                    </p>
                  )}
                  <p className="text-xs mt-1 opacity-75">Discretionary spending limit unchanged</p>
                </div>
              ) : (
                <div
                  className={`p-3 rounded-lg ${
                    isOverBudget
                      ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                      : 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
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
          )}
        </div>

        {/* Variable Obligation Assignment */}
        {variableObligations.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <ShoppingCart className="w-4 h-4 inline mr-1 text-orange-500" />
              Obligation (optional)
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedObligationId('')}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  !selectedObligationId
                    ? 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 font-medium'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Discretionary
              </button>
              {variableObligations.map((obligation) => (
                <button
                  key={obligation.obligationId}
                  type="button"
                  onClick={() => setSelectedObligationId(obligation.obligationId)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    selectedObligationId === obligation.obligationId
                      ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-2 border-orange-300 dark:border-orange-600 font-medium'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-2 border-transparent hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {obligation.obligationName}
                  <span className="text-xs ml-1 opacity-60">
                    {formatCurrency(obligation.amountSpent)}/{formatCurrency(obligation.estimatedAmount)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

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
                    ? 'border-teal-500 dark:border-teal-400 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
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
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => handleTagToggle(tag.id)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  selectedTagIds.includes(tag.id)
                    ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-2 border-teal-300 dark:border-teal-600'
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
                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400"
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
