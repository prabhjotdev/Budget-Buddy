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
  List,
  LayoutGrid,
  CalendarDays,
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
  subWeeks,
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

type ViewMode = 'month' | 'week' | 'agenda';

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
      while ((isAfter(prevDate, startDate) || isSameDay(prevDate, startDate)) &&
             (isBefore(prevDate, endDate) || isSameDay(prevDate, endDate))) {
        currentDate = prevDate;
        prevDate = addWeeks(currentDate, -2);
      }
    } else if (bill.frequency === 'quarterly' || bill.frequency === 'semi-annual' || bill.frequency === 'annual') {
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
      if ((isAfter(currentDate, startDate) || isSameDay(currentDate, startDate)) &&
          (isBefore(currentDate, endDate) || isSameDay(currentDate, endDate))) {
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
  const { byId: cyclesById, allIds: cycleIds, activeCycleId } = useAppSelector((state) => state.paycheckCycles);
  const { byId: paymentMethodsById } = useAppSelector((state) => state.paymentMethods);

  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedBillKey, setSelectedBillKey] = useState<{ billId: string; dateKey: string } | null>(null);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);

  useEffect(() => {
    if (user) {
      dispatch(fetchBills(user.uid));
      dispatch(fetchPaycheckCycles(user.uid));
      dispatch(fetchPaymentMethods(user.uid));
    }
  }, [dispatch, user]);

  // Re-fetch cycles whenever bills change to ensure cycle entries stay in sync
  useEffect(() => {
    if (user && activeIds.length > 0) {
      dispatch(fetchPaycheckCycles(user.uid));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIds.length]);

  const activeBills = useMemo(() => {
    return activeIds.map((id) => billsById[id]).filter(Boolean);
  }, [billsById, activeIds]);

  const cycles = useMemo(() => {
    return cycleIds.map((id) => cyclesById[id]).filter(Boolean);
  }, [cyclesById, cycleIds]);

  const activeCycle = activeCycleId ? cyclesById[activeCycleId] : null;

  // --- Active Cycle Stats ---
  const activeCycleStats = useMemo(() => {
    if (!activeCycle) return null;
    const start = activeCycle.startDate.toDate();
    const end = activeCycle.endDate.toDate();
    const today = new Date();
    const totalDays = differenceInDays(end, start) + 1;
    const daysPassed = Math.max(0, Math.min(differenceInDays(today, start) + 1, totalDays));
    const progressPct = Math.round((daysPassed / totalDays) * 100);
    const paidBills = activeCycle.bills.filter((b) => b.isPaid).length;
    const totalBills = activeCycle.bills.length;
    const paidAmount = activeCycle.bills.filter((b) => b.isPaid).reduce((s, b) => s + b.amount, 0);
    const totalAmount = activeCycle.bills.reduce((s, b) => s + b.amount, 0);
    return { start, end, totalDays, daysPassed, progressPct, paidBills, totalBills, paidAmount, totalAmount };
  }, [activeCycle]);

  // --- Calendar dates (month view) ---
  const calendarDates = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate]);

  // --- Week view dates ---
  const weekDates = useMemo(() => {
    return eachDayOfInterval({ start: startOfWeek(currentDate), end: endOfWeek(currentDate) });
  }, [currentDate]);

  // --- Projection range ---
  const projectedBills = useMemo(() => {
    const rangeStart = viewMode === 'agenda'
      ? subMonths(startOfMonth(currentDate), 1)
      : startOfMonth(currentDate);
    const rangeEnd = viewMode === 'agenda'
      ? addMonths(endOfMonth(currentDate), 3)
      : endOfMonth(addMonths(currentDate, 1));

    return projectBillsForRange(activeBills, rangeStart, rangeEnd, cycles);
  }, [activeBills, currentDate, cycles, viewMode]);

  const selectedBill = useMemo(() => {
    if (!selectedBillKey) return null;
    return projectedBills.find(
      (pb) => pb.bill.id === selectedBillKey.billId && format(pb.date, 'yyyy-MM-dd') === selectedBillKey.dateKey
    ) || null;
  }, [projectedBills, selectedBillKey]);

  const setSelectedBill = (bill: ProjectedBill | null) => {
    if (bill) {
      setSelectedBillKey({ billId: bill.bill.id, dateKey: format(bill.date, 'yyyy-MM-dd') });
    } else {
      setSelectedBillKey(null);
    }
  };

  const billsByDate = useMemo(() => {
    const map = new Map<string, ProjectedBill[]>();
    projectedBills.forEach((pb) => {
      const key = format(pb.date, 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(pb);
    });
    return map;
  }, [projectedBills]);

  // Cycle ranges visible on the current month
  const cycleRanges = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    return cycles
      .filter((cycle) => {
        const s = cycle.startDate.toDate();
        const e = cycle.endDate.toDate();
        return (
          (isAfter(e, monthStart) || isSameDay(e, monthStart)) &&
          (isBefore(s, monthEnd) || isSameDay(s, monthEnd))
        );
      })
      .map((cycle) => ({
        id: cycle.id,
        start: cycle.startDate.toDate(),
        end: cycle.endDate.toDate(),
        isActive: cycle.status === 'active',
        status: cycle.status,
      }))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [cycles, currentDate]);

  const getCycleForDate = (date: Date) => {
    return cycleRanges.find(
      (r) =>
        (isAfter(date, r.start) || isSameDay(date, r.start)) &&
        (isBefore(date, r.end) || isSameDay(date, r.end))
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
    const curStart = startOfMonth(currentDate);
    const curEnd = endOfMonth(currentDate);
    const nxtStart = startOfMonth(addMonths(currentDate, 1));
    const nxtEnd = endOfMonth(addMonths(currentDate, 1));

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
  }, [projectedBills, currentDate]);

  // Heaviest week
  const heaviestWeek = useMemo(() => {
    const weekTotals: { start: Date; total: number }[] = [];
    const monthStart = startOfMonth(currentDate);
    let weekStart = startOfWeek(monthStart);

    while (isBefore(weekStart, endOfMonth(currentDate))) {
      const weekEnd = endOfWeek(weekStart);
      const weekBills = projectedBills.filter(
        (pb) =>
          (isAfter(pb.date, weekStart) || isSameDay(pb.date, weekStart)) &&
          (isBefore(pb.date, weekEnd) || isSameDay(pb.date, weekEnd))
      );
      weekTotals.push({ start: weekStart, total: weekBills.reduce((s, pb) => s + pb.bill.amount, 0) });
      weekStart = addWeeks(weekStart, 1);
    }

    return weekTotals.reduce((max, w) => (w.total > max.total ? w : max), weekTotals[0]);
  }, [projectedBills, currentDate]);

  // Agenda: group projected bills by cycle
  const agendaByCycle = useMemo(() => {
    const groups: { cycleId: string | null; label: string; bills: ProjectedBill[]; isActive: boolean }[] = [];
    const seenCycles = new Set<string>();
    const ungrouped: ProjectedBill[] = [];

    projectedBills.forEach((pb) => {
      if (pb.cycleId) {
        if (!seenCycles.has(pb.cycleId)) {
          seenCycles.add(pb.cycleId);
          const cycle = cyclesById[pb.cycleId];
          if (cycle) {
            groups.push({
              cycleId: pb.cycleId,
              label: `${format(cycle.startDate.toDate(), 'MMM d')} – ${format(cycle.endDate.toDate(), 'MMM d, yyyy')}`,
              bills: [],
              isActive: cycle.status === 'active',
            });
          }
        }
        const group = groups.find((g) => g.cycleId === pb.cycleId);
        if (group) group.bills.push(pb);
      } else {
        ungrouped.push(pb);
      }
    });

    if (ungrouped.length > 0) {
      groups.push({ cycleId: null, label: 'No Cycle', bills: ungrouped, isActive: false });
    }

    return groups.sort((a, b) => {
      if (!a.cycleId) return 1;
      if (!b.cycleId) return -1;
      const ca = cyclesById[a.cycleId];
      const cb = cyclesById[b.cycleId];
      if (!ca || !cb) return 0;
      return ca.startDate.toDate().getTime() - cb.startDate.toDate().getTime();
    });
  }, [projectedBills, cyclesById]);

  // Navigation
  const navigatePrev = () => {
    if (viewMode === 'week') setCurrentDate((d) => subWeeks(d, 1));
    else setCurrentDate((d) => subMonths(d, 1));
  };
  const navigateNext = () => {
    if (viewMode === 'week') setCurrentDate((d) => addWeeks(d, 1));
    else setCurrentDate((d) => addMonths(d, 1));
  };
  const goToToday = () => setCurrentDate(new Date());

  const getNavLabel = () => {
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate);
      const end = endOfWeek(currentDate);
      return isSameMonth(start, end)
        ? `${format(start, 'MMM d')} – ${format(end, 'd, yyyy')}`
        : `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
    }
    return format(currentDate, 'MMMM yyyy');
  };

  // ── Shared bill chip renderer ──────────────────────────────────────────
  const BillChip = ({ pb, compact = false }: { pb: ProjectedBill; compact?: boolean }) => (
    <button
      onClick={() => setSelectedBill(pb)}
      className={clsx(
        'w-full text-left rounded truncate transition-colors',
        compact ? 'text-xs px-1 py-0.5' : 'text-xs px-1.5 py-1',
        pb.isPaid
          ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/70'
          : pb.isInCurrentCycle
            ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-900/70'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
      )}
    >
      {pb.isPaid && <span className="mr-0.5">✓</span>}
      <span className={compact ? 'hidden sm:inline' : ''}>{pb.bill.name}</span>
      {compact && <span className="sm:hidden">{pb.bill.name.substring(0, 3)}</span>}
    </button>
  );

  // ── ACTIVE CYCLE BANNER ───────────────────────────────────────────────
  const ActiveCycleBanner = () => {
    if (!activeCycle || !activeCycleStats) return null;
    const { start, end, totalDays, daysPassed, progressPct, paidBills, totalBills, paidAmount, totalAmount } = activeCycleStats;

    return (
      <Card className="mb-4 border-indigo-200 dark:border-indigo-700 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/40">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Left: Cycle label + dates */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                Active Cycle
              </span>
              <span className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">
                Day {daysPassed} of {totalDays}
              </span>
            </div>
            <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
              {format(start, 'MMM d')} – {format(end, 'MMM d, yyyy')}
            </p>
            {/* Progress bar */}
            <div className="mt-2 h-1.5 bg-indigo-200 dark:bg-indigo-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 dark:bg-indigo-400 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">{progressPct}% through cycle</p>
          </div>

          {/* Right: Bill stats */}
          <div className="flex sm:flex-col gap-4 sm:gap-2 sm:text-right shrink-0">
            <div>
              <p className="text-xs text-indigo-600 dark:text-indigo-400">Bills paid</p>
              <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
                {paidBills}/{totalBills}
                {totalBills > 0 && (
                  <span className="text-xs font-normal text-indigo-600 dark:text-indigo-400 ml-1">
                    ({formatCurrency(paidAmount)})
                  </span>
                )}
              </p>
            </div>
            {activeCycle.remainingToSpend !== undefined && (
              <div>
                <p className="text-xs text-indigo-600 dark:text-indigo-400">Left to spend</p>
                <p className={clsx(
                  'text-sm font-semibold',
                  activeCycle.remainingToSpend >= 0
                    ? 'text-indigo-900 dark:text-indigo-100'
                    : 'text-red-600 dark:text-red-400'
                )}>
                  {formatCurrency(activeCycle.remainingToSpend)}
                </p>
              </div>
            )}
            {totalBills > 0 && (
              <div>
                <p className="text-xs text-indigo-600 dark:text-indigo-400">Bills total</p>
                <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
                  {formatCurrency(totalAmount)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Unpaid bills list */}
        {totalBills > 0 && paidBills < totalBills && (
          <div className="mt-3 pt-3 border-t border-indigo-200 dark:border-indigo-700">
            <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1.5">Remaining this cycle:</p>
            <div className="flex flex-wrap gap-1.5">
              {activeCycle.bills
                .filter((b) => !b.isPaid)
                .map((b) => (
                  <span
                    key={b.billId}
                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-800"
                  >
                    <Clock className="w-2.5 h-2.5" />
                    {b.billName} · {formatCurrency(b.amount)}
                  </span>
                ))}
            </div>
          </div>
        )}
        {totalBills > 0 && paidBills === totalBills && (
          <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800 flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">All bills paid for this cycle!</span>
          </div>
        )}
      </Card>
    );
  };

  // ── VIEW MODE TOGGLE ──────────────────────────────────────────────────
  const ViewToggle = () => (
    <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {([
        { mode: 'month' as ViewMode, icon: <LayoutGrid className="w-3.5 h-3.5" />, label: 'Month' },
        { mode: 'week' as ViewMode, icon: <CalendarDays className="w-3.5 h-3.5" />, label: 'Week' },
        { mode: 'agenda' as ViewMode, icon: <List className="w-3.5 h-3.5" />, label: 'Agenda' },
      ] as const).map(({ mode, icon, label }) => (
        <button
          key={mode}
          onClick={() => setViewMode(mode)}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
            viewMode === mode
              ? 'bg-indigo-600 text-white'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          )}
        >
          {icon}
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );

  // ── CALENDAR HEADER (shared) ──────────────────────────────────────────
  const CalendarHeader = () => (
    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={navigatePrev}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 min-w-[160px] text-center">
          {getNavLabel()}
        </h2>
        <button
          onClick={navigateNext}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <ViewToggle />
        <Button size="sm" variant="secondary" onClick={goToToday}>
          Today
        </Button>
      </div>
    </div>
  );

  // ── CYCLE LEGEND ──────────────────────────────────────────────────────
  const CycleLegend = () => {
    if (cycleRanges.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-2 mb-4 text-xs">
        {cycleRanges.map((range, index) => (
          <div
            key={range.id}
            className={clsx(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full border',
              range.isActive
                ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700 font-medium'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600'
            )}
          >
            <div className={clsx('w-2 h-2 rounded-full', range.isActive ? 'bg-indigo-500' : 'bg-gray-400')} />
            {range.isActive && <span className="font-bold">Current:</span>}
            Cycle {index + 1}: {format(range.start, 'MMM d')} – {format(range.end, 'MMM d')}
          </div>
        ))}
      </div>
    );
  };

  // ── MONTH VIEW ────────────────────────────────────────────────────────
  const MonthView = () => (
    <>
      <CycleLegend />
      <div className="grid grid-cols-7 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-2">
            <span className="hidden sm:inline">{day}</span>
            <span className="sm:hidden">{day.charAt(0)}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
        {calendarDates.map((date) => {
          const dateKey = format(date, 'yyyy-MM-dd');
          const dayBills = billsByDate.get(dateKey) || [];
          const isCurrentMonth = isSameMonth(date, currentDate);
          const isTodayDate = isToday(date);
          const cycle = getCycleForDate(date);
          const isCycleStart = cycle && isSameDay(date, cycle.start);
          const isCycleEnd = cycle && isSameDay(date, cycle.end);

          return (
            <div
              key={dateKey}
              className={clsx(
                'min-h-[60px] sm:min-h-[80px] md:min-h-[100px] p-1 relative',
                // Base backgrounds
                !isCurrentMonth && 'bg-gray-50 dark:bg-gray-900',
                isCurrentMonth && !cycle && 'bg-white dark:bg-gray-800',
                // Cycle background tints
                cycle && cycle.isActive && 'bg-indigo-50 dark:bg-indigo-900/25',
                cycle && !cycle.isActive && cycle.status === 'completed' && isCurrentMonth && 'bg-gray-50 dark:bg-gray-800/70',
                cycle && !cycle.isActive && cycle.status !== 'completed' && isCurrentMonth && 'bg-blue-50/30 dark:bg-blue-950/20',
                // Cycle boundary borders
                isCycleStart && cycle.isActive && 'border-l-2 border-l-indigo-400 dark:border-l-indigo-500',
                isCycleEnd && cycle.isActive && 'border-r-2 border-r-indigo-400 dark:border-r-indigo-500',
              )}
            >
              {/* Cycle start marker */}
              {isCycleStart && (
                <div className={clsx(
                  'absolute top-0 left-0 text-[9px] font-bold px-0.5 rounded-br',
                  cycle.isActive
                    ? 'bg-indigo-500 text-white'
                    : 'bg-gray-400 dark:bg-gray-600 text-white'
                )}>
                  ▶
                </div>
              )}

              {/* Date number */}
              <div className="flex items-center justify-between mb-1">
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
                {/* Cycle end marker dot */}
                {isCycleEnd && (
                  <span className={clsx(
                    'text-[9px] font-bold',
                    cycle.isActive ? 'text-indigo-400 dark:text-indigo-500' : 'text-gray-400'
                  )}>◀</span>
                )}
              </div>

              {/* Bills */}
              <div className="space-y-0.5">
                {dayBills.slice(0, 3).map((pb, idx) => (
                  <BillChip key={`${pb.bill.id}-${idx}`} pb={pb} compact />
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
      <div className="flex flex-wrap gap-4 mt-4 text-xs text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-100 dark:bg-green-900/50 border border-green-300" />
          Paid
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-yellow-100 dark:bg-yellow-900/50 border border-yellow-300" />
          Due this cycle
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600" />
          Future
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-indigo-50 dark:bg-indigo-900/25 border-l-2 border-l-indigo-400" />
          Active cycle days
        </div>
      </div>
    </>
  );

  // ── WEEK VIEW ─────────────────────────────────────────────────────────
  const WeekView = () => (
    <>
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-px mb-1">
        {weekDates.map((date) => {
          const isTodayDate = isToday(date);
          const cycle = getCycleForDate(date);
          return (
            <div
              key={date.toISOString()}
              className={clsx(
                'text-center py-2 rounded-t-lg',
                cycle?.isActive && 'bg-indigo-100 dark:bg-indigo-900/40',
                !cycle?.isActive && 'bg-gray-50 dark:bg-gray-800'
              )}
            >
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{format(date, 'EEE')}</p>
              <p className={clsx(
                'text-lg font-bold mt-0.5 w-9 h-9 flex items-center justify-center mx-auto rounded-full',
                isTodayDate && 'bg-indigo-600 text-white',
                !isTodayDate && isSameMonth(date, currentDate) && 'text-gray-900 dark:text-gray-100',
                !isTodayDate && !isSameMonth(date, currentDate) && 'text-gray-400 dark:text-gray-500'
              )}>
                {format(date, 'd')}
              </p>
              {cycle && (
                <span className={clsx(
                  'text-[10px] font-medium px-1 rounded',
                  cycle.isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'
                )}>
                  {cycle.isActive ? 'Active Cycle' : 'Cycle'}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Day columns */}
      <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 rounded-b-lg overflow-hidden">
        {weekDates.map((date) => {
          const dateKey = format(date, 'yyyy-MM-dd');
          const dayBills = billsByDate.get(dateKey) || [];
          const cycle = getCycleForDate(date);
          const isTodayDate = isToday(date);

          return (
            <div
              key={dateKey}
              className={clsx(
                'min-h-[140px] p-1.5 space-y-1',
                cycle?.isActive ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'bg-white dark:bg-gray-800',
                isTodayDate && 'ring-2 ring-inset ring-indigo-400',
              )}
            >
              {dayBills.length === 0 && (
                <p className="text-xs text-gray-300 dark:text-gray-600 text-center mt-4">—</p>
              )}
              {dayBills.map((pb, idx) => (
                <button
                  key={`${pb.bill.id}-${idx}`}
                  onClick={() => setSelectedBill(pb)}
                  className={clsx(
                    'w-full text-left rounded p-1.5 text-xs transition-colors',
                    pb.isPaid
                      ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200'
                      : pb.isInCurrentCycle
                        ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  )}
                >
                  <div className="flex items-center gap-0.5 font-medium truncate">
                    {pb.isPaid && <Check className="w-3 h-3 shrink-0" />}
                    <span className="truncate">{pb.bill.name}</span>
                  </div>
                  <div className="text-[10px] opacity-75 mt-0.5">{formatCurrency(pb.bill.amount)}</div>
                  {pb.bill.isAutoPay && <Zap className="w-2.5 h-2.5 text-green-500 dark:text-green-400 mt-0.5" />}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {/* Week total */}
      <div className="mt-3 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <span>
          Week total:{' '}
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {formatCurrency(
              weekDates.reduce((s, d) => {
                const key = format(d, 'yyyy-MM-dd');
                return s + (billsByDate.get(key) || []).reduce((ss, pb) => ss + pb.bill.amount, 0);
              }, 0)
            )}
          </span>
        </span>
        <span>
          Paid:{' '}
          <span className="font-semibold text-green-700 dark:text-green-400">
            {formatCurrency(
              weekDates.reduce((s, d) => {
                const key = format(d, 'yyyy-MM-dd');
                return s + (billsByDate.get(key) || []).filter((pb) => pb.isPaid).reduce((ss, pb) => ss + pb.bill.amount, 0);
              }, 0)
            )}
          </span>
        </span>
      </div>
    </>
  );

  // ── AGENDA VIEW ───────────────────────────────────────────────────────
  const AgendaView = () => (
    <div className="space-y-4">
      {agendaByCycle.length === 0 && (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <CalendarIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No bills to display</p>
        </div>
      )}
      {agendaByCycle.map((group) => {
        const cycle = group.cycleId ? cyclesById[group.cycleId] : null;
        const groupTotal = group.bills.reduce((s, pb) => s + pb.bill.amount, 0);
        const paidTotal = group.bills.filter((pb) => pb.isPaid).reduce((s, pb) => s + pb.bill.amount, 0);
        const allPaid = group.bills.length > 0 && group.bills.every((pb) => pb.isPaid);

        return (
          <div key={group.cycleId || 'none'} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Cycle header */}
            <div className={clsx(
              'px-4 py-3 flex items-center justify-between',
              group.isActive
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            )}>
              <div className="flex items-center gap-2">
                {group.isActive && (
                  <span className="text-[10px] font-bold bg-white/20 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                    Active
                  </span>
                )}
                {cycle && (
                  <span className={clsx('text-xs', group.isActive ? 'text-white/80' : 'text-gray-500 dark:text-gray-400')}>
                    {format(cycle.startDate.toDate(), 'EEE, MMM d')} – {format(cycle.endDate.toDate(), 'EEE, MMM d, yyyy')}
                  </span>
                )}
                {!cycle && <span className="text-xs">Outside cycles</span>}
              </div>
              <div className="text-right">
                <p className={clsx('text-xs font-medium', group.isActive ? 'text-white/90' : 'text-gray-500 dark:text-gray-400')}>
                  {allPaid ? '✓ All paid' : `${group.bills.filter((pb) => pb.isPaid).length}/${group.bills.length} paid`}
                </p>
                <p className={clsx('text-sm font-bold', group.isActive ? 'text-white' : '')}>
                  {formatCurrency(groupTotal)}
                  {paidTotal > 0 && paidTotal < groupTotal && (
                    <span className={clsx('text-xs font-normal ml-1', group.isActive ? 'text-white/70' : 'text-green-600 dark:text-green-400')}>
                      ({formatCurrency(paidTotal)} paid)
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Bills list */}
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {group.bills.map((pb, idx) => (
                <button
                  key={`${pb.bill.id}-${idx}`}
                  onClick={() => setSelectedBill(pb)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={clsx(
                      'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
                      pb.isPaid ? 'bg-green-100 dark:bg-green-900/50' : pb.isInCurrentCycle ? 'bg-yellow-100 dark:bg-yellow-900/50' : 'bg-gray-100 dark:bg-gray-700'
                    )}>
                      {pb.isPaid
                        ? <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                        : pb.isInCurrentCycle
                          ? <Clock className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />
                          : <CalendarIcon className="w-3.5 h-3.5 text-gray-400" />
                      }
                    </div>
                    <div className="min-w-0">
                      <p className={clsx(
                        'text-sm font-medium truncate',
                        pb.isPaid ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-gray-100'
                      )}>
                        {pb.bill.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {format(pb.date, 'EEE, MMM d')}
                        {pb.bill.isAutoPay && <span className="ml-1.5 text-green-600 dark:text-green-400">⚡ AutoPay</span>}
                        {pb.bill.isVariable && <span className="ml-1.5 text-amber-600 dark:text-amber-400">↻ Variable</span>}
                      </p>
                    </div>
                  </div>
                  <span className={clsx(
                    'text-sm font-semibold shrink-0 ml-2',
                    pb.isPaid ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'
                  )}>
                    {formatCurrency(pb.bill.amount)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── SIDEBAR ───────────────────────────────────────────────────────────
  const Sidebar = () => (
    <div className="lg:w-80 space-y-4">
      {/* Upcoming Bills */}
      <Card>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          Upcoming Bills
          <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 font-normal">Next 14 days</span>
        </h3>
        {upcomingBills.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No upcoming bills in the next 14 days</p>
        ) : (
          <div className="space-y-1">
            {upcomingBills.slice(0, showAllUpcoming ? undefined : 5).map((pb, idx) => {
              const daysUntil = differenceInDays(pb.date, new Date());
              return (
                <button
                  key={`${pb.bill.id}-${idx}`}
                  onClick={() => setSelectedBill(pb)}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left group"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{pb.bill.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {format(pb.date, 'MMM d')}
                      {daysUntil === 0 && <span className="ml-1 text-red-500 font-medium">· Today!</span>}
                      {daysUntil === 1 && <span className="ml-1 text-orange-500 font-medium">· Tomorrow</span>}
                      {daysUntil > 1 && <span className="ml-1 text-gray-400">· in {daysUntil}d</span>}
                    </p>
                  </div>
                  <span className="font-semibold text-gray-700 dark:text-gray-300 shrink-0 ml-2">
                    {formatCurrency(pb.bill.amount)}
                  </span>
                </button>
              );
            })}
            {upcomingBills.length > 5 && (
              <button
                onClick={() => setShowAllUpcoming(!showAllUpcoming)}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 w-full text-center pt-1 transition-colors"
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
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-600 dark:text-gray-400">{format(currentDate, 'MMMM')}</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {formatCurrency(monthlyTotals.currentMonth)}
              </span>
            </div>
            {monthlyTotals.currentMonthPaid > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{
                      width: `${monthlyTotals.currentMonth > 0
                        ? Math.round((monthlyTotals.currentMonthPaid / monthlyTotals.currentMonth) * 100)
                        : 0}%`
                    }}
                  />
                </div>
                <span className="text-xs text-green-600 dark:text-green-400 shrink-0">
                  {formatCurrency(monthlyTotals.currentMonthPaid)} paid
                </span>
              </div>
            )}
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-700">
            <span className="text-sm text-gray-600 dark:text-gray-400">{format(addMonths(currentDate, 1), 'MMMM')}</span>
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
  );

  // ── BILL DETAIL MODAL ─────────────────────────────────────────────────
  return (
    <AppLayout title="Bill Calendar">
      <ActiveCycleBanner />

      <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
        {/* Main Calendar */}
        <div className="flex-1 min-w-0">
          <Card>
            <CalendarHeader />
            {viewMode === 'month' && <MonthView />}
            {viewMode === 'week' && <WeekView />}
            {viewMode === 'agenda' && <AgendaView />}
          </Card>
        </div>

        {/* Sidebar — hidden on agenda view (it's redundant there) */}
        {viewMode !== 'agenda' && <Sidebar />}
      </div>

      {/* Bill Detail Modal */}
      <Modal
        isOpen={!!selectedBill}
        onClose={() => setSelectedBill(null)}
        title="Bill Details"
      >
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
                  <><Check className="w-3 h-3 mr-1" />Paid</>
                ) : selectedBill.isInCurrentCycle ? (
                  <><Clock className="w-3 h-3 mr-1" />Due Soon</>
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

              {selectedBill.bill.paymentMethodId && paymentMethodsById[selectedBill.bill.paymentMethodId] && (
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
                This bill is in your current pay cycle
                {!selectedBill.isPaid && '. Go to the Paycheck page to mark it as paid.'}
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
