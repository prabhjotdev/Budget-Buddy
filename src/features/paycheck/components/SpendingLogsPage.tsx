import { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  Calendar,
  Edit2,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import {
  fetchSpendingTransactions,
  fetchRecentSpendingTransactions,
} from '../spendingTransactionsSlice';
import { fetchActiveCycle } from '../paycheckCyclesSlice';
import { fetchPaymentMethods } from '../paymentMethodsSlice';
import { fetchSpendingTags } from '../spendingTagsSlice';
import { AppLayout } from '../../../components/layout';
import { useTheme } from '../../../context/ThemeContext';
import { Card, CardHeader, Button, Select } from '../../../components/shared';
import { formatCurrency } from '../../../utils/currency';
import { SpendingTransaction } from '../../../types';
import { EditSpendingModal } from './EditSpendingModal';

const ITEMS_PER_PAGE = 20;

// Date range presets
const DATE_RANGE_OPTIONS = [
  { value: 'cycle', label: 'Current Cycle' },
  { value: '30', label: 'Last 30 Days' },
  { value: '90', label: 'Last 90 Days' },
  { value: '180', label: 'Last 6 Months' },
  { value: '365', label: 'Last Year' },
  { value: 'all', label: 'All Time' },
  { value: 'custom', label: 'Custom Range' },
];

interface MonthData {
  month: string;
  monthIndex: number;
  year: number;
  amount: number;
  fullDate: Date;
}

// Custom dot component for the chart - must be outside to avoid recreation on each render
const CustomDot = (props: {
  cx?: number;
  cy?: number;
  payload?: MonthData;
  selectedMonth?: MonthData | null;
  onClick?: (data: MonthData) => void;
  isDarkMode?: boolean;
}) => {
  const { cx, cy, payload, selectedMonth, onClick, isDarkMode } = props;
  if (!cx || !cy || !payload) return null;

  const isSelected =
    selectedMonth?.monthIndex === payload.monthIndex &&
    selectedMonth?.year === payload.year;

  return (
    <circle
      cx={cx}
      cy={cy}
      r={isSelected ? 6 : 4}
      fill={isSelected ? '#4f46e5' : '#6366f1'}
      stroke={isSelected ? '#4f46e5' : isDarkMode ? '#1f2937' : 'white'}
      strokeWidth={2}
      style={{ cursor: 'pointer' }}
      onClick={() => onClick?.(payload)}
    />
  );
};

export const SpendingLogsPage = () => {
  const dispatch = useAppDispatch();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const { user } = useAppSelector((state) => state.auth);
  const { byId, allIds, isLoading, hasFullHistory } = useAppSelector(
    (state) => state.spendingTransactions
  );
  const { byId: cyclesById, activeCycleId } = useAppSelector((state) => state.paycheckCycles);
  const activeCycle = activeCycleId ? cyclesById[activeCycleId] : null;
  const { byId: paymentMethodsById, allIds: paymentMethodIds } = useAppSelector(
    (state) => state.paymentMethods
  );
  const { byId: tagsById, allIds: tagIds } = useAppSelector((state) => state.spendingTags);

  // Chart colors based on theme
  const chartColors = {
    grid: isDarkMode ? '#374151' : '#f0f0f0', // gray-700 vs light gray
    gridOpacity: isDarkMode ? 0.5 : 1,
    tickText: isDarkMode ? '#9ca3af' : '#6b7280', // gray-400 vs gray-500
    axisLine: isDarkMode ? '#4b5563' : '#e5e7eb', // gray-600 vs gray-200
    tooltipBg: isDarkMode ? '#1f2937' : 'white', // gray-800 vs white
    tooltipBorder: isDarkMode ? '#374151' : '#e5e7eb', // gray-700 vs gray-200
    tooltipText: isDarkMode ? '#f3f4f6' : '#111827', // gray-100 vs gray-900
  };

  // Filter state
  const [dateRange, setDateRange] = useState('cycle');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedTagId, setSelectedTagId] = useState('all');
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState('all');
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // Drill-down state
  const [selectedMonth, setSelectedMonth] = useState<MonthData | null>(null);

  // Pagination
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  // Edit modal state
  const [editingTransaction, setEditingTransaction] = useState<SpendingTransaction | null>(null);

  // Fetch data on mount — load last 365 days (covers 12-month chart) instead of all-time
  useEffect(() => {
    if (user) {
      dispatch(fetchRecentSpendingTransactions({ userId: user.uid, days: 365 }));
      dispatch(fetchPaymentMethods(user.uid));
      dispatch(fetchSpendingTags(user.uid));
      // Load active cycle if not already in state
      if (!activeCycleId && Object.keys(cyclesById).length === 0) {
        dispatch(fetchActiveCycle(user.uid));
      }
    }
  }, [dispatch, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // When user selects "All Time", fetch the full history if not already loaded
  useEffect(() => {
    if (dateRange === 'all' && !hasFullHistory && user) {
      dispatch(fetchSpendingTransactions(user.uid));
    }
  }, [dateRange, hasFullHistory, user, dispatch]);

  // Get all transactions as array
  const allTransactions = useMemo(() => {
    return allIds.map((id) => byId[id]).filter(Boolean);
  }, [byId, allIds]);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    let filtered = [...allTransactions];

    // Date range filter
    if (dateRange === 'cycle' && activeCycle) {
      const cycleStart = activeCycle.startDate.toDate();
      const cycleEnd = activeCycle.endDate.toDate();
      cycleEnd.setHours(23, 59, 59, 999);
      filtered = filtered.filter((tx) => {
        const txDate = tx.date.toDate();
        return txDate >= cycleStart && txDate <= cycleEnd;
      });
    } else if (dateRange === 'custom') {
      // Custom date range
      if (customStartDate) {
        const startDate = parseLocalDate(customStartDate);
        startDate.setHours(0, 0, 0, 0);
        filtered = filtered.filter((tx) => tx.date.toDate() >= startDate);
      }
      if (customEndDate) {
        const endDate = parseLocalDate(customEndDate);
        endDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter((tx) => tx.date.toDate() <= endDate);
      }
    } else if (dateRange !== 'all') {
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
  }, [allTransactions, dateRange, customStartDate, customEndDate, selectedTagId, selectedPaymentMethodId, activeCycle]);

  // Calculate monthly data for chart (past 12 months)
  const chartData = useMemo(() => {
    const now = new Date();
    const months: MonthData[] = [];

    // Generate past 12 months
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        monthIndex: date.getMonth(),
        year: date.getFullYear(),
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
      ...m,
      amount: Math.round(m.amount * 100) / 100,
    }));
  }, [allTransactions]);

  // Get transactions for selected month
  const selectedMonthTransactions = useMemo(() => {
    if (!selectedMonth) return [];
    return allTransactions.filter((tx) => {
      const txDate = tx.date.toDate();
      return (
        txDate.getMonth() === selectedMonth.monthIndex &&
        txDate.getFullYear() === selectedMonth.year
      );
    });
  }, [allTransactions, selectedMonth]);

  // Get breakdown by tag for selected month
  const tagBreakdown = useMemo(() => {
    if (!selectedMonth) return [];
    const breakdown: Record<string, { name: string; amount: number }> = {};

    selectedMonthTransactions.forEach((tx) => {
      if (tx.tagNames.length === 0) {
        if (!breakdown['uncategorized']) {
          breakdown['uncategorized'] = { name: 'Uncategorized', amount: 0 };
        }
        breakdown['uncategorized'].amount += tx.amount;
      } else {
        tx.tagNames.forEach((tagName, idx) => {
          const tagId = tx.tagIds[idx] || tagName;
          if (!breakdown[tagId]) {
            breakdown[tagId] = { name: tagName, amount: 0 };
          }
          breakdown[tagId].amount += tx.amount;
        });
      }
    });

    return Object.values(breakdown)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map((item) => ({
        ...item,
        amount: Math.round(item.amount * 100) / 100,
      }));
  }, [selectedMonth, selectedMonthTransactions]);

  // Get top 3 transactions by amount for selected month
  const topTransactions = useMemo(() => {
    return [...selectedMonthTransactions]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);
  }, [selectedMonthTransactions]);

  // Get previous month data for comparison
  const previousMonthData = useMemo(() => {
    if (!selectedMonth) return null;
    const currentIndex = chartData.findIndex(
      (m) => m.monthIndex === selectedMonth.monthIndex && m.year === selectedMonth.year
    );
    if (currentIndex > 0) {
      return chartData[currentIndex - 1];
    }
    return null;
  }, [selectedMonth, chartData]);

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
    setDateRange('cycle');
    setCustomStartDate('');
    setCustomEndDate('');
    setSelectedTagId('all');
    setSelectedPaymentMethodId('all');
  };

  const hasActiveFilters =
    dateRange !== 'cycle' || selectedTagId !== 'all' || selectedPaymentMethodId !== 'all';

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

  // Handle chart click
  const handleChartClick = (data: MonthData) => {
    if (selectedMonth?.monthIndex === data.monthIndex && selectedMonth?.year === data.year) {
      setSelectedMonth(null); // Deselect if clicking same month
    } else {
      setSelectedMonth(data);
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
            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Total Spent</p>
            <p className="text-lg md:text-2xl font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(stats.total)}
            </p>
          </Card>
          <Card padding="sm">
            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Transactions</p>
            <p className="text-lg md:text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.count}</p>
          </Card>
          <Card padding="sm">
            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Avg Transaction</p>
            <p className="text-lg md:text-2xl font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(stats.avg)}
            </p>
          </Card>
          <Card padding="sm">
            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Monthly Avg</p>
            <p className="text-lg md:text-2xl font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(stats.monthlyAvg)}
            </p>
          </Card>
        </div>

        {/* Spending Trend Chart */}
        <Card>
          <CardHeader
            title="Spending Trend"
            subtitle="Click on a month to see details"
            action={
              <div className="flex items-center gap-1 text-indigo-600">
                <TrendingUp className="w-4 h-4" />
              </div>
            }
          />
          <div className="h-48 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                onClick={(e) => {
                  if (e && e.activePayload && e.activePayload.length > 0) {
                    handleChartClick(e.activePayload[0].payload as MonthData);
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={chartColors.grid}
                  strokeOpacity={chartColors.gridOpacity}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: chartColors.tickText }}
                  tickLine={false}
                  axisLine={{ stroke: chartColors.axisLine }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: chartColors.tickText }}
                  tickLine={false}
                  axisLine={{ stroke: chartColors.axisLine }}
                  tickFormatter={(value) => `$${value}`}
                  width={50}
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Spent']}
                  contentStyle={{
                    backgroundColor: chartColors.tooltipBg,
                    border: `1px solid ${chartColors.tooltipBorder}`,
                    borderRadius: '8px',
                    boxShadow: isDarkMode
                      ? '0 2px 8px rgba(0,0,0,0.3)'
                      : '0 2px 4px rgba(0,0,0,0.1)',
                    color: chartColors.tooltipText,
                  }}
                  labelStyle={{ color: chartColors.tooltipText }}
                  labelFormatter={(label) => `${label} - Click for details`}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={(props) => (
                    <CustomDot
                      {...props}
                      selectedMonth={selectedMonth}
                      onClick={handleChartClick}
                      isDarkMode={isDarkMode}
                    />
                  )}
                  activeDot={{ r: 6, fill: '#4f46e5', cursor: 'pointer' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Month Drill-Down Panel */}
          {selectedMonth && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                    {selectedMonth.fullDate.toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </h4>
                  <div className="flex items-center gap-3 mt-1 text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      {formatCurrency(selectedMonth.amount)} total
                    </span>
                    <span className="text-gray-400 dark:text-gray-500">•</span>
                    <span className="text-gray-600 dark:text-gray-400">
                      {selectedMonthTransactions.length} transactions
                    </span>
                    {previousMonthData && (
                      <>
                        <span className="text-gray-400 dark:text-gray-500">•</span>
                        {selectedMonth.amount >= previousMonthData.amount ? (
                          <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                            <TrendingUp className="w-3 h-3" />
                            +{formatCurrency(selectedMonth.amount - previousMonthData.amount)} vs prev
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                            <TrendingDown className="w-3 h-3" />
                            {formatCurrency(selectedMonth.amount - previousMonthData.amount)} vs prev
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedMonth(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {selectedMonthTransactions.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm py-4 text-center">
                  No spending recorded this month
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Breakdown by Tag */}
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">By Category</h5>
                    {tagBreakdown.length > 0 ? (
                      <div className="h-32">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={tagBreakdown}
                            layout="vertical"
                            margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                          >
                            <XAxis type="number" hide />
                            <YAxis
                              type="category"
                              dataKey="name"
                              tick={{ fontSize: 11, fill: chartColors.tickText }}
                              tickLine={false}
                              axisLine={false}
                              width={80}
                            />
                            <Tooltip
                              formatter={(value: number) => [formatCurrency(value), 'Spent']}
                              contentStyle={{
                                backgroundColor: chartColors.tooltipBg,
                                border: `1px solid ${chartColors.tooltipBorder}`,
                                borderRadius: '6px',
                                fontSize: '12px',
                                color: chartColors.tooltipText,
                              }}
                              labelStyle={{ color: chartColors.tooltipText }}
                            />
                            <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                              {tagBreakdown.map((_, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={index === 0 ? '#6366f1' : isDarkMode ? '#818cf8' : '#a5b4fc'}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-gray-400 dark:text-gray-500 text-sm">No category data</p>
                    )}
                  </div>

                  {/* Top Transactions */}
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Largest Expenses</h5>
                    <div className="space-y-2">
                      {topTransactions.map((tx, idx) => (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between py-1.5 px-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-gray-400 dark:text-gray-500 w-4">{idx + 1}.</span>
                            <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                              {tx.description || 'No description'}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 ml-2">
                            {formatCurrency(tx.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Filters */}
        <Card padding="sm">
          <button
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            className="w-full flex items-center justify-between p-2"
          >
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span className="font-medium text-gray-700 dark:text-gray-300">Filters</span>
              {hasActiveFilters && (
                <span className="px-2 py-0.5 text-xs bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-full">
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

              {/* Custom Date Range Picker */}
              {dateRange === 'custom' && (
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Select Date Range</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        max={customEndDate || undefined}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        min={customStartDate || undefined}
                        max={new Date().toISOString().split('T')[0]}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  {(customStartDate || customEndDate) && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {customStartDate && customEndDate
                        ? `Showing transactions from ${parseLocalDate(customStartDate).toLocaleDateString()} to ${parseLocalDate(customEndDate).toLocaleDateString()}`
                        : customStartDate
                          ? `Showing transactions from ${parseLocalDate(customStartDate).toLocaleDateString()} onwards`
                          : `Showing transactions until ${parseLocalDate(customEndDate).toLocaleDateString()}`}
                    </p>
                  )}
                </div>
              )}

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
            subtitle={`${filteredTransactions.length} transaction${
              filteredTransactions.length !== 1 ? 's' : ''
            } • Total: ${formatCurrency(stats.total)}`}
          />

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400" />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p className="font-medium">No transactions found</p>
              <p className="text-sm mt-1">
                {hasActiveFilters
                  ? 'Try adjusting your filters'
                  : 'Start logging your spending to see history'}
              </p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-100 dark:divide-gray-700 -mx-4 md:-mx-6">
                {visibleTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    onClick={() => setEditingTransaction(tx)}
                    className="px-4 md:px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                            {tx.description || 'No description'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs md:text-sm text-gray-500 dark:text-gray-400">
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
                      <div className="flex items-center gap-3 ml-4">
                        <p className="font-semibold text-gray-900 dark:text-gray-100">
                          -{formatCurrency(tx.amount)}
                        </p>
                        <Edit2 className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
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

        {/* Edit Transaction Modal */}
        <EditSpendingModal
          isOpen={!!editingTransaction}
          onClose={() => setEditingTransaction(null)}
          transaction={editingTransaction}
        />
      </div>
    </AppLayout>
  );
};

// Parse a YYYY-MM-DD string as local time instead of UTC
function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}
