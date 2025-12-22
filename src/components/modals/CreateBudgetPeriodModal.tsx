import { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { closeModal } from '../../features/auth/uiSlice';
import { createBudgetPeriod } from '../../features/budget-periods/budgetPeriodsSlice';
import { Modal, Button, CurrencyInput, Select } from '../shared';
import { getPeriodBoundaries, formatPeriodRange, getNextPeriodBoundaries, toDate } from '../../utils/date';
import { canApplyRollover, calculateRollover } from '../../utils/rollover';
import { formatCurrency } from '../../utils/currency';
import { IncomeEntry } from '../../types';

export const CreateBudgetPeriodModal = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { modals } = useAppSelector((state) => state.ui);
  const { data: settings } = useAppSelector((state) => state.settings);
  const { byId: categoriesById, allIds: categoryIds } = useAppSelector((state) => state.categories);
  const { byId: incomeSourcesById, allIds: incomeSourceIds } = useAppSelector(
    (state) => state.incomeSources
  );
  const { byId: templatesById, allIds: templateIds } = useAppSelector((state) => state.templates);
  const { byId: periodsById, allIds: periodIds } = useAppSelector((state) => state.budgetPeriods);

  const [isLoading, setIsLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [incomeAmounts, setIncomeAmounts] = useState<Record<string, number>>({});
  const [allocations, setAllocations] = useState<
    Array<{ categoryId: string; budgetedAmount: number; note: string }>
  >([]);

  const payDays = settings?.payDays || [1, 15];

  // Calculate next period dates
  const lastPeriod = periodIds.length > 0 ? periodsById[periodIds[0]] : null;
  const nextPeriod = lastPeriod
    ? getNextPeriodBoundaries(toDate(lastPeriod.endDate), payDays as [number, number])
    : getPeriodBoundaries(new Date(), payDays as [number, number]);

  // Calculate rollover
  let rolloverAmount = 0;
  if (lastPeriod && lastPeriod.status === 'closed') {
    if (canApplyRollover(toDate(lastPeriod.endDate), nextPeriod.startDate)) {
      rolloverAmount = calculateRollover(lastPeriod);
    }
  }

  useEffect(() => {
    // Initialize income amounts from sources
    const initial: Record<string, number> = {};
    incomeSourceIds.forEach((id) => {
      const source = incomeSourcesById[id];
      if (source.isActive) {
        const shouldInclude =
          source.assignToPeriod === 'both' || source.assignToPeriod === nextPeriod.periodNumber;
        if (shouldInclude) {
          initial[id] = source.defaultAmount;
        }
      }
    });
    setIncomeAmounts(initial);
  }, [incomeSourceIds, incomeSourcesById, nextPeriod.periodNumber]);

  useEffect(() => {
    // Apply template allocations
    if (selectedTemplateId) {
      const template = templatesById[selectedTemplateId];
      if (template) {
        setAllocations(
          template.allocations.map((a) => ({
            categoryId: a.categoryId,
            budgetedAmount: a.amount,
            note: a.note,
          }))
        );
      }
    } else {
      // Default: equal allocation to all categories
      const perCategory = totalIncome / categoryIds.length || 0;
      setAllocations(
        categoryIds.map((catId) => ({
          categoryId: catId,
          budgetedAmount: Math.floor(perCategory),
          note: '',
        }))
      );
    }
  }, [selectedTemplateId, templatesById, categoryIds]);

  const totalIncome = Object.values(incomeAmounts).reduce((sum, amount) => sum + amount, 0);
  const totalAvailable = totalIncome + rolloverAmount;
  const totalAllocated = allocations.reduce((sum, a) => sum + a.budgetedAmount, 0);
  const unallocated = totalAvailable - totalAllocated;

  const handleSubmit = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const incomeBreakdown: IncomeEntry[] = Object.entries(incomeAmounts).map(([sourceId, amount]) => ({
        sourceId,
        sourceName: incomeSourcesById[sourceId]?.name || 'Unknown',
        amount,
      }));

      await dispatch(
        createBudgetPeriod({
          userId: user.uid,
          periodData: {
            startDate: nextPeriod.startDate,
            endDate: nextPeriod.endDate,
            totalIncome,
            incomeBreakdown,
            rolloverIn: rolloverAmount,
          },
          allocations: allocations.map((a) => ({
            categoryId: a.categoryId,
            categoryName: categoriesById[a.categoryId]?.name || 'Unknown',
            categoryColor: categoriesById[a.categoryId]?.color || '#6366f1',
            budgetedAmount: a.budgetedAmount,
            note: a.note,
          })),
        })
      );

      dispatch(closeModal('createBudgetPeriod'));
    } catch (error) {
      console.error('Failed to create budget period:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleIncomeChange = (sourceId: string, amount: number) => {
    setIncomeAmounts((prev) => ({ ...prev, [sourceId]: amount }));
  };

  const handleAllocationChange = (categoryId: string, amount: number) => {
    setAllocations((prev) =>
      prev.map((a) => (a.categoryId === categoryId ? { ...a, budgetedAmount: amount } : a))
    );
  };

  return (
    <Modal
      isOpen={modals.createBudgetPeriod}
      onClose={() => dispatch(closeModal('createBudgetPeriod'))}
      title="Create Budget Period"
      size="lg"
    >
      <div className="space-y-6">
        {/* Period Info */}
        <div className="bg-indigo-50 rounded-lg p-4">
          <p className="text-sm text-indigo-700 font-medium">
            Period: {formatPeriodRange(nextPeriod.startDate, nextPeriod.endDate, settings?.timezone)}
          </p>
          {rolloverAmount > 0 && (
            <p className="text-sm text-green-600 mt-1">
              Rollover from previous period: {formatCurrency(rolloverAmount)}
            </p>
          )}
        </div>

        {/* Template Selection */}
        {templateIds.length > 0 && (
          <Select
            label="Apply Template"
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            options={[
              { value: '', label: 'No template' },
              ...templateIds.map((id) => ({
                value: id,
                label: templatesById[id].name,
              })),
            ]}
          />
        )}

        {/* Income Sources */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Income for this period</h4>
          <div className="space-y-3">
            {incomeSourceIds
              .filter((id) => incomeSourcesById[id].isActive)
              .map((sourceId) => {
                const source = incomeSourcesById[sourceId];
                const shouldShow =
                  source.assignToPeriod === 'both' ||
                  source.assignToPeriod === nextPeriod.periodNumber;
                if (!shouldShow) return null;

                return (
                  <CurrencyInput
                    key={sourceId}
                    label={source.name}
                    value={incomeAmounts[sourceId] || 0}
                    onChange={(value) => handleIncomeChange(sourceId, value)}
                  />
                );
              })}
            {incomeSourceIds.length === 0 && (
              <p className="text-sm text-gray-500">
                No income sources configured. Add them in Income settings.
              </p>
            )}
          </div>
        </div>

        {/* Allocations */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-700">Category Allocations</h4>
            <span
              className={`text-sm ${unallocated < 0 ? 'text-red-600' : 'text-gray-500'}`}
            >
              Unallocated: {formatCurrency(unallocated)}
            </span>
          </div>
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {allocations.map((alloc) => {
              const category = categoriesById[alloc.categoryId];
              if (!category) return null;

              return (
                <div key={alloc.categoryId} className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: category.color }}
                  />
                  <span className="text-sm text-gray-700 w-32 truncate">{category.name}</span>
                  <CurrencyInput
                    value={alloc.budgetedAmount}
                    onChange={(value) => handleAllocationChange(alloc.categoryId, value)}
                    className="flex-1"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Total Income</span>
            <span className="font-medium">{formatCurrency(totalIncome)}</span>
          </div>
          {rolloverAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Rollover</span>
              <span className="font-medium text-green-600">+{formatCurrency(rolloverAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-medium border-t pt-2">
            <span>Total Available</span>
            <span>{formatCurrency(totalAvailable)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => dispatch(closeModal('createBudgetPeriod'))}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} isLoading={isLoading} disabled={totalIncome <= 0}>
            Create Period
          </Button>
        </div>
      </div>
    </Modal>
  );
};
