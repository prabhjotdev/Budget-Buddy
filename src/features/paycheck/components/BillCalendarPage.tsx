import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Check,
  Clock,
  AlertCircle,
  CreditCard,
  Zap,
  LayoutGrid,
  CalendarDays,
  List,
  TrendingUp,
} from 'lucide-react';
import clsx from 'clsx';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  addDays,
  addWeeks,
  addYears,
  isBefore,
  isAfter,
  differenceInDays,
} from 'date-fns';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { fetchBills } from '../billsSlice';
import { fetchPaycheckCycles } from '../paycheckCyclesSlice';
import { fetchPaymentMethods } from '../paymentMethodsSlice';
import { AppLayout } from '../../../components/layout';
import { Card, Modal, Button, Badge } from '../../../components/shared';
import { formatCurrency } from '../../../utils/currency';
import { Bill, PaycheckCycle } from '../../../types';

type CalendarView = 'month' | 'week' | 'list';

// Projected bill instance for calendar display
interface ProjectedBill {
  bill: Bill;
  date: Date;
  isPaid: boolean;
  isInCurrentCycle: boolean;
  cycleId?: string;
}

// Get the next occurrence of a bill after a given date
const getNextBillDate = (bill: Bill, afterDate: Date): Date => {
  const year = afterDate.getFullYear();
  const month = afterDate.getMonth();

  let nextDate = new Date(year, month, Math.min(bill.dueDay, new Date(year, month + 1, 0).getDate()));

  while (isBefore(nextDate, afterDate) || isSameDay(nextDate, afterDate)) {
    nextDate = advanceBillDate(nextDate, bill.frequency);
  }

  return nextDate;
};

// Advance a date based on bill frequency
const advanceBillDate = (date: Date, frequency: Bill['frequency']): Date => {
  switch (frequency) {
    case 'monthly':
      return addMonths(date, 1);
    case 'bi-weekly':
      return addWeeks(date, 2);
    case 'quarterly':
      return addMonths(date, 3);
    case 'semi-annual':
      return addMonths(date, 6);
    case 'annual':
      return addYears(date, 1);
    case 'one-time':
      return addYears(date, 100);
    default:
      return addMonths(date, 1);
  }
};

// Project bills for a date range
const projectBillsForRange = (
  bills: Bill[],
  startDate: Date,
  endDate: Date,
  cycles: PaycheckCycle[]
): ProjectedBill[] => {
  const projectedBills: ProjectedBill[] = [];

  bills.forEach((bill) => {
    if (!bill.isActive) return;

    let currentDate: Date;

    if (bill.frequency === 'bi-weekly') {
      const anchorSource = bill.startDate ? bill.startDate.toDate() : bill.createdAt.toDate();
      const anchorDate = new Date(
        anchorSource.getFullYear(),
        anchorSource.getMonth(),
        anchorSource.getDate()
      );

      currentDate = anchorDate;

      if (isAfter(currentDate, endDate)) return;

      while (isBefore(currentDate, startDate)) {
        currentDate = addWeeks(currentDate, 2);
      }

      let prevDate = addWeeks(currentDate, -2);
      while (
        (isAfter(prevDate, startDate) || isSameDay(prevDate, startDate)) &&
        (isBefore(prevDate, endDate) || isSameDay(prevDate, endDate))
      ) {
        currentDate = prevDate;
        prevDate = addWeeks(currentDate, -2);
      }
    } else if (
      bill.frequency === 'quarterly' ||
      bill.frequency === 'semi-annual' ||
      bill.frequency === 'annual'
    ) {
      const anchorSource = bill.startDate ? bill.startDate.toDate() : bill.createdAt.toDate();
      const anchorDate = new Date(
        anchorSource.getFullYear(),
        anchorSource.getMonth(),
        Math.min(
          bill.dueDay,
          new Date(anchorSource.getFullYear(), anchorSource.getMonth() + 1, 0).getDate()
        )
      );

      currentDate = anchorDate;

      if (isAfter(currentDate, endDate)) return;

      while (isBefore(currentDate, startDate)) {
        currentDate = advanceBillDate(currentDate, bill.frequency);
      }
    } else if (bill.frequency === 'one-time') {
      const paymentDate = bill.startDate ? bill.startDate.toDate() : bill.createdAt.toDate();
      currentDate = new Date(
        paymentDate.getFullYear(),
        paymentDate.getMonth(),
        paymentDate.getDate()
      );

      if (isBefore(currentDate, startDate) || isAfter(currentDate, endDate)) return;
    } else {
      const lookbackStart = subMonths(startDate, 1);
      currentDate = new Date(
        lookbackStart.getFullYear(),
        lookbackStart.getMonth(),
        Math.min(
          bill.dueDay,
          new Date(lookbackStart.getFullYear(), lookbackStart.getMonth() + 1, 0).getDate()
        )
      );

      if (isBefore(currentDate, lookbackStart)) {
        currentDate = getNextBillDate(bill, lookbackStart);
      }
    }

    while (isBefore(currentDate, endDate) || isSameDay(currentDate, endDate)) {
      if (
        (isAfter(currentDate, startDate) || isSameDay(currentDate, startDate)) &&
        (isBefore(currentDate, endDate) || isSameDay(currentDate, endDate))
      ) {
        let isPaid = false;
        let isInCurrentCycle = false;
        let cycleId: string | undefined;

        for (const cycle of cycles) {
          const cycleStart = cycle.startDate.toDate();
          const cycleEnd = cycle.endDate.toDate();

          if (
            (isAfter(currentDate, cycleStart) || isSameDay(currentDate, cycleStart)) &&
            (isBefore(currentDate, cycleEnd) || isSameDay(currentDate, cycleEnd))
          ) {
            cycleId = cycle.id;
            if (cycle.status === 'active') {
              isInCurrentCycle = true;
            }
            const cycleBill = cycle.bills.find((b) => b.billId === bill.id);
            if (cycleBill) {
              isPaid = cycleBill.isPaid;
            }
            break;
          }
        }

        projectedBills.push({
          bill,
          date: currentDate,
          isPaid,
          isInCurrentCycle,
          cycleId,
        });
      }

      if (bill.frequency === 'one-time') break;
      currentDate = advanceBillDate(currentDate, bill.frequency);
    }
  });

  return projectedBills.sort((a, b) => a.date.getTime() - b.date.getTime());
};

export const BillCalendarPage = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { byId: billsById, activeIds } = useAppSelector((state) => state.bills);
  const { byId: cyclesById, allIds: cycleIds, activeCycleId } = useAppSelector(
    (state) => state.paycheckCycles
  );
  const { byId: paymentMethodsById } = useAppSelector((state) => state.paymentMethods);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<CalendarView>('month');
  const [selectedBillKey, setSelectedBillKey] = useState<{
    billId: string;
    dateKey: string;
  } | null>(null);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);

  // Fetch data on mount
  useEffect(() => {
    if (user) {
      dispatch(fetchBills(user.uid));
      dispatch(fetchPaycheckCycles(user.uid));
      dispatch(fetchPaymentMethods(user.uid));
    }
  }, [dispatch, user]);

  // Re-fetch when the tab becomes visible again (handles Manager→Calendar sync)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        dispatch(fetchBills(user.uid));
        dispatch(fetchPaycheckCycles(user.uid));
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [dispatch, user]);

  // Get active bills
  const activeBills = useMemo(() => {
    return activeIds.map((id) => billsById[id]).filter(Boolean);
  }, [billsById, activeIds]);

  // Get all cycles
  const cycles = useMemo(() => {
    return cycleIds.map((id) => cyclesById[id]).filter(Boolean);
  }, [cyclesById, cycleIds]);

  // Get active cycle
  const activeCycle = activeCycleId ? cyclesById[activeCycleId] : null;

  // Calendar dates for month view
  const calendarDates = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // Week dates for week view (week containing currentMonth date)
  const weekDates = useMemo(() => {
    return eachDayOfInterval({
      start: startOfWeek(currentMonth),
      end: endOfWeek(currentMonth),
    });
  }, [currentMonth]);

  // Project bills for month view (current month + next month for sidebar)
  const projectedBills = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const nextMonthEnd = endOfMonth(addMonths(currentMonth, 1));
    return projectBillsForRange(activeBills, monthStart, nextMonthEnd, cycles);
  }, [activeBills, currentMonth, cycles]);

  // Project bills for list view (covers all cycles in Redux state)
  const listProjectedBills = useMemo(() => {
    if (viewMode !== 'list' || cycles.length === 0) return [];
    const allDates = cycles.flatMap((c) => [c.startDate.toDate(), c.endDate.toDate()]);
    const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));
    return projectBillsForRange(activeBills, minDate, maxDate, cycles);
  }, [viewMode, activeBills, cycles]);

  // Derive selectedBill from projectedBills based on key
  const selectedBill = useMemo(() => {
    if (!selectedBillKey) return null;
    const allBills = viewMode === 'list' ? listProjectedBills : projectedBills;
    return (
      allBills.find(
        (pb) =>
          pb.bill.id === selectedBillKey.billId &&
          format(pb.date, 'yyyy-MM-dd') === selectedBillKey.dateKey
      ) || null
    );
  }, [projectedBills, listProjectedBills, selectedBillKey, viewMode]);

  const setSelectedBill = (bill: ProjectedBill | null) => {
    if (bill) {
      setSelectedBillKey({ billId: bill.bill.id, dateKey: format(bill.date, 'yyyy-MM-dd') });
    } else {
      setSelectedBillKey(null);
    }
  };

  // Group bills by date for calendar display
  const billsByDate = useMemo(() => {
    const map = new Map<string, ProjectedBill[]>();
    projectedBills.forEach((pb) => {
      const key = format(pb.date, 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(pb);
    });
    return map;
  }, [projectedBills]);

  // Cycle ranges for the visible month (used in month + week views)
  const cycleRanges = useMemo(() => {
    return cycles
      .filter((cycle) => {
        const start = cycle.startDate.toDate();
        const end = cycle.endDate.toDate();
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(currentMonth);
        return (
          (isAfter(end, monthStart) || isSameDay(end, monthStart)) &&
          (isBefore(start, monthEnd) || isSameDay(start, monthEnd))
        );
      })
      .map((cycle) => ({
        id: cycle.id,
        start: cycle.startDate.toDate(),
        end: cycle.endDate.toDate(),
        isActive: cycle.status === 'active',
      }))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [cycles, currentMonth]);

  // All cycle ranges sorted for list view
  const allCycleRangesForList = useMemo(() => {
    return cycles
      .map((cycle) => ({
        id: cycle.id,
        cycle,
        start: cycle.startDate.toDate(),
        end: cycle.endDate.toDate(),
        isActive: cycle.status === 'active',
        status: cycle.status,
      }))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [cycles]);

  // Get cycle for a specific date (within current month's cycle ranges)
  const getCycleForDate = (date: Date) => {
    return cycleRanges.find(
      (range) =>
        (isAfter(date, range.start) || isSameDay(date, range.start)) &&
        (isBefore(date, range.end) || isSameDay(date, range.end))
    );
  };

  // Upcoming bills (next 14 days)
  const upcomingBills = useMemo(() => {
    const today = new Date();
    const twoWeeksFromNow = addDays(today, 14);
    return projectedBills.filter(
      (pb) =>
        !pb.isPaid &&
        (isAfter(pb.date, today) || isSameDay(pb.date, today)) &&
        isBefore(pb.date, twoWeeksFromNow)
    );
  }, [projectedBills]);

  // Monthly totals
  const monthlyTotals = useMemo(() => {
    const currentMonthStart = startOfMonth(currentMonth);
    const currentMonthEnd = endOfMonth(currentMonth);
    const nextMonthStart = startOfMonth(addMonths(currentMonth, 1));
    const nextMonthEnd = endOfMonth(addMonths(currentMonth, 1));

    const currentMonthBills = projectedBills.filter(
      (pb) =>
        (isAfter(pb.date, currentMonthStart) || isSameDay(pb.date, currentMonthStart)) &&
        (isBefore(pb.date, currentMonthEnd) || isSameDay(pb.date, currentMonthEnd))
    );

    const nextMonthBills = projectedBills.filter(
      (pb) =>
        (isAfter(pb.date, nextMonthStart) || isSameDay(pb.date, nextMonthStart)) &&
        (isBefore(pb.date, nextMonthEnd) || isSameDay(pb.date, nextMonthEnd))
    );

    return {
      currentMonth: currentMonthBills.reduce((sum, pb) => sum + pb.bill.amount, 0),
      currentMonthPaid: currentMonthBills
        .filter((pb) => pb.isPaid)
        .reduce((sum, pb) => sum + pb.bill.amount, 0),
      nextMonth: nextMonthBills.reduce((sum, pb) => sum + pb.bill.amount, 0),
    };
  }, [projectedBills, currentMonth]);

  // Find heaviest week
  const heaviestWeek = useMemo(() => {
    const weekTotals: { start: Date; total: number }[] = [];
    const monthStart = startOfMonth(currentMonth);
    let weekStart = startOfWeek(monthStart);

    while (isBefore(weekStart, endOfMonth(currentMonth))) {
      const weekEnd = endOfWeek(weekStart);
      const weekBills = projectedBills.filter(
        (pb) =>
          (isAfter(pb.date, weekStart) || isSameDay(pb.date, weekStart)) &&
          (isBefore(pb.date, weekEnd) || isSameDay(pb.date, weekEnd))
      );
      weekTotals.push({
        start: weekStart,
        total: weekBills.reduce((sum, pb) => sum + pb.bill.amount, 0),
      });
      weekStart = addWeeks(weekStart, 1);
    }

    return weekTotals.reduce(
      (max, week) => (week.total > max.total ? week : max),
      weekTotals[0]
    );
  }, [projectedBills, currentMonth]);

  // Active cycle metrics for banner
  const activeCycleMetrics = useMemo(() => {
    if (!activeCycle) return null;
    const start = activeCycle.startDate.toDate();
    const end = activeCycle.endDate.toDate();
    const today = new Date();
    const totalDays = differenceInDays(end, start) + 1;
    const elapsed = Math.max(0, differenceInDays(today, start) + 1);
    const remaining = Math.max(0, differenceInDays(end, today));
    const cycleProgress = Math.min(100, Math.round((elapsed / totalDays) * 100));
    const paidCount = activeCycle.bills.filter((b) => b.isPaid).length;
    const totalCount = activeCycle.bills.length;
    const billsProgress = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;
    const paidAmount = activeCycle.bills
      .filter((b) => b.isPaid)
      .reduce((s, b) => s + b.amount, 0);
    const totalBillAmount = activeCycle.bills.reduce((s, b) => s + b.amount, 0);
    // Find which cycle number this is in the sorted list
    const sortedCycles = [...cycles].sort(
      (a, b) => a.startDate.toDate().getTime() - b.startDate.toDate().getTime()
    );
    const cycleNum = sortedCycles.findIndex((c) => c.id === activeCycleId) + 1;

    return {
      start,
      end,
      totalDays,
      elapsed,
      remaining,
      cycleProgress,
      paidCount,
      totalCount,
      billsProgress,
      paidAmount,
      totalBillAmount,
      cycleNum,
    };
  }, [activeCycle, activeCycleId, cycles]);

  // Navigation (handles month and week view differences)
  const navigatePrev = () => {
    if (viewMode === 'week') {
      setCurrentMonth((prev) => addDays(prev, -7));
    } else {
      setCurrentMonth((prev) => subMonths(prev, 1));
    }
  };

  const navigateNext = () => {
    if (viewMode === 'week') {
      setCurrentMonth((prev) => addDays(prev, 7));
    } else {
      setCurrentMonth((prev) => addMonths(prev, 1));
    }
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  // Header title changes based on view mode
  const headerTitle = useMemo(() => {
    if (viewMode === 'week') {
      const ws = startOfWeek(currentMonth);
      const we = endOfWeek(currentMonth);
      return isSameMonth(ws, we)
        ? `${format(ws, 'MMM d')} – ${format(we, 'd, yyyy')}`
        : `${format(ws, 'MMM d')} – ${format(we, 'MMM d, yyyy')}`;
    }
    return format(currentMonth, 'MMMM yyyy');
  }, [viewMode, currentMonth]);

  // Day labels
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <AppLayout title="Bill Calendar">
      <div className="space-y-4 md:space-y-6">

        {/* ── Active Cycle Banner ── */}
        {activeCycle && activeCycleMetrics && (
          <Card className="border-indigo-200 dark:border-indigo-700 bg-gradient-to-br from-indigo-50 to-blue-50/60 dark:from-indigo-950/60 dark:to-blue-950/40">
            <div className="flex flex-wrap gap-4 items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                    Active Pay Cycle {activeCycleMetrics.cycleNum}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {format(activeCycleMetrics.start, 'MMM d')} –{' '}
                  {format(activeCycleMetrics.end, 'MMM d, yyyy')}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {activeCycleMetrics.remaining === 0
                    ? 'Last day of cycle'
                    : activeCycleMetrics.remaining > 0
                    ? `${activeCycleMetrics.remaining} day${activeCycleMetrics.remaining !== 1 ? 's' : ''} remaining`
                    : 'Cycle has ended'}
                  {' · '}
                  {activeCycleMetrics.elapsed} of {activeCycleMetrics.totalDays} days elapsed
                </p>
              </div>

              <div className="flex gap-5 sm:gap-8 text-center flex-wrap">
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-none">
                    {activeCycleMetrics.paidCount}
                    <span className="text-base font-normal text-gray-400 dark:text-gray-500">
                      /{activeCycleMetrics.totalCount}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Bills Paid</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400 leading-none">
                    {formatCurrency(activeCycleMetrics.paidAmount)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    of {formatCurrency(activeCycleMetrics.totalBillAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-none">
                    {formatCurrency(activeCycle.remainingToSpend)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Left to Spend</p>
                </div>
              </div>
            </div>

            {/* Progress bars */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    Cycle timeline
                  </span>
                  <span>{activeCycleMetrics.cycleProgress}% elapsed</span>
                </div>
                <div className="h-2.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 dark:bg-indigo-400 rounded-full transition-all duration-500"
                    style={{ width: `${activeCycleMetrics.cycleProgress}%` }}
                  />
                </div>
              </div>
              {activeCycleMetrics.totalCount > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                    <span className="flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Bills paid
                    </span>
                    <span>
                      {activeCycleMetrics.paidCount}/{activeCycleMetrics.totalCount} (
                      {activeCycleMetrics.billsProgress}%)
                    </span>
                  </div>
                  <div className="h-2.5 bg-green-100 dark:bg-green-900/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 dark:bg-green-400 rounded-full transition-all duration-500"
                      style={{ width: `${activeCycleMetrics.billsProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
          {/* ── Main Calendar Panel ── */}
          <div className="flex-1 min-w-0">
            <Card>
              {/* Calendar Header */}
              <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <div className="flex items-center gap-1">
                  <button
                    onClick={navigatePrev}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    aria-label="Previous"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </button>
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 min-w-[160px] sm:min-w-[200px] text-center">
                    {headerTitle}
                  </h2>
                  <button
                    onClick={navigateNext}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    aria-label="Next"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* View mode toggle */}
                  <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-700/80 rounded-lg p-1">
                    {(
                      [
                        { id: 'month' as CalendarView, icon: LayoutGrid, label: 'Month' },
                        { id: 'week' as CalendarView, icon: CalendarDays, label: 'Week' },
                        { id: 'list' as CalendarView, icon: List, label: 'List' },
                      ] as const
                    ).map(({ id, icon: Icon, label }) => (
                      <button
                        key={id}
                        onClick={() => setViewMode(id)}
                        className={clsx(
                          'flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all',
                          viewMode === id
                            ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        )}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{label}</span>
                      </button>
                    ))}
                  </div>
                  <Button size="sm" variant="secondary" onClick={goToToday}>
                    Today
                  </Button>
                </div>
              </div>

              {/* ═══════════════════════════════════════════
                  MONTH VIEW
              ═══════════════════════════════════════════ */}
              {viewMode === 'month' && (
                <>
                  {/* Cycle Legend */}
                  {cycleRanges.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {cycleRanges.map((range, index) => (
                        <div
                          key={range.id}
                          className={clsx(
                            'flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs',
                            range.isActive
                              ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-600 font-semibold'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600'
                          )}
                        >
                          <div
                            className={clsx(
                              'w-2 h-2 rounded-full flex-shrink-0',
                              range.isActive
                                ? 'bg-indigo-500 animate-pulse'
                                : 'bg-gray-400 dark:bg-gray-500'
                            )}
                          />
                          Cycle {index + 1}
                          {range.isActive && ' (active)'}:{' '}
                          {format(range.start, 'MMM d')} – {format(range.end, 'MMM d')}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Day Headers */}
                  <div className="grid grid-cols-7 mb-1">
                    {dayLabels.map((day) => (
                      <div
                        key={day}
                        className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-2"
                      >
                        <span className="hidden sm:inline">{day}</span>
                        <span className="sm:hidden">{day.charAt(0)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
                    {calendarDates.map((date) => {
                      const dateKey = format(date, 'yyyy-MM-dd');
                      const dayBills = billsByDate.get(dateKey) || [];
                      const isCurrentMonth = isSameMonth(date, currentMonth);
                      const isTodayDate = isToday(date);
                      const cycle = getCycleForDate(date);
                      const cycleIdx = cycle
                        ? cycleRanges.findIndex((r) => r.id === cycle.id)
                        : -1;
                      const isFirstDayOfCycle = !!(cycle && isSameDay(date, cycle.start));
                      const isLastDayOfCycle = !!(cycle && isSameDay(date, cycle.end));

                      return (
                        <div
                          key={dateKey}
                          className={clsx(
                            'min-h-[60px] sm:min-h-[85px] md:min-h-[100px] p-1 relative',
                            // Base cell color
                            !cycle && !isCurrentMonth && 'bg-gray-50 dark:bg-gray-900',
                            !cycle && isCurrentMonth && 'bg-white dark:bg-gray-800',
                            // Non-active cycle: very subtle tint
                            cycle && !cycle.isActive && isCurrentMonth &&
                              'bg-slate-50 dark:bg-gray-800',
                            cycle && !cycle.isActive && !isCurrentMonth &&
                              'bg-gray-50 dark:bg-gray-900',
                            // Active cycle: indigo tint
                            cycle?.isActive && 'bg-indigo-50/80 dark:bg-indigo-900/25',
                          )}
                          style={{
                            borderLeft: isFirstDayOfCycle
                              ? `3px solid ${cycle?.isActive ? '#6366f1' : '#94a3b8'}`
                              : undefined,
                          }}
                        >
                          {/* Cycle start badge */}
                          {isFirstDayOfCycle && isCurrentMonth && (
                            <div
                              className={clsx(
                                'absolute top-0.5 right-0.5 text-[9px] font-bold px-1 py-px rounded leading-tight',
                                cycle?.isActive
                                  ? 'bg-indigo-500 text-white'
                                  : 'bg-slate-400 dark:bg-slate-500 text-white'
                              )}
                            >
                              C{cycleIdx + 1}
                            </div>
                          )}

                          {/* Cycle end marker */}
                          {isLastDayOfCycle && isCurrentMonth && (
                            <div
                              className={clsx(
                                'absolute bottom-0.5 right-1 text-[8px] font-medium leading-tight',
                                cycle?.isActive
                                  ? 'text-indigo-400 dark:text-indigo-500'
                                  : 'text-slate-300 dark:text-slate-600'
                              )}
                            >
                              end
                            </div>
                          )}

                          {/* Date number */}
                          <div className="flex items-center mb-1">
                            <span
                              className={clsx(
                                'text-xs sm:text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full',
                                isTodayDate && 'bg-indigo-600 text-white',
                                !isTodayDate &&
                                  isCurrentMonth &&
                                  'text-gray-900 dark:text-gray-100',
                                !isTodayDate &&
                                  !isCurrentMonth &&
                                  'text-gray-400 dark:text-gray-500'
                              )}
                            >
                              {format(date, 'd')}
                            </span>
                          </div>

                          {/* Bills */}
                          <div className="space-y-0.5">
                            {dayBills.slice(0, 3).map((pb, idx) => (
                              <button
                                key={`${pb.bill.id}-${idx}`}
                                onClick={() => setSelectedBill(pb)}
                                className={clsx(
                                  'w-full text-left text-xs px-1 py-0.5 rounded truncate transition-colors',
                                  pb.isPaid
                                    ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/70'
                                    : pb.isInCurrentCycle
                                    ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-900/70'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                )}
                              >
                                <span className="hidden sm:inline">{pb.bill.name}</span>
                                <span className="sm:hidden">
                                  {pb.bill.name.substring(0, 3)}
                                </span>
                              </button>
                            ))}
                            {dayBills.length > 3 && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 px-1">
                                +{dayBills.length - 3} more
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 text-xs text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded bg-green-100 dark:bg-green-900/50 border border-green-300 dark:border-green-700" />
                      <span>Paid</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded bg-yellow-100 dark:bg-yellow-900/50 border border-yellow-300 dark:border-yellow-700" />
                      <span>Current Cycle</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600" />
                      <span>Future</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3.5 h-3 rounded bg-indigo-50 dark:bg-indigo-900/30 border-l-2 border-indigo-400" />
                      <span>Active Cycle Period</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="inline-block text-[9px] font-bold bg-indigo-500 text-white px-1 rounded">
                        C1
                      </span>
                      <span>Cycle start</span>
                    </div>
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════════
                  WEEK VIEW
              ═══════════════════════════════════════════ */}
              {viewMode === 'week' && (
                <>
                  {/* Cycle indicator for the week */}
                  {(() => {
                    const weekCycles = weekDates
                      .map((d) => getCycleForDate(d))
                      .filter(Boolean)
                      .filter(
                        (c, i, arr) => arr.findIndex((x) => x?.id === c?.id) === i
                      );
                    if (weekCycles.length === 0) return null;
                    return (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {weekCycles.map((c) => {
                          const idx = cycleRanges.findIndex((r) => r.id === c!.id);
                          return (
                            <div
                              key={c!.id}
                              className={clsx(
                                'flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs',
                                c!.isActive
                                  ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-600 font-semibold'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600'
                              )}
                            >
                              <div
                                className={clsx(
                                  'w-2 h-2 rounded-full',
                                  c!.isActive
                                    ? 'bg-indigo-500 animate-pulse'
                                    : 'bg-gray-400'
                                )}
                              />
                              Cycle {idx + 1}
                              {c!.isActive && ' (active)'}:{' '}
                              {format(c!.start, 'MMM d')} – {format(c!.end, 'MMM d')}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Day Headers */}
                  <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 rounded-t-lg overflow-hidden mb-px">
                    {weekDates.map((date) => {
                      const isTodayDate = isToday(date);
                      const cycle = getCycleForDate(date);
                      const isFirstDay = !!(cycle && isSameDay(date, cycle.start));
                      const cycleIdx = cycle
                        ? cycleRanges.findIndex((r) => r.id === cycle.id)
                        : -1;

                      return (
                        <div
                          key={format(date, 'yyyy-MM-dd')}
                          className={clsx(
                            'text-center py-3 px-1',
                            cycle?.isActive
                              ? 'bg-indigo-50 dark:bg-indigo-900/30'
                              : 'bg-white dark:bg-gray-800',
                            isTodayDate && 'bg-indigo-100/80 dark:bg-indigo-900/50',
                          )}
                          style={{
                            borderLeft: isFirstDay
                              ? `3px solid ${cycle?.isActive ? '#6366f1' : '#94a3b8'}`
                              : undefined,
                          }}
                        >
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            {format(date, 'EEE')}
                          </p>
                          <div
                            className={clsx(
                              'text-xl font-bold mt-0.5 w-10 h-10 rounded-full flex items-center justify-center mx-auto',
                              isTodayDate
                                ? 'bg-indigo-600 text-white'
                                : 'text-gray-900 dark:text-gray-100'
                            )}
                          >
                            {format(date, 'd')}
                          </div>
                          {cycle && (
                            <p
                              className={clsx(
                                'text-[10px] mt-1 font-semibold',
                                cycle.isActive
                                  ? 'text-indigo-500 dark:text-indigo-400'
                                  : 'text-slate-400 dark:text-slate-500'
                              )}
                            >
                              {cycle.isActive ? '● Active' : `C${cycleIdx + 1}`}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Week cells */}
                  <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 rounded-b-lg overflow-hidden">
                    {weekDates.map((date) => {
                      const dateKey = format(date, 'yyyy-MM-dd');
                      const dayBills = billsByDate.get(dateKey) || [];
                      const cycle = getCycleForDate(date);
                      const isFirstDay = !!(cycle && isSameDay(date, cycle.start));

                      return (
                        <div
                          key={dateKey}
                          className={clsx(
                            'min-h-[160px] p-2',
                            cycle?.isActive
                              ? 'bg-indigo-50/60 dark:bg-indigo-900/20'
                              : 'bg-white dark:bg-gray-800',
                          )}
                          style={{
                            borderLeft: isFirstDay
                              ? `3px solid ${cycle?.isActive ? '#6366f1' : '#94a3b8'}`
                              : undefined,
                          }}
                        >
                          {dayBills.length === 0 ? (
                            <p className="text-xs text-gray-300 dark:text-gray-600 text-center mt-6 select-none">
                              —
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              {dayBills.map((pb, idx) => (
                                <button
                                  key={`${pb.bill.id}-${idx}`}
                                  onClick={() => setSelectedBill(pb)}
                                  className={clsx(
                                    'w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors',
                                    pb.isPaid
                                      ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-900/70'
                                      : pb.isInCurrentCycle
                                      ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 hover:bg-yellow-200 dark:hover:bg-yellow-900/70'
                                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                  )}
                                >
                                  <div className="flex items-center justify-between gap-1 min-w-0">
                                    <span className="font-medium truncate">{pb.bill.name}</span>
                                    {pb.isPaid && (
                                      <Check className="w-3 h-3 flex-shrink-0 text-green-600 dark:text-green-400" />
                                    )}
                                  </div>
                                  <p className="font-semibold mt-0.5">
                                    {formatCurrency(pb.bill.amount)}
                                  </p>
                                  {pb.bill.isAutoPay && (
                                    <p className="text-[10px] opacity-60 flex items-center gap-0.5 mt-0.5">
                                      <Zap className="w-2.5 h-2.5" />
                                      AutoPay
                                    </p>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Week summary bar */}
                  {(() => {
                    const weekTotal = weekDates.reduce((sum, date) => {
                      const key = format(date, 'yyyy-MM-dd');
                      return (
                        sum +
                        (billsByDate.get(key) || []).reduce((s, pb) => s + pb.bill.amount, 0)
                      );
                    }, 0);
                    const weekPaid = weekDates.reduce((sum, date) => {
                      const key = format(date, 'yyyy-MM-dd');
                      return (
                        sum +
                        (billsByDate.get(key) || [])
                          .filter((pb) => pb.isPaid)
                          .reduce((s, pb) => s + pb.bill.amount, 0)
                      );
                    }, 0);
                    if (weekTotal === 0) return null;
                    return (
                      <div className="mt-4 flex items-center justify-between px-1 text-sm text-gray-600 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-3">
                        <span>
                          Week total:{' '}
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {formatCurrency(weekTotal)}
                          </span>
                        </span>
                        {weekPaid > 0 && (
                          <span className="text-green-600 dark:text-green-400 font-medium">
                            {formatCurrency(weekPaid)} paid
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* Legend */}
                  <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 text-xs text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded bg-green-100 dark:bg-green-900/50 border border-green-300 dark:border-green-700" />
                      <span>Paid</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded bg-yellow-100 dark:bg-yellow-900/50 border border-yellow-300 dark:border-yellow-700" />
                      <span>Current Cycle</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600" />
                      <span>Future</span>
                    </div>
                  </div>
                </>
              )}

              {/* ═══════════════════════════════════════════
                  LIST / AGENDA VIEW
              ═══════════════════════════════════════════ */}
              {viewMode === 'list' && (
                <div className="space-y-3">
                  {allCycleRangesForList.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-10">
                      No pay cycles found. Create a pay cycle to see bills organized by cycle.
                    </p>
                  ) : (
                    allCycleRangesForList.map((cr, idx) => {
                      const cycleBills = listProjectedBills
                        .filter((pb) => pb.cycleId === cr.id)
                        .sort((a, b) => a.date.getTime() - b.date.getTime());

                      const totalAmount = cycleBills.reduce((s, pb) => s + pb.bill.amount, 0);
                      const paidAmount = cycleBills
                        .filter((pb) => pb.isPaid)
                        .reduce((s, pb) => s + pb.bill.amount, 0);
                      const paidCount = cycleBills.filter((pb) => pb.isPaid).length;

                      const statusLabel =
                        cr.status === 'active'
                          ? 'Active'
                          : cr.status === 'completed'
                          ? 'Completed'
                          : cr.status === 'deficit'
                          ? 'Deficit'
                          : 'Upcoming';

                      return (
                        <div
                          key={cr.id}
                          className={clsx(
                            'rounded-xl border overflow-hidden',
                            cr.isActive
                              ? 'border-indigo-300 dark:border-indigo-600'
                              : 'border-gray-200 dark:border-gray-700'
                          )}
                        >
                          {/* Cycle header */}
                          <div
                            className={clsx(
                              'px-4 py-3 flex items-center justify-between gap-3 flex-wrap',
                              cr.isActive
                                ? 'bg-indigo-50 dark:bg-indigo-900/30'
                                : 'bg-gray-50 dark:bg-gray-800/60'
                            )}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <div
                                className={clsx(
                                  'w-2 h-2 rounded-full flex-shrink-0',
                                  cr.isActive
                                    ? 'bg-indigo-500 animate-pulse'
                                    : cr.status === 'completed'
                                    ? 'bg-green-500'
                                    : 'bg-gray-400'
                                )}
                              />
                              <span
                                className={clsx(
                                  'font-semibold text-sm',
                                  cr.isActive
                                    ? 'text-indigo-700 dark:text-indigo-300'
                                    : 'text-gray-700 dark:text-gray-300'
                                )}
                              >
                                Cycle {idx + 1}
                              </span>
                              <span
                                className={clsx(
                                  'text-xs px-2 py-0.5 rounded-full font-medium',
                                  cr.isActive
                                    ? 'bg-indigo-200 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300'
                                    : cr.status === 'completed'
                                    ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400'
                                    : cr.status === 'deficit'
                                    ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400'
                                    : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                                )}
                              >
                                {statusLabel}
                              </span>
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                {format(cr.start, 'MMM d')} – {format(cr.end, 'MMM d, yyyy')}
                              </span>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {formatCurrency(totalAmount)}
                              </p>
                              {paidCount > 0 && cycleBills.length > 0 && (
                                <p className="text-xs text-green-600 dark:text-green-400">
                                  {paidCount}/{cycleBills.length} paid ·{' '}
                                  {formatCurrency(paidAmount)}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Bills list */}
                          {cycleBills.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500 italic">
                              No bills projected for this cycle
                            </div>
                          ) : (
                            <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
                              {cycleBills.map((pb, bidx) => (
                                <button
                                  key={`${pb.bill.id}-${bidx}`}
                                  onClick={() => setSelectedBill(pb)}
                                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors text-left gap-3"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div
                                      className={clsx(
                                        'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
                                        pb.isPaid
                                          ? 'bg-green-100 dark:bg-green-900/50'
                                          : pb.isInCurrentCycle
                                          ? 'bg-yellow-100 dark:bg-yellow-900/50'
                                          : 'bg-gray-100 dark:bg-gray-700'
                                      )}
                                    >
                                      {pb.isPaid ? (
                                        <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                                      ) : pb.isInCurrentCycle ? (
                                        <Clock className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />
                                      ) : (
                                        <div className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500" />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p
                                        className={clsx(
                                          'text-sm font-medium truncate',
                                          pb.isPaid
                                            ? 'text-gray-400 dark:text-gray-500 line-through'
                                            : 'text-gray-900 dark:text-gray-100'
                                        )}
                                      >
                                        {pb.bill.name}
                                      </p>
                                      <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5 mt-0.5">
                                        {format(pb.date, 'EEE, MMM d')}
                                        {pb.bill.isAutoPay && (
                                          <span className="flex items-center gap-0.5">
                                            <Zap className="w-2.5 h-2.5" />
                                            AutoPay
                                          </span>
                                        )}
                                        {pb.bill.isVariable && (
                                          <span className="flex items-center gap-0.5">
                                            <AlertCircle className="w-2.5 h-2.5" />
                                            Variable
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                  <span
                                    className={clsx(
                                      'font-semibold text-sm flex-shrink-0',
                                      pb.isPaid
                                        ? 'text-gray-400 dark:text-gray-500'
                                        : 'text-gray-900 dark:text-gray-100'
                                    )}
                                  >
                                    {formatCurrency(pb.bill.amount)}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </Card>
          </div>

          {/* ── Sidebar (hidden in list view) ── */}
          {viewMode !== 'list' && (
            <div className="lg:w-80 space-y-4">
              {/* Upcoming Bills */}
              <Card>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  Upcoming Bills
                </h3>
                {upcomingBills.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No upcoming bills in the next 14 days
                  </p>
                ) : (
                  <div className="space-y-2">
                    {upcomingBills.slice(0, showAllUpcoming ? undefined : 5).map((pb, idx) => (
                      <button
                        key={`${pb.bill.id}-${idx}`}
                        onClick={() => setSelectedBill(pb)}
                        className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                      >
                        <div>
                          <p className="font-medium text-sm text-gray-900 dark:text-gray-100">
                            {pb.bill.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {format(pb.date, 'MMM d, yyyy')}
                          </p>
                        </div>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">
                          {formatCurrency(pb.bill.amount)}
                        </span>
                      </button>
                    ))}
                    {upcomingBills.length > 5 && (
                      <button
                        onClick={() => setShowAllUpcoming(!showAllUpcoming)}
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-center pt-2 w-full transition-colors"
                      >
                        {showAllUpcoming ? 'Show less' : `+${upcomingBills.length - 5} more`}
                      </button>
                    )}
                  </div>
                )}
              </Card>

              {/* Monthly Summary */}
              <Card>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  Monthly Summary
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {format(currentMonth, 'MMMM')}
                    </span>
                    <div className="text-right">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {formatCurrency(monthlyTotals.currentMonth)}
                      </span>
                      {monthlyTotals.currentMonthPaid > 0 && (
                        <p className="text-xs text-green-600 dark:text-green-400">
                          {formatCurrency(monthlyTotals.currentMonthPaid)} paid
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {format(addMonths(currentMonth, 1), 'MMMM')}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {formatCurrency(monthlyTotals.nextMonth)}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Heaviest Week Alert */}
              {heaviestWeek && heaviestWeek.total > 0 && (
                <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30">
                  <h3 className="font-semibold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Heaviest Week
                  </h3>
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Week of {format(heaviestWeek.start, 'MMM d')}:{' '}
                    <span className="font-semibold">{formatCurrency(heaviestWeek.total)}</span>{' '}
                    in bills
                  </p>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Bill Detail Modal ── */}
      <Modal isOpen={!!selectedBill} onClose={() => setSelectedBill(null)} title="Bill Details">
        {selectedBill && (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {selectedBill.bill.name}
                </h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {formatCurrency(selectedBill.bill.amount)}
                </p>
              </div>
              <Badge
                variant={
                  selectedBill.isPaid
                    ? 'success'
                    : selectedBill.isInCurrentCycle
                    ? 'warning'
                    : 'default'
                }
              >
                {selectedBill.isPaid ? (
                  <>
                    <Check className="w-3 h-3 mr-1" />
                    Paid
                  </>
                ) : selectedBill.isInCurrentCycle ? (
                  <>
                    <Clock className="w-3 h-3 mr-1" />
                    Due Soon
                  </>
                ) : (
                  'Upcoming'
                )}
              </Badge>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                <CalendarIcon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                <span>Due: {format(selectedBill.date, 'EEEE, MMMM d, yyyy')}</span>
              </div>

              <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                <Clock className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                <span className="capitalize">{selectedBill.bill.frequency} bill</span>
              </div>

              {selectedBill.bill.paymentMethodId &&
                paymentMethodsById[selectedBill.bill.paymentMethodId] && (
                  <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                    <CreditCard className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    <span>
                      {paymentMethodsById[selectedBill.bill.paymentMethodId].name}
                    </span>
                  </div>
                )}

              {selectedBill.bill.isAutoPay && (
                <div className="flex items-center gap-3 text-green-600 dark:text-green-400">
                  <Zap className="w-4 h-4" />
                  <span>AutoPay enabled</span>
                </div>
              )}

              {selectedBill.bill.isVariable && (
                <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
                  <AlertCircle className="w-4 h-4" />
                  <span>Variable amount — confirm each cycle</span>
                </div>
              )}
            </div>

            {selectedBill.cycleId && activeCycle && selectedBill.cycleId === activeCycle.id && (
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-sm text-indigo-700 dark:text-indigo-300">
                This bill is scheduled for your current pay cycle
                {!selectedBill.isPaid && (
                  <span>. Go to the Paycheck page to mark it as paid.</span>
                )}
              </div>
            )}

            <div className="pt-2">
              <Button variant="secondary" className="w-full" onClick={() => setSelectedBill(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </AppLayout>
  );
};
