import { useEffect, useState, useMemo } from 'react';
import {
  History,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertCircle,
  Calendar,
  Receipt,
  TrendingUp,
  DollarSign,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { fetchPaycheckCycles } from '../paycheckCyclesSlice';
import { fetchTransactionsByCycle } from '../spendingTransactionsSlice';
import { AppLayout } from '../../../components/layout';
import { Card } from '../../../components/shared';
import { formatCurrency } from '../../../utils/currency';
import { PaycheckCycle, SpendingTransaction } from '../../../types';

export const CycleHistoryPage = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { byId: cyclesById, allIds: cycleIds, isLoading } = useAppSelector(
    (state) => state.paycheckCycles
  );
  const { byId: transactionsById, idsByCycle } = useAppSelector(
    (state) => state.spendingTransactions
  );

  const [expandedCycleId, setExpandedCycleId] = useState<string | null>(null);

  // Fetch all cycles on mount
  useEffect(() => {
    if (user) {
      dispatch(fetchPaycheckCycles(user.uid));
    }
  }, [dispatch, user]);

  // Fetch transactions when a cycle is expanded
  useEffect(() => {
    if (user && expandedCycleId && !idsByCycle[expandedCycleId]) {
      dispatch(fetchTransactionsByCycle({ userId: user.uid, cycleId: expandedCycleId }));
    }
  }, [dispatch, user, expandedCycleId, idsByCycle]);

  // Get all cycles sorted by date (most recent first)
  const allCycles = useMemo(() => {
    return cycleIds
      .map((id) => cyclesById[id])
      .filter((cycle) => cycle && cycle.status !== 'active')
      .sort((a, b) => b.startDate.toDate().getTime() - a.startDate.toDate().getTime());
  }, [cycleIds, cyclesById]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const completedCycles = allCycles.filter((c) => c.status === 'completed');
    const totalCycles = completedCycles.length;

    if (totalCycles === 0) {
      return {
        totalCycles: 0,
        avgSpending: 0,
        totalSaved: 0,
        onTrackPercent: 0,
      };
    }

    const totalSpending = completedCycles.reduce((sum, c) => sum + c.totalSpent, 0);
    const totalSaved = completedCycles.reduce((sum, c) => sum + c.actualSaved, 0);
    const onTrackCount = completedCycles.filter((c) => c.totalSpent <= c.spendingLimit).length;

    return {
      totalCycles,
      avgSpending: totalSpending / totalCycles,
      totalSaved,
      onTrackPercent: Math.round((onTrackCount / totalCycles) * 100),
    };
  }, [allCycles]);

  const toggleExpand = (cycleId: string) => {
    setExpandedCycleId((prev) => (prev === cycleId ? null : cycleId));
  };

  const getCycleTransactions = (cycleId: string): SpendingTransaction[] => {
    const transactionIds = idsByCycle[cycleId] || [];
    return transactionIds
      .map((id) => transactionsById[id])
      .filter(Boolean)
      .sort((a, b) => b.date.toDate().getTime() - a.date.toDate().getTime());
  };

  const formatDateRange = (cycle: PaycheckCycle) => {
    const start = cycle.startDate.toDate();
    const end = cycle.endDate.toDate();
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };

    if (start.getFullYear() !== end.getFullYear()) {
      return `${start.toLocaleDateString('en-US', { ...options, year: 'numeric' })} - ${end.toLocaleDateString('en-US', { ...options, year: 'numeric' })}`;
    }

    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}, ${start.getFullYear()}`;
  };

  const isOverBudget = (cycle: PaycheckCycle) => cycle.totalSpent > cycle.spendingLimit;

  if (isLoading) {
    return (
      <AppLayout title="Cycle History">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-600 border-t-transparent"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Cycle History">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 bg-teal-100 dark:bg-teal-900/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <History className="w-8 h-8 text-teal-600 dark:text-teal-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Cycle History</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            View your past paycheck cycles and spending
          </p>
        </div>

        {/* Summary Stats */}
        {summaryStats.totalCycles > 0 && (
          <Card>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-teal-600 dark:text-teal-400">
                  {summaryStats.totalCycles}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Cycles Completed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {formatCurrency(summaryStats.avgSpending)}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Avg Spending</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(summaryStats.totalSaved)}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Saved</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {summaryStats.onTrackPercent}%
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">On Track</p>
              </div>
            </div>
          </Card>
        )}

        {/* Cycles List */}
        {allCycles.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
              <p className="text-gray-500 dark:text-gray-400">No completed cycles yet</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Complete your first paycheck cycle to see it here
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {allCycles.map((cycle) => (
              <CycleCard
                key={cycle.id}
                cycle={cycle}
                isExpanded={expandedCycleId === cycle.id}
                onToggle={() => toggleExpand(cycle.id)}
                transactions={getCycleTransactions(cycle.id)}
                isOverBudget={isOverBudget(cycle)}
                formatDateRange={formatDateRange}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

interface CycleCardProps {
  cycle: PaycheckCycle;
  isExpanded: boolean;
  onToggle: () => void;
  transactions: SpendingTransaction[];
  isOverBudget: boolean;
  formatDateRange: (cycle: PaycheckCycle) => string;
}

const CycleCard = ({
  cycle,
  isExpanded,
  onToggle,
  transactions,
  isOverBudget,
  formatDateRange,
}: CycleCardProps) => {
  const spendingPercent = cycle.spendingLimit > 0
    ? Math.round((cycle.totalSpent / cycle.spendingLimit) * 100)
    : 0;

  return (
    <Card className="overflow-hidden">
      {/* Collapsed Header */}
      <button
        onClick={onToggle}
        className="w-full text-left focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 rounded-lg"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {formatDateRange(cycle)}
              </span>
              {isOverBudget ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400">
                  <AlertCircle className="w-3 h-3" />
                  Over Budget
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400">
                  <CheckCircle className="w-3 h-3" />
                  On Track
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Paycheck:</span>{' '}
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {formatCurrency(cycle.paycheckAmount)}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Spent:</span>{' '}
                <span className={`font-medium ${isOverBudget ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
                  {formatCurrency(cycle.totalSpent)}
                </span>
                <span className="text-gray-400 dark:text-gray-500">
                  {' '}/ {formatCurrency(cycle.spendingLimit)}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Bills:</span>{' '}
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {cycle.bills.filter((b) => b.isPaid).length}/{cycle.bills.length} paid
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Saved:</span>{' '}
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(cycle.actualSaved)}
                </span>
              </div>
            </div>
          </div>
          <div className="ml-4 flex-shrink-0">
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
          {/* Bills Section */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Bills ({cycle.bills.length})
            </h4>
            {cycle.bills.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No bills in this cycle</p>
            ) : (
              <div className="space-y-1">
                {cycle.bills.map((bill) => (
                  <div
                    key={bill.billId}
                    className="flex items-center justify-between text-sm py-1"
                  >
                    <div className="flex items-center gap-2">
                      {bill.isPaid ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                      )}
                      <span className={bill.isPaid ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}>
                        {bill.billName}
                      </span>
                    </div>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {formatCurrency(bill.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Transactions Section */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Transactions ({transactions.length})
            </h4>
            {transactions.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No transactions recorded</p>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between text-sm py-1"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 dark:text-gray-500 w-16">
                        {tx.date.toDate().toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      <span className="text-gray-900 dark:text-gray-100 truncate max-w-[200px]">
                        {tx.description}
                      </span>
                    </div>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {formatCurrency(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reflection Section */}
          {cycle.reflection && (
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Reflection
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                "{cycle.reflection}"
              </p>
            </div>
          )}

          {/* Cycle Summary */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400">Spending Used</p>
                <p className={`font-semibold ${isOverBudget ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  {spendingPercent}%
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Bills Total</p>
                <p className="font-semibold text-gray-900 dark:text-gray-100">
                  {formatCurrency(cycle.billsTotal)}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Buffer Contribution</p>
                <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(cycle.bufferContribution)}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Buffer Draw</p>
                <p className="font-semibold text-teal-600 dark:text-teal-400">
                  {formatCurrency(cycle.bufferDraw || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};
