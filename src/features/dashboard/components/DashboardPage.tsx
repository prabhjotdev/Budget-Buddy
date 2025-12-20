import { useEffect } from 'react';
import { Calendar, TrendingUp, TrendingDown, ArrowRight, Plus } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { fetchRecentTransactions } from '../../transactions/transactionsSlice';
import { openModal } from '../../auth/uiSlice';
import { AppLayout } from '../../../components/layout';
import { Card, CardHeader, Button, ProgressBar, Badge, EmptyState } from '../../../components/shared';
import { formatCurrency } from '../../../utils/currency';
import { formatPeriodRange, formatShortDate } from '../../../utils/date';
import { calculateBudgetSummary, calculateAllocationProgress } from '../../../utils/rollover';

export const DashboardPage = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { byId, activePeriodId, allocationsByPeriodId } = useAppSelector(
    (state) => state.budgetPeriods
  );
  const { byId: transactionsById, recentByPeriod } = useAppSelector(
    (state) => state.transactions
  );
  const categories = useAppSelector((state) => state.categories.byId);

  const activePeriod = activePeriodId ? byId[activePeriodId] : null;
  const allocations = activePeriodId ? allocationsByPeriodId[activePeriodId] : null;
  const recentTransactionIds = activePeriodId ? recentByPeriod[activePeriodId] || [] : [];

  useEffect(() => {
    if (user && activePeriodId) {
      dispatch(fetchRecentTransactions({ userId: user.uid, periodId: activePeriodId }));
    }
  }, [dispatch, user, activePeriodId]);

  if (!activePeriod) {
    return (
      <AppLayout title="Dashboard">
        <Card>
          <EmptyState
            icon={Calendar}
            title="No Active Budget Period"
            description="Create a new budget period to start tracking your expenses."
            action={
              <Button onClick={() => dispatch(openModal('createBudgetPeriod'))}>
                <Plus className="w-4 h-4 mr-2" />
                Create Budget Period
              </Button>
            }
          />
        </Card>
      </AppLayout>
    );
  }

  const summary = calculateBudgetSummary(activePeriod);

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Available</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(summary.totalAvailable)}
                </p>
                {summary.rolloverIn > 0 && (
                  <p className="text-xs text-green-600 mt-1">
                    +{formatCurrency(summary.rolloverIn)} rollover
                  </p>
                )}
              </div>
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Spent</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(summary.totalSpent)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {summary.utilizationPercent.toFixed(0)}% of budget
                </p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Remaining</p>
                <p
                  className={`text-2xl font-bold ${
                    summary.isOverBudget ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {formatCurrency(summary.remainingBudget)}
                </p>
              </div>
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  summary.isOverBudget ? 'bg-red-100' : 'bg-green-100'
                }`}
              >
                <TrendingUp
                  className={`w-6 h-6 ${summary.isOverBudget ? 'text-red-600' : 'text-green-600'}`}
                />
              </div>
            </div>
          </Card>

          <Card>
            <div>
              <p className="text-sm text-gray-500">Period</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatPeriodRange(
                  activePeriod.startDate.toDate(),
                  activePeriod.endDate.toDate()
                )}
              </p>
              <Badge variant={activePeriod.status === 'active' ? 'success' : 'default'}>
                {activePeriod.status}
              </Badge>
            </div>
          </Card>
        </div>

        {/* Budget Progress */}
        <Card>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Overall Budget</h3>
          </div>
          <div className="mb-2">
            <ProgressBar
              value={summary.utilizationPercent}
              size="lg"
              isOverBudget={summary.isOverBudget}
              showLabel
            />
          </div>
          <div className="flex justify-between text-sm text-gray-500">
            <span>Spent: {formatCurrency(summary.totalSpent)}</span>
            <span>Budget: {formatCurrency(summary.totalAvailable)}</span>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Category Allocations */}
          <Card>
            <CardHeader
              title="Category Budgets"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => dispatch(openModal('addTransaction'))}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              }
            />
            <div className="space-y-4">
              {allocations?.allIds.slice(0, 6).map((allocId) => {
                const alloc = allocations.byId[allocId];
                const progress = calculateAllocationProgress(
                  alloc.budgetedAmount,
                  alloc.spentAmount
                );

                return (
                  <div key={allocId}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: alloc.categoryColor }}
                        />
                        <span className="text-sm font-medium text-gray-700">
                          {alloc.categoryName}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {formatCurrency(alloc.spentAmount)} / {formatCurrency(alloc.budgetedAmount)}
                      </span>
                    </div>
                    <ProgressBar
                      value={progress.percent}
                      color={alloc.categoryColor}
                      isOverBudget={progress.isOverBudget}
                      size="sm"
                    />
                  </div>
                );
              })}
              {(!allocations || allocations.allIds.length === 0) && (
                <p className="text-sm text-gray-500 text-center py-4">
                  No allocations yet
                </p>
              )}
            </div>
          </Card>

          {/* Recent Transactions */}
          <Card>
            <CardHeader
              title="Recent Transactions"
              action={
                <Button variant="ghost" size="sm">
                  View All
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              }
            />
            <div className="space-y-3">
              {recentTransactionIds.map((txId) => {
                const tx = transactionsById[txId];
                if (!tx) return null;

                return (
                  <div
                    key={txId}
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{
                          backgroundColor: categories[tx.categoryId]?.color + '20',
                        }}
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: categories[tx.categoryId]?.color }}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{tx.description}</p>
                        <p className="text-xs text-gray-500">
                          {tx.categoryName} • {formatShortDate(tx.date.toDate())}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        tx.type === 'expense' ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {tx.type === 'expense' ? '-' : '+'}
                      {formatCurrency(tx.amount)}
                    </span>
                  </div>
                );
              })}
              {recentTransactionIds.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No transactions yet</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};
