import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  AlertCircle,
  Plus,
  Receipt,
  Shield,
  Pencil,
  Settings,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { fetchActiveCycle } from '../paycheckCyclesSlice';
import { fetchSpendingTransactions } from '../spendingTransactionsSlice';
import { fetchBuffer } from '../bufferSlice';
import { fetchPaymentMethods } from '../paymentMethodsSlice';
import { fetchSpendingTags } from '../spendingTagsSlice';
import { AppLayout } from '../../../components/layout';
import { Card, CardHeader, Button, ProgressBar } from '../../../components/shared';
import { formatCurrency } from '../../../utils/currency';
import { StartCycleWizard } from './StartCycleWizard';
import { CycleBillsList } from './CycleBillsList';
import { SpendingSummary } from './SpendingSummary';
import { LogSpendingModal } from './LogSpendingModal';
import { EndCycleModal } from './EndCycleModal';
import { MarkBillPaidModal } from './MarkBillPaidModal';
import { BufferWithdrawModal } from './BufferWithdrawModal';
import { EditPaycheckModal } from './EditPaycheckModal';
import { EditCycleModal } from './EditCycleModal';
import { PaycheckCycle } from '../../../types';

export const CycleDashboard = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { byId: cyclesById, activeCycleId } = useAppSelector(
    (state) => state.paycheckCycles
  );
  const { buffer } = useAppSelector((state) => state.buffer);

  // Track whether we've done the initial check for active cycle
  const [hasCheckedForCycle, setHasCheckedForCycle] = useState(false);

  const activeCycle = activeCycleId ? cyclesById[activeCycleId] : null;

  useEffect(() => {
    if (user) {
      Promise.all([
        dispatch(fetchActiveCycle(user.uid)),
        dispatch(fetchBuffer(user.uid)),
        dispatch(fetchSpendingTransactions(user.uid)),
      ]).finally(() => {
        setHasCheckedForCycle(true);
      });
    }
  }, [dispatch, user]);

  // Show loading until we've checked for an active cycle
  if (!hasCheckedForCycle) {
    return (
      <AppLayout title="Paycheck Budget">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </AppLayout>
    );
  }

  // If no active cycle after checking, show the start wizard
  if (!activeCycle) {
    return (
      <AppLayout title="Paycheck Budget">
        <StartCycleWizard />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Paycheck Budget">
      <CycleDashboardContent cycle={activeCycle} buffer={buffer} />
    </AppLayout>
  );
};

interface CycleDashboardContentProps {
  cycle: PaycheckCycle;
  buffer: { totalAmount: number } | null;
}

const CycleDashboardContent = ({ cycle, buffer }: CycleDashboardContentProps) => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const [logSpendingOpen, setLogSpendingOpen] = useState(false);
  const [endCycleOpen, setEndCycleOpen] = useState(false);
  const [markBillPaidOpen, setMarkBillPaidOpen] = useState(false);
  const [useBufferOpen, setUseBufferOpen] = useState(false);
  const [editPaycheckOpen, setEditPaycheckOpen] = useState(false);
  const [editCycleOpen, setEditCycleOpen] = useState(false);

  // Fetch payment methods and tags for the spending modal
  useEffect(() => {
    if (user) {
      dispatch(fetchPaymentMethods(user.uid));
      dispatch(fetchSpendingTags(user.uid));
    }
  }, [dispatch, user]);

  // Calculate cycle progress
  const cycleProgress = useMemo(() => {
    const startDate = cycle.startDate.toDate();
    const endDate = cycle.endDate.toDate();
    const now = new Date();

    // Strip time for accurate day counting (inclusive of both start and end dates)
    const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // +1 for inclusive count (e.g., Jan 1-14 = 14 days, not 13)
    const totalDays = Math.round((endDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const daysElapsed = Math.min(totalDays, Math.round((today.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const daysRemaining = Math.max(0, totalDays - daysElapsed);
    const percentComplete = Math.min(100, (daysElapsed / totalDays) * 100);

    return { totalDays, daysElapsed, daysRemaining, percentComplete };
  }, [cycle]);

  // Calculate spending progress
  const spendingProgress = useMemo(() => {
    const percent = cycle.spendingLimit > 0
      ? (cycle.totalSpent / cycle.spendingLimit) * 100
      : 0;
    const isOverBudget = cycle.remainingToSpend < 0;
    const dailyBudget = cycleProgress.daysRemaining > 0
      ? cycle.remainingToSpend / cycleProgress.daysRemaining
      : 0;

    return { percent, isOverBudget, dailyBudget };
  }, [cycle, cycleProgress]);

  return (
    <div className="space-y-6">
      {/* Spending Alert if over budget or low */}
      {spendingProgress.isOverBudget && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-800 dark:text-red-300">Over Spending Limit</p>
            <p className="text-sm text-red-600 dark:text-red-400">
              You've spent ${Math.abs(cycle.remainingToSpend).toFixed(2)} more than your limit.
              Consider using your buffer if needed.
            </p>
          </div>
        </div>
      )}

      {/* Hero Card */}
      <Card className={spendingProgress.isOverBudget ? 'ring-2 ring-red-200 dark:ring-red-800' : ''}>
        <div className="space-y-4">
          {/* Label + Amount */}
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Left to spend
            </p>
            <p
              className={`text-4xl md:text-5xl font-bold mt-1 ${
                spendingProgress.isOverBudget
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-green-600 dark:text-green-400'
              }`}
            >
              {formatCurrency(cycle.remainingToSpend)}
            </p>
          </div>

          {/* Spending progress bar */}
          <div>
            <ProgressBar
              value={Math.min(spendingProgress.percent, 100)}
              size="lg"
              isOverBudget={spendingProgress.isOverBudget}
              showLabel
            />
            <div className="flex justify-between text-sm mt-2 text-gray-500 dark:text-gray-400">
              <span>{formatCurrency(cycle.totalSpent)} spent</span>
              <span>{formatCurrency(cycle.spendingLimit)} limit</span>
            </div>
          </div>

          {/* Daily budget · days left */}
          {cycleProgress.daysRemaining > 0 && !spendingProgress.isOverBudget && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {formatCurrency(spendingProgress.dailyBudget)}/day &middot; {cycleProgress.daysRemaining} days left
            </p>
          )}

          {/* Desktop-only Log Spending button */}
          <div className="hidden md:block pt-2">
            <Button
              className="flex items-center gap-2"
              onClick={() => setLogSpendingOpen(true)}
            >
              <Plus className="w-4 h-4" />
              Log Spending
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Bills Due */}
        <CycleBillsList bills={cycle.bills} />

        {/* Recent Spending */}
        <SpendingSummary cycleId={cycle.id} />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader title="Quick Actions" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
          <Button
            className="flex items-center justify-center gap-2"
            onClick={() => setLogSpendingOpen(true)}
          >
            <Plus className="w-4 h-4" />
            Log Spending
          </Button>
          <Button
            variant="secondary"
            className="flex items-center justify-center gap-2"
            onClick={() => setMarkBillPaidOpen(true)}
          >
            <Receipt className="w-4 h-4" />
            Mark Bill Paid
          </Button>
          <Button
            variant="secondary"
            className="flex items-center justify-center gap-2"
            onClick={() => setUseBufferOpen(true)}
            disabled={!buffer || buffer.totalAmount <= 0}
          >
            <Shield className="w-4 h-4" />
            Use Buffer
          </Button>
          <Button
            variant="secondary"
            className="flex items-center justify-center gap-2"
            onClick={() => setEditCycleOpen(true)}
          >
            <Settings className="w-4 h-4" />
            Edit Cycle
          </Button>
          <Button
            variant="secondary"
            className="flex items-center justify-center gap-2 col-span-2 md:col-span-1"
            onClick={() => setEndCycleOpen(true)}
          >
            <Calendar className="w-4 h-4" />
            End Cycle
          </Button>
        </div>
      </Card>

      {/* Paycheck Breakdown */}
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Paycheck Breakdown</h3>
          <button
            onClick={() => setEditPaycheckOpen(true)}
            className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
            title="Edit paycheck amount"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-600 dark:text-gray-400">Paycheck Amount</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {formatCurrency(cycle.paycheckAmount)}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 text-red-600 dark:text-red-400">
            <span>− Bills Reserved</span>
            <span>−{formatCurrency(cycle.billsTotal)}</span>
          </div>
          <div className="flex justify-between items-center py-2 text-blue-600 dark:text-blue-400">
            <span>− Minimum Save</span>
            <span>−{formatCurrency(cycle.minimumSave)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-t border-gray-200 dark:border-gray-700 font-semibold">
            <span className="text-gray-900 dark:text-gray-100">= Spending Limit</span>
            <span className="text-green-600 dark:text-green-400">{formatCurrency(cycle.spendingLimit)}</span>
          </div>
        </div>
      </Card>

      {/* Log Spending Modal */}
      <LogSpendingModal
        isOpen={logSpendingOpen}
        onClose={() => setLogSpendingOpen(false)}
        cycleId={cycle.id}
        currentSpent={cycle.totalSpent}
        spendingLimit={cycle.spendingLimit}
      />

      {/* End Cycle Modal */}
      <EndCycleModal
        isOpen={endCycleOpen}
        onClose={() => setEndCycleOpen(false)}
        cycle={cycle}
      />

      {/* Mark Bill Paid Modal */}
      <MarkBillPaidModal
        isOpen={markBillPaidOpen}
        onClose={() => setMarkBillPaidOpen(false)}
        cycleId={cycle.id}
        bills={cycle.bills}
      />

      {/* Use Buffer Modal */}
      <BufferWithdrawModal
        isOpen={useBufferOpen}
        onClose={() => setUseBufferOpen(false)}
        maxAmount={buffer?.totalAmount || 0}
        cycleId={cycle.id}
      />

      {/* Edit Paycheck Modal */}
      <EditPaycheckModal
        isOpen={editPaycheckOpen}
        onClose={() => setEditPaycheckOpen(false)}
        cycleId={cycle.id}
        currentAmount={cycle.paycheckAmount}
        billsTotal={cycle.billsTotal}
        minimumSave={cycle.minimumSave}
        totalSpent={cycle.totalSpent}
      />

      {/* Edit Cycle Modal */}
      <EditCycleModal
        isOpen={editCycleOpen}
        onClose={() => setEditCycleOpen(false)}
        cycle={cycle}
      />
    </div>
  );
};
