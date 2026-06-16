import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  AlertCircle,
  Plus,
  Check,
  CheckSquare,
  ChevronDown,
  Shield,
  Pencil,
  Settings,
  Wallet,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { fetchActiveCycle } from '../paycheckCyclesSlice';
import { fetchSpendingTransactions } from '../spendingTransactionsSlice';
import { fetchBuffer } from '../bufferSlice';
import { fetchEmergencyFund } from '../../emergencyFund/emergencyFundSlice';
import { fetchPaymentMethods } from '../paymentMethodsSlice';
import { fetchSpendingTags } from '../spendingTagsSlice';
import { AppLayout } from '../../../components/layout';
import { Card, Button, ProgressBar } from '../../../components/shared';
import { formatCurrency } from '../../../utils/currency';
import { StartCycleWizard } from './StartCycleWizard';
import { CycleBillsList } from './CycleBillsList';
import { SpendingSummary } from './SpendingSummary';
import { LogSpendingModal } from './LogSpendingModal';
import { EndCycleModal } from './EndCycleModal';
import { MarkBillPaidModal } from './MarkBillPaidModal';
import { BufferWithdrawModal } from './BufferWithdrawModal';
import { AddToCycleSpendingModal } from './AddToCycleSpendingModal';
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
  const emergencyFund = useAppSelector((state) => state.emergencyFund.fund);

  // Track whether we've done the initial check for active cycle
  const [hasCheckedForCycle, setHasCheckedForCycle] = useState(false);

  const activeCycle = activeCycleId ? cyclesById[activeCycleId] : null;

  useEffect(() => {
    if (user) {
      Promise.all([
        dispatch(fetchActiveCycle(user.uid)),
        dispatch(fetchBuffer(user.uid)),
        dispatch(fetchEmergencyFund(user.uid)),
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
      <CycleDashboardContent
        cycle={activeCycle}
        buffer={buffer}
        emergencyFundBalance={emergencyFund?.currentBalance || 0}
      />
    </AppLayout>
  );
};

interface CycleDashboardContentProps {
  cycle: PaycheckCycle;
  buffer: { totalAmount: number } | null;
  emergencyFundBalance: number;
}

const CycleDashboardContent = ({
  cycle,
  buffer,
  emergencyFundBalance,
}: CycleDashboardContentProps) => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const [logSpendingOpen, setLogSpendingOpen] = useState(false);
  const [endCycleOpen, setEndCycleOpen] = useState(false);
  const [markBillPaidOpen, setMarkBillPaidOpen] = useState(false);
  const [useBufferOpen, setUseBufferOpen] = useState(false);
  const [addToSpendingOpen, setAddToSpendingOpen] = useState(false);
  const [editPaycheckOpen, setEditPaycheckOpen] = useState(false);

  const hasFundsToDraw = (buffer?.totalAmount || 0) > 0 || emergencyFundBalance > 0;
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

      {/* Desktop: 2-column grid. Mobile: single-column stack. */}
      <div className="md:grid md:grid-cols-[2fr_1fr] md:gap-6 md:items-start space-y-6 md:space-y-0">

        {/* Left column — hero, mobile-only actions, breakdown, recent spending */}
        <div className="space-y-6">

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

          {/* Mobile Action Row — hidden on desktop */}
          <div className="md:hidden space-y-2">
            <Button
              className="w-full flex items-center justify-center gap-2"
              onClick={() => setLogSpendingOpen(true)}
            >
              <Plus className="w-4 h-4" />
              Log Spending
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                className="flex items-center justify-center gap-2"
                onClick={() => setMarkBillPaidOpen(true)}
              >
                <CheckSquare className="w-4 h-4" />
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
            </div>
            <Button
              variant="secondary"
              className="w-full flex items-center justify-center gap-2"
              onClick={() => setAddToSpendingOpen(true)}
              disabled={!hasFundsToDraw}
            >
              <Wallet className="w-4 h-4" />
              Add to Spending
            </Button>
          </div>

          {/* Mobile Compact Stats — hidden on desktop */}
          <div className="md:hidden grid grid-cols-2 gap-3">
            <button
              className="text-left bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3"
              onClick={() => document.getElementById('bills-section')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Bills</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {cycle.bills.filter((b) => b.isPaid).length}/{cycle.bills.length} paid
              </p>
              <div className="mt-2">
                <ProgressBar
                  value={cycle.bills.length > 0 ? (cycle.bills.filter((b) => b.isPaid).length / cycle.bills.length) * 100 : 0}
                  size="sm"
                />
              </div>
            </button>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Saved</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {formatCurrency(cycle.minimumSave)}
              </p>
              {cycle.minimumSave > 0 && !spendingProgress.isOverBudget && (
                <div className="mt-2 flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <Check className="w-4 h-4" />
                  <span className="text-xs font-medium">On track</span>
                </div>
              )}
            </div>
          </div>

          {/* Paycheck Breakdown — collapsible on mobile, always open on desktop */}
          <Card padding="none">
            <details className="group" open>
              <summary className="flex items-center justify-between p-4 md:p-6 list-none cursor-pointer md:cursor-default select-none">
                <div className="flex items-center gap-2">
                  <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Breakdown
                  </h3>
                  <ChevronDown className="w-4 h-4 text-gray-400 md:hidden transition-transform group-open:rotate-180" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                    {formatCurrency(cycle.paycheckAmount)}
                  </span>
                  <button
                    onClick={(e) => { e.preventDefault(); setEditPaycheckOpen(true); }}
                    className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                    title="Edit paycheck amount"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              </summary>

              <div className="px-4 md:px-6 pb-4 md:pb-6 space-y-3">
                {(() => {
                  const total = cycle.paycheckAmount || 1;
                  const oblTotal = cycle.variableObligationsTotal || 0;
                  const oblSpent = cycle.variableObligationsSpent || 0;
                  const billsPct = (cycle.billsTotal / total) * 100;
                  const oblPct = (oblTotal / total) * 100;
                  const savePct = (cycle.minimumSave / total) * 100;
                  const spendPct = (cycle.spendingLimit / total) * 100;

                  const rows = [
                    { label: 'Bills', pct: billsPct, amount: cycle.billsTotal, color: 'bg-blue-500', sub: null },
                    ...(oblTotal > 0
                      ? [{ label: 'Needs', pct: oblPct, amount: oblTotal, color: 'bg-orange-500', sub: oblSpent > 0 ? `${formatCurrency(oblSpent)} used` : null }]
                      : []),
                    { label: 'Save', pct: savePct, amount: cycle.minimumSave, color: 'bg-emerald-500', sub: null },
                    { label: 'Spend', pct: spendPct, amount: cycle.spendingLimit, color: 'bg-indigo-600', sub: null },
                  ];
                  return rows.map(({ label, pct, amount, color, sub }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="w-12 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 shrink-0">
                        {label}
                      </span>
                      <div className="flex-1 min-w-0 h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${color}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300 shrink-0 tabular-nums whitespace-nowrap">
                        {formatCurrency(amount)} · {pct.toFixed(0)}%
                        {sub && <span className="text-xs text-gray-400 ml-1">({sub})</span>}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </details>
          </Card>

          {/* Recent Spending */}
          <SpendingSummary cycleId={cycle.id} />

        </div>{/* end left column */}

        {/* Right column — Bills This Cycle + More Actions */}
        <div id="bills-section" className="space-y-6">
          <CycleBillsList bills={cycle.bills} />

          {/* More Actions — compact, low-prominence; collapsible on mobile */}
          <Card padding="none">
            <details className="group" open>
              <summary className="flex items-center gap-2 p-4 md:p-6 list-none cursor-pointer md:cursor-default select-none">
                <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">
                  More Actions
                </h3>
                <ChevronDown className="w-4 h-4 text-gray-400 md:hidden transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-4 md:px-6 pb-4 md:pb-6 flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-1.5 border border-gray-300 dark:border-gray-600"
                  onClick={() => setUseBufferOpen(true)}
                  disabled={!buffer || buffer.totalAmount <= 0}
                >
                  <Shield className="w-3.5 h-3.5" />
                  Use Buffer
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-1.5 border border-gray-300 dark:border-gray-600"
                  onClick={() => setAddToSpendingOpen(true)}
                  disabled={!hasFundsToDraw}
                >
                  <Wallet className="w-3.5 h-3.5" />
                  Add to Spending
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-1.5 border border-gray-300 dark:border-gray-600"
                  onClick={() => setEditCycleOpen(true)}
                >
                  <Settings className="w-3.5 h-3.5" />
                  Edit Cycle
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-1.5 border border-gray-300 dark:border-gray-600"
                  onClick={() => setEndCycleOpen(true)}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  End Cycle
                </Button>
              </div>
            </details>
          </Card>
        </div>

      </div>{/* end 2-col grid */}

      {/* Log Spending Modal */}
      <LogSpendingModal
        isOpen={logSpendingOpen}
        onClose={() => setLogSpendingOpen(false)}
        cycleId={cycle.id}
        currentSpent={cycle.totalSpent - (cycle.variableObligationsSpent || 0)}
        totalSpentInCycle={cycle.totalSpent}
        spendingLimit={cycle.spendingLimit}
        variableObligations={cycle.variableObligations || []}
        variableObligationsSpent={cycle.variableObligationsSpent || 0}
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

      {/* Add to Cycle Spending Modal */}
      <AddToCycleSpendingModal
        isOpen={addToSpendingOpen}
        onClose={() => setAddToSpendingOpen(false)}
        cycleId={cycle.id}
        bufferBalance={buffer?.totalAmount || 0}
        emergencyFundBalance={emergencyFundBalance}
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
