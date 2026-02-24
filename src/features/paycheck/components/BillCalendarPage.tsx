import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar as CalendarIcon,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Layers,
  LayoutGrid,
  RefreshCw,
  Zap,
} from 'lucide-react';
import clsx from 'clsx';
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { fetchBills } from '../billsSlice';
import { fetchPaycheckCycles } from '../paycheckCyclesSlice';
import { fetchPaymentMethods } from '../paymentMethodsSlice';
import { AppLayout } from '../../../components/layout';
import { Badge, Button, Card, Modal } from '../../../components/shared';
import { formatCurrency } from '../../../utils/currency';
import { Bill, PaycheckCycle } from '../../../types';

type ViewMode = 'month' | 'week' | 'cycle';

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

  // Start with the due day in the current month
  let nextDate = new Date(year, month, Math.min(bill.dueDay, new Date(year, month + 1, 0).getDate()));

  // If that's before afterDate, move forward based on frequency
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
      return addYears(date, 100); // Effectively never repeats
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

      if (isAfter(currentDate, endDate)) {
        return;
      }

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
        Math.min(bill.dueDay, new Date(anchorSource.getFullYear(), anchorSource.getMonth() + 1, 0).getDate())
      );

      currentDate = anchorDate;

      if (isAfter(currentDate, endDate)) {
        return;
      }

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

      if (isBefore(currentDate, startDate) || isAfter(currentDate, endDate)) {
        return;
      }
    } else {
      const lookbackStart = subMonths(startDate, 1);
      currentDate = new Date(
        lookbackStart.getFullYear(),
        lookbackStart.getMonth(),
        Math.min(bill.dueDay, new Date(lookbackStart.getFullYear(), lookbackStart.getMonth() + 1, 0).getDate())
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

  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date()));
  const [selectedBillKey, setSelectedBillKey] = useState<{ billId: string; dateKey: string } | null>(null);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchAllData = useCallback(() => {
    if (user) {
      dispatch(fetchBills(user.uid));
      dispatch(fetchPaycheckCycles(user.uid));
      dispatch(fetchPaymentMethods(user.uid));
    }
  }, [dispatch, user]);

  // Fetch on mount
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Re-fetch when the window regains focus — ensures Manager tab changes are reflected
  useEffect(() => {
    const handleFocus = () => fetchAllData();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchAllData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchAllData();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  // ── Derived data ─────────────────────────────────────────────────────────────

  const activeBills = useMemo(
    () => activeIds.map((id) => billsById[id]).filter(Boolean),
    [billsById, activeIds]
  );

  const cycles = useMemo(
    () => cycleIds.map((id) => cyclesById[id]).filter(Boolean),
    [cyclesById, cycleIds]
  );

  const activeCycle = activeCycleId ? cyclesById[activeCycleId] : null;

  // Month-view calendar grid dates
  const calendarDates = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    return eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(monthEnd) });
  }, [currentMonth]);

  // Week-view dates
  const weekDates = useMemo(
    () => eachDayOfInterval({ start: currentWeekStart, end: endOfWeek(currentWeekStart) }),
    [currentWeekStart]
  );

  // Bills projected for current month + next (used by month view and sidebar)
  const projectedBills = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(addMonths(currentMonth, 1));
    return projectBillsForRange(activeBills, start, end, cycles);
  }, [activeBills, currentMonth, cycles]);

  // Bills projected for the visible week (week view)
  const weekProjectedBills = useMemo(() => {
    if (viewMode !== 'week') return [];
    return projectBillsForRange(activeBills, currentWeekStart, endOfWeek(currentWeekStart), cycles);
  }, [activeBills, currentWeekStart, cycles, viewMode]);

  // Resolve selectedBill by key so it stays reactive to state changes
  const selectedBill = useMemo(() => {
    if (!selectedBillKey) return null;
    const allBills = [...projectedBills, ...weekProjectedBills];
    return (
      allBills.find(
        (pb) =>
          pb.bill.id === selectedBillKey.billId &&
          format(pb.date, 'yyyy-MM-dd') === selectedBillKey.dateKey
      ) || null
    );
  }, [projectedBills, weekProjectedBills, selectedBillKey]);

  const setSelectedBill = (bill: ProjectedBill | null) => {
    if (bill) {
      setSelectedBillKey({ billId: bill.bill.id, dateKey: format(bill.date, 'yyyy-MM-dd') });
    } else {
      setSelectedBillKey(null);
    }
  };

  // Bills grouped by date (source depends on view)
  const billsByDate = useMemo(() => {
    const map = new Map<string, ProjectedBill[]>();
    const source = viewMode === 'week' ? weekProjectedBills : projectedBills;
    source.forEach((pb) => {
      const key = format(pb.date, 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(pb);
    });
    return map;
  }, [viewMode, projectedBills, weekProjectedBills]);

  // Cycle ranges visible in the current month (for overlay / legend)
  const cycleRanges = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    return cycles
      .filter((c) => {
        const s = c.startDate.toDate();
        const e = c.endDate.toDate();
        return (
          (isAfter(e, monthStart) || isSameDay(e, monthStart)) &&
          (isBefore(s, monthEnd) || isSameDay(s, monthEnd))
        );
      })
      .map((c) => ({
        id: c.id,
        start: c.startDate.toDate(),
        end: c.endDate.toDate(),
        isActive: c.status === 'active',
      }))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [cycles, currentMonth]);

  // All cycle ranges (used for week / cycle views)
  const allCycleRanges = useMemo(
    () =>
      cycles.map((c) => ({
        id: c.id,
        start: c.startDate.toDate(),
        end: c.endDate.toDate(),
        isActive: c.status === 'active',
        paycheckAmount: c.paycheckAmount,
      })),
    [cycles]
  );

  const getCycleForDate = (date: Date) =>
    allCycleRanges.find(
      (r) =>
        (isAfter(date, r.start) || isSameDay(date, r.start)) &&
        (isBefore(date, r.end) || isSameDay(date, r.end))
    );

  // Helpers for cycle boundary detection
  const isCycleStartDay = (date: Date) => cycleRanges.some((r) => isSameDay(date, r.start));
  const isCycleEndDay = (date: Date) => cycleRanges.some((r) => isSameDay(date, r.end));
  const isActiveCycleDay = (date: Date) =>
    cycleRanges.some(
      (r) =>
        r.isActive &&
        (isAfter(date, r.start) || isSameDay(date, r.start)) &&
        (isBefore(date, r.end) || isSameDay(date, r.end))
    );

  // Upcoming bills for sidebar (next 14 days, unpaid)
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

  // Monthly totals for sidebar
  const monthlyTotals = useMemo(() => {
    const curStart = startOfMonth(currentMonth);
    const curEnd = endOfMonth(currentMonth);
    const nxtStart = startOfMonth(addMonths(currentMonth, 1));
    const nxtEnd = endOfMonth(addMonths(currentMonth, 1));

    const cur = projectedBills.filter(
      (pb) =>
        (isAfter(pb.date, curStart) || isSameDay(pb.date, curStart)) &&
        (isBefore(pb.date, curEnd) || isSameDay(pb.date, curEnd))
    );
    const nxt = projectedBills.filter(
      (pb) =>
        (isAfter(pb.date, nxtStart) || isSameDay(pb.date, nxtStart)) &&
        (isBefore(pb.date, nxtEnd) || isSameDay(pb.date, nxtEnd))
    );

    return {
      currentMonth: cur.reduce((s, pb) => s + pb.bill.amount, 0),
      currentMonthPaid: cur.filter((pb) => pb.isPaid).reduce((s, pb) => s + pb.bill.amount, 0),
      nextMonth: nxt.reduce((s, pb) => s + pb.bill.amount, 0),
    };
  }, [projectedBills, currentMonth]);

  // Heaviest week in current month
  const heaviestWeek = useMemo(() => {
    const totals: { start: Date; total: number }[] = [];
    let ws = startOfWeek(startOfMonth(currentMonth));
    while (isBefore(ws, endOfMonth(currentMonth))) {
      const we = endOfWeek(ws);
      const wBills = projectedBills.filter(
        (pb) =>
          (isAfter(pb.date, ws) || isSameDay(pb.date, ws)) &&
          (isBefore(pb.date, we) || isSameDay(pb.date, we))
      );
      totals.push({ start: ws, total: wBills.reduce((s, pb) => s + pb.bill.amount, 0) });
      ws = addWeeks(ws, 1);
    }
    return totals.reduce((max, w) => (w.total > max.total ? w : max), totals[0]);
  }, [projectedBills, currentMonth]);

  // Active cycle stats for the banner
  const activeCycleStats = useMemo(() => {
    if (!activeCycle) return null;
    const cycleStart = activeCycle.startDate.toDate();
    const cycleEnd = activeCycle.endDate.toDate();
    const today = new Date();
    const totalDays = differenceInDays(cycleEnd, cycleStart) + 1;
    const elapsed = Math.min(Math.max(differenceInDays(today, cycleStart) + 1, 1), totalDays);
    const daysRemaining = Math.max(differenceInDays(cycleEnd, today), 0);
    const progress = Math.min((elapsed / totalDays) * 100, 100);
    const bills = activeCycle.bills || [];
    const paidCount = bills.filter((b) => b.isPaid).length;
    const paidAmount = bills.filter((b) => b.isPaid).reduce((s, b) => s + b.amount, 0);
    const totalAmount = bills.reduce((s, b) => s + b.amount, 0);
    return {
      cycleStart,
      cycleEnd,
      totalDays,
      elapsed,
      daysRemaining,
      progress,
      paidCount,
      totalCount: bills.length,
      paidAmount,
      totalAmount,
    };
  }, [activeCycle]);

  // Cycle-view: bills grouped by pay cycle (3-month window)
  const billsByCycle = useMemo(() => {
    if (viewMode !== 'cycle') return [];
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(addMonths(currentMonth, 2));
    const rangeBills = projectBillsForRange(activeBills, start, end, cycles);

    return cycles
      .filter((c) => {
        const s = c.startDate.toDate();
        const e = c.endDate.toDate();
        return (
          (isAfter(e, start) || isSameDay(e, start)) &&
          (isBefore(s, end) || isSameDay(s, end))
        );
      })
      .sort((a, b) => a.startDate.toDate().getTime() - b.startDate.toDate().getTime())
      .map((c) => {
        const cStart = c.startDate.toDate();
        const cEnd = c.endDate.toDate();
        return {
          id: c.id,
          start: cStart,
          end: cEnd,
          isActive: c.status === 'active',
          paycheckAmount: c.paycheckAmount,
          bills: rangeBills.filter(
            (pb) =>
              (isAfter(pb.date, cStart) || isSameDay(pb.date, cStart)) &&
              (isBefore(pb.date, cEnd) || isSameDay(pb.date, cEnd))
          ),
        };
      });
  }, [viewMode, activeBills, cycles, currentMonth]);

  // ── Navigation ────────────────────────────────────────────────────────────────

  const navigateMonth = (dir: 'prev' | 'next') =>
    setCurrentMonth((m) => (dir === 'prev' ? subMonths(m, 1) : addMonths(m, 1)));

  const navigateWeek = (dir: 'prev' | 'next') =>
    setCurrentWeekStart((w) => (dir === 'prev' ? subWeeks(w, 1) : addWeeks(w, 1)));

  const goToToday = () => {
    setCurrentMonth(new Date());
    setCurrentWeekStart(startOfWeek(new Date()));
  };

  // ── Render helpers ────────────────────────────────────────────────────────────

  const billChipClass = (pb: ProjectedBill) =>
    pb.isPaid
      ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/70'
      : pb.isInCurrentCycle
        ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-900/70'
        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600';

  // ── Month View ────────────────────────────────────────────────────────────────

  const renderMonthView = () => (
    <>
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-2">
            <span className="hidden sm:inline">{day}</span>
            <span className="sm:hidden">{day.charAt(0)}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
        {calendarDates.map((date) => {
          const dateKey = format(date, 'yyyy-MM-dd');
          const dayBills = billsByDate.get(dateKey) || [];
          const isCurrentMonth = isSameMonth(date, currentMonth);
          const isTodayDate = isToday(date);
          const activeDay = isActiveCycleDay(date);
          const startDay = isCycleStartDay(date);
          const endDay = isCycleEndDay(date);
          const cycle = getCycleForDate(date);

          return (
            <div
              key={dateKey}
              className={clsx(
                'min-h-[60px] sm:min-h-[80px] md:min-h-[100px] p-1 bg-white dark:bg-gray-800 relative',
                !isCurrentMonth && 'bg-gray-50 dark:bg-gray-900',
                activeDay && 'bg-indigo-50/70 dark:bg-indigo-900/25',
                startDay && 'border-l-[3px] border-l-indigo-400 dark:border-l-indigo-500',
                endDay && 'border-r-[3px] border-r-indigo-300 dark:border-r-indigo-600'
              )}
            >
              {/* Cycle start label */}
              {startDay && (
                <div className="absolute top-0 left-1 hidden sm:block">
                  <span className="text-[7px] font-bold uppercase tracking-wider text-indigo-400 dark:text-indigo-500 leading-none">
                    cycle
                  </span>
                </div>
              )}

              {/* Date number + cycle dot */}
              <div className="flex items-center justify-between mt-2 sm:mt-2.5 mb-1">
                <span
                  className={clsx(
                    'text-xs sm:text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full',
                    isTodayDate && 'bg-indigo-600 text-white',
                    !isTodayDate && isCurrentMonth && 'text-gray-900 dark:text-gray-100',
                    !isTodayDate && !isCurrentMonth && 'text-gray-400 dark:text-gray-500'
                  )}
                >
                  {format(date, 'd')}
                </span>
                {cycle && (
                  <div
                    className={clsx(
                      'w-1.5 h-1.5 rounded-full hidden sm:block flex-shrink-0',
                      cycle.isActive ? 'bg-indigo-500 dark:bg-indigo-400' : 'bg-gray-300 dark:bg-gray-600'
                    )}
                  />
                )}
              </div>

              {/* Bills */}
              <div className="space-y-0.5">
                {dayBills.slice(0, 3).map((pb, idx) => (
                  <button
                    key={`${pb.bill.id}-${idx}`}
                    onClick={() => setSelectedBill(pb)}
                    className={clsx(
                      'w-full text-left text-xs px-1 py-0.5 rounded truncate transition-colors',
                      billChipClass(pb)
                    )}
                  >
                    <span className="hidden sm:inline">{pb.bill.name}</span>
                    <span className="sm:hidden">{pb.bill.name.substring(0, 3)}</span>
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
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-100 dark:bg-green-900/50 border border-green-300 dark:border-green-700" />
          <span>Paid</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-yellow-100 dark:bg-yellow-900/50 border border-yellow-300 dark:border-yellow-700" />
          <span>Current Cycle</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600" />
          <span>Future</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-indigo-50 dark:bg-indigo-900/25 border-l-2 border-indigo-400" />
          <span>Active pay period</span>
        </div>
      </div>
    </>
  );

  // ── Week View ─────────────────────────────────────────────────────────────────

  const renderWeekView = () => (
    <>
      {/* ── Mobile: vertical stack (one card per day) ── */}
      <div className="flex flex-col gap-2 sm:hidden">
        {weekDates.map((date) => {
          const dateKey = format(date, 'yyyy-MM-dd');
          const dayBills = billsByDate.get(dateKey) || [];
          const isTodayDate = isToday(date);
          const cycle = getCycleForDate(date);
          const activeDay = cycle?.isActive;

          return (
            <div
              key={dateKey}
              className={clsx(
                'rounded-xl border p-3',
                activeDay
                  ? 'border-indigo-300 dark:border-indigo-600 bg-indigo-50/60 dark:bg-indigo-900/25'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800',
                isTodayDate && 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-gray-900'
              )}
            >
              {/* Day header row */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className={clsx(
                      'w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm',
                      isTodayDate
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-900 dark:text-gray-100'
                    )}
                  >
                    {format(date, 'd')}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {format(date, 'EEEE')}
                    </div>
                    {activeDay && (
                      <div className="text-[10px] text-indigo-500 dark:text-indigo-400 font-medium">
                        active cycle
                      </div>
                    )}
                  </div>
                </div>
                {dayBills.length > 0 && (
                  <div className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                    {formatCurrency(dayBills.reduce((s, pb) => s + pb.bill.amount, 0))}
                  </div>
                )}
              </div>

              {/* Bills */}
              {dayBills.length === 0 ? (
                <div className="text-sm text-gray-300 dark:text-gray-600 pl-1">No bills</div>
              ) : (
                <div className="space-y-1.5">
                  {dayBills.map((pb, idx) => (
                    <button
                      key={`${pb.bill.id}-${idx}`}
                      onClick={() => setSelectedBill(pb)}
                      className={clsx(
                        'w-full text-left text-sm p-2 rounded-lg transition-colors',
                        billChipClass(pb)
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{pb.bill.name}</span>
                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                          <span>{formatCurrency(pb.bill.amount)}</span>
                          {pb.isPaid && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Desktop: 7-column grid ── */}
      <div className="hidden sm:grid grid-cols-7 gap-2">
        {weekDates.map((date) => {
          const dateKey = format(date, 'yyyy-MM-dd');
          const dayBills = billsByDate.get(dateKey) || [];
          const isTodayDate = isToday(date);
          const cycle = getCycleForDate(date);
          const activeDay = cycle?.isActive;

          return (
            <div
              key={dateKey}
              className={clsx(
                'rounded-xl border p-2 min-h-[200px]',
                activeDay
                  ? 'border-indigo-300 dark:border-indigo-600 bg-indigo-50/60 dark:bg-indigo-900/25'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800',
                isTodayDate && 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-gray-900'
              )}
            >
              {/* Day header */}
              <div className="text-center mb-2">
                <div className="text-xs font-medium text-gray-400 dark:text-gray-500">
                  {format(date, 'EEE')}
                </div>
                <div
                  className={clsx(
                    'w-8 h-8 mx-auto flex items-center justify-center rounded-full font-bold text-sm mt-0.5',
                    isTodayDate
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-900 dark:text-gray-100'
                  )}
                >
                  {format(date, 'd')}
                </div>
                {activeDay && (
                  <div className="text-[9px] text-indigo-500 dark:text-indigo-400 font-medium mt-0.5">
                    active cycle
                  </div>
                )}
              </div>

              {/* Bills */}
              <div className="space-y-1">
                {dayBills.length === 0 ? (
                  <div className="text-center text-gray-300 dark:text-gray-600 pt-3 text-lg">—</div>
                ) : (
                  dayBills.map((pb, idx) => (
                    <button
                      key={`${pb.bill.id}-${idx}`}
                      onClick={() => setSelectedBill(pb)}
                      className={clsx(
                        'w-full text-left text-xs p-1.5 rounded-lg transition-colors',
                        billChipClass(pb)
                      )}
                    >
                      <div className="font-medium truncate">{pb.bill.name}</div>
                      <div className="flex items-center justify-between mt-0.5 opacity-90">
                        <span>{formatCurrency(pb.bill.amount)}</span>
                        {pb.isPaid && <Check className="w-3 h-3 flex-shrink-0" />}
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* Day total */}
              {dayBills.length > 0 && (
                <div className="mt-2 pt-1.5 border-t border-gray-100 dark:border-gray-700 text-xs text-center font-semibold text-gray-500 dark:text-gray-400">
                  {formatCurrency(dayBills.reduce((s, pb) => s + pb.bill.amount, 0))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );

  // ── Cycle View ────────────────────────────────────────────────────────────────

  const renderCycleView = () => {
    if (cycles.length === 0) {
      return (
        <div className="py-16 text-center text-gray-400 dark:text-gray-500 text-sm">
          No pay cycles found. Start a cycle from the Paycheck tab.
        </div>
      );
    }

    if (billsByCycle.length === 0) {
      return (
        <div className="py-16 text-center text-gray-400 dark:text-gray-500 text-sm">
          No cycles in this period.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {billsByCycle.map((group) => {
          const totalAmount = group.bills.reduce((s, pb) => s + pb.bill.amount, 0);
          const paidBills = group.bills.filter((pb) => pb.isPaid);
          const paidAmount = paidBills.reduce((s, pb) => s + pb.bill.amount, 0);

          // Cycle-level progress (time elapsed)
          const today = new Date();
          const totalDays = differenceInDays(group.end, group.start) + 1;
          const elapsed = Math.min(
            Math.max(differenceInDays(today, group.start) + 1, 0),
            totalDays
          );
          const timeProgress = Math.round((elapsed / totalDays) * 100);
          const daysLeft = Math.max(differenceInDays(group.end, today), 0);

          return (
            <div
              key={group.id}
              className={clsx(
                'rounded-xl border overflow-hidden',
                group.isActive
                  ? 'border-indigo-300 dark:border-indigo-600 shadow-sm shadow-indigo-100 dark:shadow-none'
                  : 'border-gray-200 dark:border-gray-700'
              )}
            >
              {/* Cycle header */}
              <div
                className={clsx(
                  'px-4 py-3',
                  group.isActive
                    ? 'bg-indigo-600 dark:bg-indigo-700'
                    : 'bg-gray-50 dark:bg-gray-800'
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p
                        className={clsx(
                          'font-bold text-sm',
                          group.isActive ? 'text-white' : 'text-gray-900 dark:text-gray-100'
                        )}
                      >
                        {format(group.start, 'MMM d')} – {format(group.end, 'MMM d, yyyy')}
                      </p>
                      {group.isActive && (
                        <span className="text-xs bg-white/25 text-white px-2 py-0.5 rounded-full font-semibold">
                          Active
                        </span>
                      )}
                    </div>
                    <p
                      className={clsx(
                        'text-xs mt-0.5',
                        group.isActive ? 'text-indigo-200' : 'text-gray-500 dark:text-gray-400'
                      )}
                    >
                      {group.bills.length} bills · {paidBills.length} paid
                      {group.isActive && ` · ${daysLeft} days left`}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p
                      className={clsx(
                        'text-lg font-bold',
                        group.isActive ? 'text-white' : 'text-gray-900 dark:text-gray-100'
                      )}
                    >
                      {formatCurrency(totalAmount)}
                    </p>
                    {paidAmount > 0 && (
                      <p
                        className={clsx(
                          'text-xs',
                          group.isActive
                            ? 'text-indigo-200'
                            : 'text-green-600 dark:text-green-400'
                        )}
                      >
                        {formatCurrency(paidAmount)} paid
                      </p>
                    )}
                  </div>
                </div>

                {/* Time progress bar (active cycle only) */}
                {group.isActive && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-indigo-200 mb-1">
                      <span>Day {Math.min(elapsed, totalDays)} of {totalDays}</span>
                      <span>{timeProgress}% through cycle</span>
                    </div>
                    <div className="w-full bg-indigo-500/50 rounded-full h-1.5">
                      <div
                        className="bg-white/80 h-1.5 rounded-full transition-all"
                        style={{ width: `${timeProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Bills list */}
              {group.bills.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800">
                  No bills fall in this cycle period.
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700/70 bg-white dark:bg-gray-800">
                  {group.bills.map((pb, idx) => (
                    <button
                      key={`${pb.bill.id}-${idx}`}
                      onClick={() => setSelectedBill(pb)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={clsx(
                            'w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0',
                            pb.isPaid
                              ? 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400'
                              : pb.isInCurrentCycle
                                ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-600 dark:text-yellow-400'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                          )}
                        >
                          {pb.isPaid ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <span className="text-xs font-bold">{format(pb.date, 'd')}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p
                            className={clsx(
                              'font-medium text-sm truncate',
                              pb.isPaid
                                ? 'text-gray-400 dark:text-gray-500 line-through'
                                : 'text-gray-900 dark:text-gray-100'
                            )}
                          >
                            {pb.bill.name}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            Due {format(pb.date, 'MMM d')}
                            {pb.bill.isAutoPay && ' · AutoPay'}
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

              {/* Bill payment progress bar */}
              {group.bills.length > 0 && (
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mb-1">
                    <span>Bills paid</span>
                    <span>{paidBills.length} / {group.bills.length}</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                      className={clsx(
                        'h-1.5 rounded-full transition-all',
                        paidBills.length === group.bills.length
                          ? 'bg-green-500'
                          : group.isActive
                            ? 'bg-indigo-500'
                            : 'bg-gray-400'
                      )}
                      style={{
                        width: `${group.bills.length > 0 ? (paidBills.length / group.bills.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ── Full render ───────────────────────────────────────────────────────────────

  return (
    <AppLayout title="Bill Calendar">
      <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
        {/* Main calendar panel */}
        <div className="flex-1 min-w-0">
          <Card>
            {/* ── Active Cycle Banner ── */}
            {activeCycle && activeCycleStats ? (
              <div className="mb-5 p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-900/30 dark:to-violet-900/30 border border-indigo-200 dark:border-indigo-700">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mb-0.5">
                      Current Pay Cycle
                    </p>
                    <p className="font-bold text-indigo-900 dark:text-indigo-100 text-base">
                      {format(activeCycleStats.cycleStart, 'MMM d')}
                      {' – '}
                      {format(activeCycleStats.cycleEnd, 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="text-3xl font-black text-indigo-700 dark:text-indigo-300 leading-none">
                      {activeCycleStats.daysRemaining}
                    </p>
                    <p className="text-xs text-indigo-400 dark:text-indigo-500">days left</p>
                  </div>
                </div>

                {/* Time progress */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-indigo-400 dark:text-indigo-500 mb-1">
                    <span>Day {activeCycleStats.elapsed} of {activeCycleStats.totalDays}</span>
                    <span>{Math.round(activeCycleStats.progress)}% elapsed</span>
                  </div>
                  <div className="w-full bg-indigo-200 dark:bg-indigo-800 rounded-full h-2">
                    <div
                      className="bg-indigo-600 dark:bg-indigo-400 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${activeCycleStats.progress}%` }}
                    />
                  </div>
                </div>

                {/* Bills summary */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span>
                    <span className="font-bold text-indigo-700 dark:text-indigo-300">
                      {activeCycleStats.paidCount}/{activeCycleStats.totalCount}
                    </span>
                    <span className="text-indigo-400 dark:text-indigo-500 text-xs ml-1">bills paid</span>
                  </span>
                  {activeCycleStats.paidAmount > 0 && (
                    <span>
                      <span className="font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(activeCycleStats.paidAmount)}
                      </span>
                      <span className="text-indigo-400 dark:text-indigo-500 text-xs ml-1">paid</span>
                    </span>
                  )}
                  <span className="ml-auto">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(activeCycleStats.totalAmount)}
                    </span>
                    <span className="text-indigo-400 dark:text-indigo-500 text-xs ml-1">total bills</span>
                  </span>
                </div>
              </div>
            ) : (
              <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                No active pay cycle — start one from the Paycheck tab to track bill payments.
              </div>
            )}

            {/* ── Header row: navigation + refresh ── */}
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() =>
                    viewMode === 'week' ? navigateWeek('prev') : navigateMonth('prev')
                  }
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 min-w-[130px] sm:min-w-[160px] text-center">
                  {viewMode === 'week'
                    ? `${format(currentWeekStart, 'MMM d')} – ${format(endOfWeek(currentWeekStart), 'MMM d')}`
                    : format(currentMonth, 'MMMM yyyy')}
                </h2>
                <button
                  onClick={() =>
                    viewMode === 'week' ? navigateWeek('next') : navigateMonth('next')
                  }
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={goToToday}>
                  Today
                </Button>
                <button
                  onClick={handleRefresh}
                  title="Refresh data"
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <RefreshCw
                    className={clsx(
                      'w-4 h-4 text-gray-500 dark:text-gray-400',
                      isRefreshing && 'animate-spin'
                    )}
                  />
                </button>
              </div>
            </div>

            {/* ── View mode toggle ── */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-4">
              {(
                [
                  { mode: 'month', Icon: LayoutGrid, label: 'Month' },
                  { mode: 'week', Icon: CalendarDays, label: 'Week' },
                  { mode: 'cycle', Icon: Layers, label: 'By Cycle' },
                ] as const
              ).map(({ mode, Icon, label }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={clsx(
                    'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all',
                    viewMode === mode
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  )}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            {/* ── Cycle legend (month + week views) ── */}
            {(viewMode === 'month' || viewMode === 'week') && cycleRanges.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {cycleRanges.map((range, i) => (
                  <div
                    key={range.id}
                    className={clsx(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs',
                      range.isActive
                        ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-semibold'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    )}
                  >
                    <div
                      className={clsx(
                        'w-2 h-2 rounded-full',
                        range.isActive ? 'bg-indigo-500' : 'bg-gray-400 dark:bg-gray-500'
                      )}
                    />
                    {range.isActive ? 'Active Cycle' : `Cycle ${i + 1}`}:{' '}
                    {format(range.start, 'MMM d')} – {format(range.end, 'MMM d')}
                  </div>
                ))}
              </div>
            )}

            {/* ── View content ── */}
            {viewMode === 'month' && renderMonthView()}
            {viewMode === 'week' && renderWeekView()}
            {viewMode === 'cycle' && renderCycleView()}
          </Card>
        </div>

        {/* ── Sidebar ── */}
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
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                        {pb.bill.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {format(pb.date, 'MMM d, yyyy')}
                        {pb.isInCurrentCycle && (
                          <span className="ml-1 text-yellow-600 dark:text-yellow-400">· This cycle</span>
                        )}
                      </p>
                    </div>
                    <span className="font-semibold text-gray-700 dark:text-gray-300 flex-shrink-0 ml-2">
                      {formatCurrency(pb.bill.amount)}
                    </span>
                  </button>
                ))}
                {upcomingBills.length > 5 && (
                  <button
                    onClick={() => setShowAllUpcoming(!showAllUpcoming)}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-center pt-1 w-full transition-colors"
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

              {/* Paid progress bar */}
              {monthlyTotals.currentMonth > 0 && (
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                  <div
                    className="bg-green-500 h-1.5 rounded-full transition-all"
                    style={{
                      width: `${(monthlyTotals.currentMonthPaid / monthlyTotals.currentMonth) * 100}%`,
                    }}
                  />
                </div>
              )}

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
                <span className="font-semibold">{formatCurrency(heaviestWeek.total)}</span> in bills
              </p>
            </Card>
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
                  selectedBill.isPaid ? 'success' : selectedBill.isInCurrentCycle ? 'warning' : 'default'
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
                    <span>{paymentMethodsById[selectedBill.bill.paymentMethodId].name}</span>
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
                {!selectedBill.isPaid && '. Go to the Paycheck tab to mark it as paid.'}
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
