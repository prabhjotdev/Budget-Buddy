import { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  Calendar,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { fetchSpendingTransactions } from '../spendingTransactionsSlice';
import { fetchPaymentMethods } from '../paymentMethodsSlice';
import { fetchSpendingTags } from '../spendingTagsSlice';
import { AppLayout } from '../../../components/layout';
import { Card, CardHeader, Button, Select } from '../../../components/shared';
import { formatCurrency } from '../../../utils/currency';
import { SpendingTransaction } from '../../../types';

const ITEMS_PER_PAGE = 20;

// Date range presets
const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: '30', label: 'Last 30 Days' },
  { value: '90', label: 'Last 90 Days' },
  { value: '180', label: 'Last 6 Months' },
  { value: '365', label: 'Last Year' },
];

export const SpendingLogsPage = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { byId, allIds, isLoading } = useAppSelector((state) => state.spendingTransactions);
  const { byId: paymentMethodsById, allIds: paymentMethodIds } = useAppSelector(
    (state) => state.paymentMethods
  );
  const { byId: tagsById, allIds: tagIds } = useAppSelector((state) => state.spendingTags);

  // Filter state
  const [dateRange, setDateRange] = useState('365');
  const [selectedTagId, setSelectedTagId] = useState('all');
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState('all');
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // Pagination
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  // Fetch data on mount
  useEffect(() => {
    if (user) {
      dispatch(fetchSpendingTransactions(user.uid));
      dispatch(fetchPaymentMethods(user.uid));
      dispatch(fetchSpendingTags(user.uid));
    }
  }, [dispatch, user]);

  // Get all transactions as array
  const allTransactions = useMemo(() => {
    return allIds.map((id) => byId[id]).filter(Boolean);
  }, [byId, allIds]);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    let filtered = [...allTransactions];

    // Date range filter
    if (dateRange !== 'all') {
      const days = parseInt(dateRange, 10);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      filtered = filtered.filter((tx) => tx.date.toDate() >= cutoffDate);
    }

    // Tag filter
    if (selectedTagId !== 'all') {
      filtered = filtered.filter((tx) => tx.tagIds.includes(selectedTagId));
    }

    // Payment method filter
    if (selectedPaymentMethodId !== 'all') {
      filtered = filtered.filter((tx) => tx.paymentMethodId === selectedPaymentMethodId);
    }

    return filtered;
  }, [allTransactions, dateRange, selectedTagId, selectedPaymentMethodId]);

  // Calculate monthly data for chart (past 12 months)
  const chartData = useMemo(() => {
    const now = new Date();
    const months: { month: string; amount: number; fullDate: Date }[] = [];

    // Generate past 12 months
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        fullDate: date,
        amount: 0,
      });
    }

    // Aggregate spending by month
    allTransactions.forEach((tx) => {
      const txDate = tx.date.toDate();
      const txMonth = new Date(txDate.getFullYear(), txDate.getMonth(), 1);

      const monthEntry = months.find(
        (m) =>
          m.fullDate.getFullYear() === txMonth.getFullYear() &&
          m.fullDate.getMonth() === txMonth.getMonth()
      );

      if (monthEntry) {
        monthEntry.amount += tx.amount;
      }
    });

    return months.map((m) => ({
      month: m.month,
      amount: Math.round(m.amount * 100) / 100,
    }));
  }, [allTransactions]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = filteredTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const count = filteredTransactions.length;
    const avg = count > 0 ? total / count : 0;

    // Monthly average (for the past 12 months)
    const monthlyTotal = chartData.reduce((sum, m) => sum + m.amount, 0);
    const monthsWithSpending = chartData.filter((m) => m.amount > 0).length;
    const monthlyAvg = monthsWithSpending > 0 ? monthlyTotal / monthsWithSpending : 0;

    return { total, count, avg, monthlyAvg };
  }, [filteredTransactions, chartData]);

  // Visible transactions (paginated)
  const visibleTransactions = filteredTransactions.slice(0, visibleCount);
  const hasMore = visibleCount < filteredTransactions.length;

  const clearFilters = () => {
    setDateRange('365');
    setSelectedTagId('all');
    setSelectedPaymentMethodId('all');
  };

  const hasActiveFilters =
    dateRange !== '365' || selectedTagId !== 'all' || selectedPaymentMethodId !== 'all';

  // Format date for display
  const formatDate = (tx: SpendingTransaction) => {
    const date = tx.date.toDate();
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
      });
    }
  };

  // Payment method options for filter
  const paymentMethodOptions = [
    { value: 'all', label: 'All Payment Methods' },
    ...paymentMethodIds.map((id) => ({
      value: id,
      label: paymentMethodsById[id]?.name || id,
    })),
  ];

  // Tag options for filter
  const tagOptions = [
    { value: 'all', label: 'All Tags' },
    ...tagIds.map((id) => ({
      value: id,
      label: tagsById[id]?.name || id,
    })),
  ];

  return (
    <AppLayout title="Spending History">
      <div className="space-y-4 md:space-y-6">
        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <Card padding="sm">
            <p className="text-xs md:text-sm text-gray-500">Total Spent</p>
            <p className="text-lg md:text-2xl font-bold text-gray-900">
              {formatCurrency(stats.total)}
            </p>
          </Card>
          <Card padding="sm">
            <p className="text-xs md:text-sm text-gray-500">Transactions</p>
            <p className="text-lg md:text-2xl font-bold text-gray-900">{stats.count}</p>
          </Card>
          <Card padding="sm">
            <p className="text-xs md:text-sm text-gray-500">Avg Transaction</p>
            <p className="text-lg md:text-2xl font-bold text-gray-900">
              {formatCurrency(stats.avg)}
            </p>
          </Card>
          <Card padding="sm">
            <p className="text-xs md:text-sm text-gray-500">Monthly Avg</p>
            <p className="text-lg md:text-2xl font-bold text-gray-900">
              {formatCurrency(stats.monthlyAvg)}
            </p>
          </Card>
        </div>

        {/* Spending Trend Chart */}
        <Card>
          <CardHeader
            title="Spending Trend"
            subtitle="Monthly spending over the past year"
            action={
              <div className="flex items-center gap-1 text-indigo-600">
                <TrendingUp className="w-4 h-4" />
              </div>
            }
          />
          <div className="h-48 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tickFormatter={(value) => `$${value}`}
                  width={50}
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Spent']}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ fill: '#6366f1', strokeWidth: 2, r: 3 }}
                  activeDot={{ r: 5, fill: '#6366f1' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Filters */}
        <Card padding="sm">
          <button
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            className="w-full flex items-center justify-between p-2"
          >
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="font-medium text-gray-700">Filters</span>
              {hasActiveFilters && (
                <span className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded-full">
                  Active
                </span>
              )}
            </div>
            {filtersExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {filtersExpanded && (
            <div className="p-2 pt-0 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Select
                  label="Date Range"
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  options={DATE_RANGE_OPTIONS}
                />
                <Select
                  label="Tag"
                  value={selectedTagId}
                  onChange={(e) => setSelectedTagId(e.target.value)}
                  options={tagOptions}
                />
                <Select
                  label="Payment Method"
                  value={selectedPaymentMethodId}
                  onChange={(e) => setSelectedPaymentMethodId(e.target.value)}
                  options={paymentMethodOptions}
                />
              </div>
              {hasActiveFilters && (
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="w-3 h-3 mr-1" />
                    Clear Filters
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Transaction List */}
        <Card>
          <CardHeader
            title="Transaction Log"
            subtitle={`${filteredTransactions.length} transactions`}
          />

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No transactions found</p>
              <p className="text-sm mt-1">
                {hasActiveFilters
                  ? 'Try adjusting your filters'
                  : 'Start logging your spending to see history'}
              </p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-100 -mx-4 md:-mx-6">
                {visibleTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="px-4 md:px-6 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 truncate">
                            {tx.description || 'No description'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs md:text-sm text-gray-500">
                          <span>{formatDate(tx)}</span>
                          <span>•</span>
                          <span>{tx.paymentMethodName}</span>
                          {tx.tagNames.length > 0 && (
                            <>
                              <span>•</span>
                              <span className="truncate">{tx.tagNames.join(', ')}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <p className="font-semibold text-gray-900 ml-4">
                        -{formatCurrency(tx.amount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {hasMore && (
                <div className="pt-4 flex justify-center">
                  <Button
                    variant="secondary"
                    onClick={() => setVisibleCount((prev) => prev + ITEMS_PER_PAGE)}
                  >
                    Load More ({filteredTransactions.length - visibleCount} remaining)
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </AppLayout>
  );
};
