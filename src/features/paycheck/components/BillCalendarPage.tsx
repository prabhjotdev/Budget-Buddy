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
} from 'date-fns';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { fetchBills } from '../billsSlice';
import { fetchPaycheckCycles } from '../paycheckCyclesSlice';
import { fetchPaymentMethods } from '../paymentMethodsSlice';
import { AppLayout } from '../../../components/layout';
import { Card, Modal, Button, Badge } from '../../../components/shared';
import { formatCurrency } from '../../../utils/currency';
import { Bill, PaycheckCycle } from '../../../types';

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
  const lookbackStart = subMonths(startDate, 1); // Look back a month for bills that might fall in range

  bills.forEach((bill) => {
    if (!bill.isActive) return;

    // Find the first occurrence after lookbackStart
    let currentDate = new Date(
      lookbackStart.getFullYear(),
      lookbackStart.getMonth(),
      Math.min(bill.dueDay, new Date(lookbackStart.getFullYear(), lookbackStart.getMonth() + 1, 0).getDate())
    );

    // If before lookback, advance to first valid occurrence
    if (isBefore(currentDate, lookbackStart)) {
      currentDate = getNextBillDate(bill, lookbackStart);
    }

    // Generate all occurrences within the range
    while (isBefore(currentDate, endDate) || isSameDay(currentDate, endDate)) {
      if ((isAfter(currentDate, startDate) || isSameDay(currentDate, startDate)) &&
          (isBefore(currentDate, endDate) || isSameDay(currentDate, endDate))) {
        // Check if this bill is paid in any cycle
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

      // Move to next occurrence
      if (bill.frequency === 'one-time') break;
      currentDate = advanceBillDate(currentDate, bill.frequency);
    }
  });

  // Sort by date
  return projectedBills.sort((a, b) => a.date.getTime() - b.date.getTime());
};

export const BillCalendarPage = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { byId: billsById, activeIds } = useAppSelector((state) => state.bills);
  const { byId: cyclesById, allIds: cycleIds, activeCycleId } = useAppSelector((state) => state.paycheckCycles);
  const { byId: paymentMethodsById } = useAppSelector((state) => state.paymentMethods);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedBill, setSelectedBill] = useState<ProjectedBill | null>(null);

  // Fetch data on mount
  useEffect(() => {
    if (user) {
      dispatch(fetchBills(user.uid));
      dispatch(fetchPaycheckCycles(user.uid));
      dispatch(fetchPaymentMethods(user.uid));
    }
  }, [dispatch, user]);

  // Get active bills
  const activeBills = useMemo(() => {
    return activeIds.map((id) => billsById[id]).filter(Boolean);
  }, [billsById, activeIds]);

  // Get cycles
  const cycles = useMemo(() => {
    return cycleIds.map((id) => cyclesById[id]).filter(Boolean);
  }, [cyclesById, cycleIds]);

  // Get active cycle
  const activeCycle = activeCycleId ? cyclesById[activeCycleId] : null;

  // Calculate calendar dates
  const calendarDates = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // Project bills for the visible month plus next month (for sidebar)
  const projectedBills = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const nextMonthEnd = endOfMonth(addMonths(currentMonth, 1));

    return projectBillsForRange(activeBills, monthStart, nextMonthEnd, cycles);
  }, [activeBills, currentMonth, cycles]);

  // Group bills by date for calendar display
  const billsByDate = useMemo(() => {
    const map = new Map<string, ProjectedBill[]>();
    projectedBills.forEach((pb) => {
      const key = format(pb.date, 'yyyy-MM-dd');
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(pb);
    });
    return map;
  }, [projectedBills]);

  // Calculate cycle date ranges for overlay
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
      }));
  }, [cycles, currentMonth]);

  // Get cycle for a specific date
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
      currentMonthPaid: currentMonthBills.filter((pb) => pb.isPaid).reduce((sum, pb) => sum + pb.bill.amount, 0),
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

    return weekTotals.reduce((max, week) => (week.total > max.total ? week : max), weekTotals[0]);
  }, [projectedBills, currentMonth]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth((prev) => (direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  return (
    <AppLayout title="Bill Calendar">
      <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
        {/* Main Calendar */}
        <div className="flex-1">
          <Card>
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigateMonth('prev')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <h2 className="text-lg font-semibold text-gray-900 min-w-[140px] text-center">
                  {format(currentMonth, 'MMMM yyyy')}
                </h2>
                <button
                  onClick={() => navigateMonth('next')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              <Button size="sm" variant="secondary" onClick={goToToday}>
                Today
              </Button>
            </div>

            {/* Cycle Legend */}
            {cycleRanges.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4 text-xs">
                {cycleRanges.map((range, index) => (
                  <div
                    key={range.id}
                    className={clsx(
                      'flex items-center gap-1 px-2 py-1 rounded',
                      range.isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
                    )}
                  >
                    <div
                      className={clsx(
                        'w-2 h-2 rounded-full',
                        range.isActive ? 'bg-indigo-500' : 'bg-gray-400'
                      )}
                    />
                    Cycle {index + 1}: {format(range.start, 'MMM d')} - {format(range.end, 'MMM d')}
                  </div>
                ))}
              </div>
            )}

            {/* Day Headers */}
            <div className="grid grid-cols-7 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-medium text-gray-500 py-2"
                >
                  <span className="hidden sm:inline">{day}</span>
                  <span className="sm:hidden">{day.charAt(0)}</span>
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
              {calendarDates.map((date) => {
                const dateKey = format(date, 'yyyy-MM-dd');
                const dayBills = billsByDate.get(dateKey) || [];
                const isCurrentMonth = isSameMonth(date, currentMonth);
                const isTodayDate = isToday(date);
                const cycle = getCycleForDate(date);

                return (
                  <div
                    key={dateKey}
                    className={clsx(
                      'min-h-[60px] sm:min-h-[80px] md:min-h-[100px] p-1 bg-white',
                      !isCurrentMonth && 'bg-gray-50',
                      cycle?.isActive && 'bg-indigo-50/50'
                    )}
                  >
                    {/* Date number */}
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={clsx(
                          'text-xs sm:text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full',
                          isTodayDate && 'bg-indigo-600 text-white',
                          !isTodayDate && isCurrentMonth && 'text-gray-900',
                          !isTodayDate && !isCurrentMonth && 'text-gray-400'
                        )}
                      >
                        {format(date, 'd')}
                      </span>
                      {cycle && (
                        <div
                          className={clsx(
                            'w-1.5 h-1.5 rounded-full hidden sm:block',
                            cycle.isActive ? 'bg-indigo-500' : 'bg-gray-300'
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
                            pb.isPaid
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : pb.isInCurrentCycle
                                ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          )}
                        >
                          <span className="hidden sm:inline">{pb.bill.name}</span>
                          <span className="sm:hidden">{pb.bill.name.substring(0, 3)}</span>
                        </button>
                      ))}
                      {dayBills.length > 3 && (
                        <div className="text-xs text-gray-500 px-1">
                          +{dayBills.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-4 text-xs text-gray-600">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-100 border border-green-300" />
                <span>Paid</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300" />
                <span>Current Cycle</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-gray-100 border border-gray-300" />
                <span>Future</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="lg:w-80 space-y-4">
          {/* Upcoming Bills */}
          <Card>
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              Upcoming Bills
            </h3>
            {upcomingBills.length === 0 ? (
              <p className="text-sm text-gray-500">No upcoming bills in the next 14 days</p>
            ) : (
              <div className="space-y-2">
                {upcomingBills.slice(0, 5).map((pb, idx) => (
                  <button
                    key={`${pb.bill.id}-${idx}`}
                    onClick={() => setSelectedBill(pb)}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
                  >
                    <div>
                      <p className="font-medium text-sm text-gray-900">{pb.bill.name}</p>
                      <p className="text-xs text-gray-500">{format(pb.date, 'MMM d, yyyy')}</p>
                    </div>
                    <span className="font-semibold text-gray-700">
                      {formatCurrency(pb.bill.amount)}
                    </span>
                  </button>
                ))}
                {upcomingBills.length > 5 && (
                  <p className="text-xs text-gray-500 text-center pt-2">
                    +{upcomingBills.length - 5} more
                  </p>
                )}
              </div>
            )}
          </Card>

          {/* Monthly Summary */}
          <Card>
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-gray-500" />
              Monthly Summary
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">{format(currentMonth, 'MMMM')}</span>
                <div className="text-right">
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(monthlyTotals.currentMonth)}
                  </span>
                  {monthlyTotals.currentMonthPaid > 0 && (
                    <p className="text-xs text-green-600">
                      {formatCurrency(monthlyTotals.currentMonthPaid)} paid
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">{format(addMonths(currentMonth, 1), 'MMMM')}</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(monthlyTotals.nextMonth)}
                </span>
              </div>
            </div>
          </Card>

          {/* Heaviest Week Alert */}
          {heaviestWeek && heaviestWeek.total > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <h3 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Heaviest Week
              </h3>
              <p className="text-sm text-amber-700">
                Week of {format(heaviestWeek.start, 'MMM d')}:{' '}
                <span className="font-semibold">{formatCurrency(heaviestWeek.total)}</span> in bills
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Bill Detail Modal */}
      <Modal
        isOpen={!!selectedBill}
        onClose={() => setSelectedBill(null)}
        title="Bill Details"
      >
        {selectedBill && (
          <div className="space-y-4">
            {/* Bill Name and Status */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedBill.bill.name}
                </h3>
                <p className="text-2xl font-bold text-gray-900 mt-1">
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

            {/* Details */}
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 text-gray-600">
                <CalendarIcon className="w-4 h-4 text-gray-400" />
                <span>Due: {format(selectedBill.date, 'EEEE, MMMM d, yyyy')}</span>
              </div>

              <div className="flex items-center gap-3 text-gray-600">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="capitalize">{selectedBill.bill.frequency} bill</span>
              </div>

              {selectedBill.bill.paymentMethodId && paymentMethodsById[selectedBill.bill.paymentMethodId] && (
                <div className="flex items-center gap-3 text-gray-600">
                  <CreditCard className="w-4 h-4 text-gray-400" />
                  <span>
                    {paymentMethodsById[selectedBill.bill.paymentMethodId].name}
                  </span>
                </div>
              )}

              {selectedBill.bill.isAutoPay && (
                <div className="flex items-center gap-3 text-green-600">
                  <Zap className="w-4 h-4" />
                  <span>AutoPay enabled</span>
                </div>
              )}

              {selectedBill.bill.isVariable && (
                <div className="flex items-center gap-3 text-amber-600">
                  <AlertCircle className="w-4 h-4" />
                  <span>Variable amount - confirm each cycle</span>
                </div>
              )}
            </div>

            {/* Cycle Info */}
            {selectedBill.cycleId && activeCycle && selectedBill.cycleId === activeCycle.id && (
              <div className="p-3 bg-indigo-50 rounded-lg text-sm text-indigo-700">
                This bill is scheduled for your current pay cycle
                {!selectedBill.isPaid && (
                  <span>. Go to the Paycheck page to mark it as paid.</span>
                )}
              </div>
            )}

            <div className="pt-2">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setSelectedBill(null)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </AppLayout>
  );
};
