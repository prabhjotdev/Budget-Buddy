import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { closeModal } from '../../features/auth/uiSlice';
import { addTransaction } from '../../features/transactions/transactionsSlice';
import { updateAllocationSpent } from '../../features/budget-periods/budgetPeriodsSlice';
import { Modal, Button, Input, CurrencyInput, Select } from '../shared';

export const AddTransactionModal = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { modals } = useAppSelector((state) => state.ui);
  const { activePeriodId, allocationsByPeriodId } = useAppSelector((state) => state.budgetPeriods);
  const { byId: categoriesById, allIds: categoryIds } = useAppSelector((state) => state.categories);

  const [isLoading, setIsLoading] = useState(false);
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState(categoryIds[0] || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const allocations = activePeriodId ? allocationsByPeriodId[activePeriodId] : null;

  const handleSubmit = async () => {
    if (!user || !activePeriodId || !categoryId || amount <= 0) return;

    setIsLoading(true);
    try {
      const category = categoriesById[categoryId];
      await dispatch(
        addTransaction({
          userId: user.uid,
          transaction: {
            budgetPeriodId: activePeriodId,
            categoryId,
            categoryName: category?.name || 'Unknown',
            type,
            amount,
            description,
            date: new Date(date),
          },
        })
      );

      // Update local allocation state if expense
      if (type === 'expense' && allocations) {
        const allocationId = allocations.allIds.find(
          (id) => allocations.byId[id].categoryId === categoryId
        );
        if (allocationId) {
          dispatch(
            updateAllocationSpent({
              periodId: activePeriodId,
              allocationId,
              amount,
            })
          );
        }
      }

      dispatch(closeModal('addTransaction'));
      resetForm();
    } catch (error) {
      console.error('Failed to add transaction:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setType('expense');
    setAmount(0);
    setDescription('');
    setCategoryId(categoryIds[0] || '');
    setDate(new Date().toISOString().split('T')[0]);
  };

  return (
    <Modal
      isOpen={modals.addTransaction}
      onClose={() => dispatch(closeModal('addTransaction'))}
      title="Add Transaction"
      size="md"
    >
      <div className="space-y-4">
        {/* Type Toggle */}
        <div className="flex rounded-lg border border-gray-200 p-1">
          <button
            onClick={() => setType('expense')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              type === 'expense'
                ? 'bg-red-100 text-red-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Expense
          </button>
          <button
            onClick={() => setType('income')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              type === 'income'
                ? 'bg-green-100 text-green-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Income
          </button>
        </div>

        <CurrencyInput label="Amount" value={amount} onChange={setAmount} />

        <Input
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What was this for?"
        />

        <Select
          label="Category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          options={categoryIds.map((id) => ({
            value: id,
            label: categoriesById[id]?.name || 'Unknown',
          }))}
        />

        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />

        {!activePeriodId && (
          <p className="text-sm text-yellow-600 bg-yellow-50 p-3 rounded-lg">
            No active budget period. Please create one first.
          </p>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" onClick={() => dispatch(closeModal('addTransaction'))}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={isLoading}
            disabled={!activePeriodId || amount <= 0 || !categoryId}
          >
            Add Transaction
          </Button>
        </div>
      </div>
    </Modal>
  );
};
