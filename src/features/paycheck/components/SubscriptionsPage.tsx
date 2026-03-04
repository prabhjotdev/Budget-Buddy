import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  AlertTriangle,
  CalendarCheck,
  ExternalLink,
  Bell,
  BellOff,
  PackageOpen,
} from 'lucide-react';
import { addDays, addMonths, differenceInDays, format, isBefore } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { AppLayout } from '../../../components/layout';
import { Card, CardHeader, Button } from '../../../components/shared';
import { Bill, BillFrequency } from '../../../types';
import { formatCurrency } from '../../../utils/currency';
import { ROUTES } from '../../../constants';
import { fetchBills } from '../billsSlice';
import { fetchPaymentMethods } from '../paymentMethodsSlice';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FREQUENCY_LABELS: Record<BillFrequency, string> = {
  monthly: 'Monthly',
  'bi-weekly': 'Bi-Weekly',
  quarterly: 'Quarterly',
  'semi-annual': 'Semi-Annual',
  annual: 'Annual',
  'one-time': 'One-Time',
};

/** Returns the next renewal date for a bill from today onward. */
function getNextRenewalDate(bill: Bill): Date | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (bill.frequency === 'one-time') {
    return bill.startDate ? bill.startDate.toDate() : null;
  }

  if (bill.frequency === 'monthly') {
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), bill.dueDay);
    if (thisMonth >= today) return thisMonth;
    return new Date(today.getFullYear(), today.getMonth() + 1, bill.dueDay);
  }

  if (!bill.startDate) return null;
  const start = bill.startDate.toDate();

  if (bill.frequency === 'bi-weekly') {
    let next = new Date(start);
    while (isBefore(next, today)) {
      next = addDays(next, 14);
    }
    return next;
  }

  const monthsMap: Partial<Record<BillFrequency, number>> = {
    quarterly: 3,
    'semi-annual': 6,
    annual: 12,
  };
  const months = monthsMap[bill.frequency];
  if (months) {
    let next = new Date(start);
    while (isBefore(next, today)) {
      next = addMonths(next, months);
    }
    return next;
  }

  return null;
}

/** Approximate monthly cost of a bill for summary stats. */
function toMonthlyCost(bill: Bill): number {
  switch (bill.frequency) {
    case 'monthly':     return bill.amount;
    case 'bi-weekly':   return bill.amount * 2;
    case 'quarterly':   return bill.amount / 3;
    case 'semi-annual': return bill.amount / 6;
    case 'annual':      return bill.amount / 12;
    default:            return 0; // one-time: don't count in recurring totals
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SubscriptionCardProps {
  bill: Bill;
  paymentMethodName: string | null;
  onManage: () => void;
}

const SubscriptionCard = ({ bill, paymentMethodName, onManage }: SubscriptionCardProps) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const nextRenewal = getNextRenewalDate(bill);
  const daysUntilRenewal = nextRenewal ? differenceInDays(nextRenewal, today) : null;
  const renewalSoon = daysUntilRenewal !== null && daysUntilRenewal <= 5;

  const cancelDate = bill.cancelReminderDate instanceof Timestamp
    ? bill.cancelReminderDate.toDate()
    : null;
  const daysUntilCancel = cancelDate ? differenceInDays(cancelDate, today) : null;
  const cancelOverdue = daysUntilCancel !== null && daysUntilCancel < 0;
  const cancelSoon = daysUntilCancel !== null && daysUntilCancel >= 0 && daysUntilCancel <= 7;

  return (
    <div
      className={`p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border transition-colors ${
        renewalSoon || cancelSoon || cancelOverdue
          ? 'border-orange-300 dark:border-orange-600'
          : 'border-transparent'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: icon + info */}
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5">
            <RefreshCw className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-gray-900 dark:text-gray-100">{bill.name}</span>
              {bill.isAutoPay && (
                <span className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/50 px-1.5 py-0.5 rounded">
                  Auto-pay
                </span>
              )}
            </div>

            {/* Renewal date */}
            <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500 dark:text-gray-400">
              <CalendarCheck className="w-3 h-3 flex-shrink-0" />
              {nextRenewal ? (
                <span className={renewalSoon ? 'text-orange-600 dark:text-orange-400 font-medium' : ''}>
                  {daysUntilRenewal === 0
                    ? 'Renews today'
                    : daysUntilRenewal === 1
                    ? 'Renews tomorrow'
                    : daysUntilRenewal !== null && daysUntilRenewal <= 5
                    ? `Renews in ${daysUntilRenewal} days`
                    : `Renews ${format(nextRenewal, 'MMM d, yyyy')}`}
                </span>
              ) : (
                <span>No renewal date</span>
              )}
              <span>•</span>
              <span>{FREQUENCY_LABELS[bill.frequency]}</span>
              {paymentMethodName && (
                <>
                  <span>•</span>
                  <span>{paymentMethodName}</span>
                </>
              )}
            </div>

            {/* Cancel reminder */}
            {cancelDate && (
              <div
                className={`flex items-center gap-1.5 mt-1 text-xs font-medium ${
                  cancelOverdue
                    ? 'text-red-600 dark:text-red-400'
                    : cancelSoon
                    ? 'text-orange-600 dark:text-orange-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {cancelOverdue ? (
                  <BellOff className="w-3 h-3 flex-shrink-0" />
                ) : (
                  <Bell className="w-3 h-3 flex-shrink-0" />
                )}
                {cancelOverdue
                  ? `Cancel reminder was ${format(cancelDate, 'MMM d')} — past due`
                  : daysUntilCancel === 0
                  ? 'Cancel reminder: today'
                  : daysUntilCancel === 1
                  ? 'Cancel reminder: tomorrow'
                  : `Cancel by ${format(cancelDate, 'MMM d, yyyy')}`}
              </div>
            )}
          </div>
        </div>

        {/* Right: amount + edit */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {formatCurrency(bill.amount)}
          </span>
          <button
            onClick={onManage}
            className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            title="Edit in Manage"
          >
            <ExternalLink className="w-3 h-3" />
            Edit
          </button>
        </div>
      </div>

      {/* Renewal soon alert banner */}
      {renewalSoon && (
        <div className="flex items-center gap-2 mt-3 px-3 py-2 bg-orange-50 dark:bg-orange-900/30 rounded-lg text-xs text-orange-700 dark:text-orange-300">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            Renewing soon — if you no longer need this, cancel before{' '}
            {nextRenewal ? format(nextRenewal, 'MMM d') : 'the renewal date'}.
          </span>
        </div>
      )}
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export const SubscriptionsPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { byId, allIds } = useAppSelector((state) => state.bills);
  const { byId: paymentMethodsById } = useAppSelector((state) => state.paymentMethods);

  useEffect(() => {
    if (user) {
      dispatch(fetchBills(user.uid));
      dispatch(fetchPaymentMethods(user.uid));
    }
  }, [user, dispatch]);

  const subscriptions = useMemo(() => {
    return allIds
      .map((id) => byId[id])
      .filter((b): b is Bill => Boolean(b) && b.isSubscription === true);
  }, [allIds, byId]);

  const activeSubscriptions = useMemo(
    () => subscriptions.filter((b) => b.isActive !== false),
    [subscriptions]
  );

  const inactiveSubscriptions = useMemo(
    () => subscriptions.filter((b) => b.isActive === false),
    [subscriptions]
  );

  const stats = useMemo(() => {
    const monthlyTotal = activeSubscriptions.reduce((sum, b) => sum + toMonthlyCost(b), 0);
    return {
      count: activeSubscriptions.length,
      monthlyTotal,
      annualTotal: monthlyTotal * 12,
    };
  }, [activeSubscriptions]);

  // Sort active subscriptions by next renewal date (soonest first)
  const sortedActive = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return [...activeSubscriptions].sort((a, b) => {
      const da = getNextRenewalDate(a);
      const db = getNextRenewalDate(b);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da.getTime() - db.getTime();
    });
  }, [activeSubscriptions]);

  const hasAlerts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return sortedActive.some((b) => {
      const renewal = getNextRenewalDate(b);
      const renewalSoon = renewal && differenceInDays(renewal, today) <= 5;
      const cancelDate =
        b.cancelReminderDate instanceof Timestamp ? b.cancelReminderDate.toDate() : null;
      const cancelAlert = cancelDate && differenceInDays(cancelDate, today) <= 7;
      return renewalSoon || cancelAlert;
    });
  }, [sortedActive]);

  return (
    <AppLayout title="Subscriptions">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Subscriptions</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Bills marked as subscriptions across all frequencies
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => navigate(ROUTES.MANAGE)}
            className="flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Manage Bills
          </Button>
        </div>

        {subscriptions.length === 0 ? (
          /* ── Empty state ── */
          <Card>
            <div className="text-center py-10">
              <PackageOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400 font-medium mb-1">
                No subscriptions tracked yet
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                Open the Manage tab, edit a bill, and check "This is a subscription" to start
                tracking it here.
              </p>
              <Button onClick={() => navigate(ROUTES.MANAGE)}>Go to Manage</Button>
            </div>
          </Card>
        ) : (
          <>
            {/* ── Stats row ── */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <Card padding="sm">
                <div className="text-center">
                  <p className="text-lg sm:text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {stats.count}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Active subscription{stats.count !== 1 ? 's' : ''}
                  </p>
                </div>
              </Card>
              <Card padding="sm">
                <div className="text-center">
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
                    {formatCurrency(stats.monthlyTotal)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Est. / month</p>
                </div>
              </Card>
              <Card padding="sm">
                <div className="text-center">
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
                    {formatCurrency(stats.annualTotal)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Est. / year</p>
                </div>
              </Card>
            </div>

            {/* ── Alerts banner ── */}
            {hasAlerts && (
              <div className="flex items-start gap-3 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-orange-500 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
                    Heads up — some subscriptions need attention
                  </p>
                  <p className="text-xs text-orange-700 dark:text-orange-400 mt-0.5">
                    One or more subscriptions are renewing soon or have a cancel reminder due.
                    Review the list below.
                  </p>
                </div>
              </div>
            )}

            {/* ── Active subscriptions ── */}
            <Card>
              <CardHeader
                title="Active Subscriptions"
                subtitle="Sorted by next renewal date"
              />
              <div className="space-y-3 mt-4">
                {sortedActive.map((bill) => (
                  <SubscriptionCard
                    key={bill.id}
                    bill={bill}
                    paymentMethodName={
                      bill.paymentMethodId ? (paymentMethodsById[bill.paymentMethodId]?.name ?? null) : null
                    }
                    onManage={() => navigate(ROUTES.MANAGE)}
                  />
                ))}
              </div>
            </Card>

            {/* ── Inactive subscriptions ── */}
            {inactiveSubscriptions.length > 0 && (
              <Card>
                <CardHeader
                  title="Inactive Subscriptions"
                  subtitle="These are excluded from totals and the calendar"
                />
                <div className="space-y-3 mt-4">
                  {inactiveSubscriptions.map((bill) => (
                    <SubscriptionCard
                      key={bill.id}
                      bill={bill}
                      paymentMethodName={
                        bill.paymentMethodId
                          ? (paymentMethodsById[bill.paymentMethodId]?.name ?? null)
                          : null
                      }
                      onManage={() => navigate(ROUTES.MANAGE)}
                    />
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
};
