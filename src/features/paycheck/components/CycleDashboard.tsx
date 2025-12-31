import { useEffect, useMemo, useState } from 'react';
import {
  Wallet,
  Calendar,
  TrendingDown,
  PiggyBank,
  AlertCircle,
  ChevronRight,
  Plus,
  Receipt,
  Shield,
  Pencil,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { fetchActiveCycle } from '../paycheckCyclesSlice';
import { fetchTransactionsByCycle } from '../spendingTransactionsSlice';
import { fetchBuffer } from '../bufferSlice';
import { fetchPaymentMethods } from '../paymentMethodsSlice';
import { fetchSpendingTags } from '../spendingTagsSlice';
import { AppLayout } from '../../../components/layout';
import { Card, CardHeader, Button, ProgressBar, Badge } from '../../../components/shared';
import { formatCurrency } from '../../../utils/currency';
import { StartCycleWizard } from './StartCycleWizard';
import { CycleBillsList } from './CycleBillsList';
import { SpendingSummary } from './SpendingSummary';
import { LogSpendingModal } from './LogSpendingModal';
import { EndCycleModal } from './EndCycleModal';
import { MarkBillPaidModal } from './MarkBillPaidModal';
import { BufferWithdrawModal } from './BufferWithdrawModal';
import { EditPaycheckModal } from './EditPaycheckModal';
import { PaycheckCycle } from '../../../types';

export const CycleDashboard = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { byId: cyclesById, activeCycleId, isLoading } = useAppSelector(
    (state) => state.paycheckCycles
  );
  const { buffer } = useAppSelector((state) => state.buffer);
  const { data: settings } = useAppSelector((state) => state.settings);

  const activeCycle = activeCycleId ? cyclesById[activeCycleId] : null;

  useEffect(() => {
    if (user) {
      dispatch(fetchActiveCycle(user.uid));
      dispatch(fetchBuffer(user.uid));
    }
  }, [dispatch, user]);

  useEffect(() => {
    if (user && activeCycleId) {
      dispatch(fetchTransactionsByCycle({ userId: user.uid, cycleId: activeCycleId }));
    }
  }, [dispatch, user, activeCycleId]);

  // If no active cycle, show the start wizard
  if (!activeCycle && !isLoading) {
    return (
      <AppLayout title="Paycheck Budget">
        <StartCycleWizard />
      </AppLayout>
    );
  }

  if (isLoading || !activeCycle) {
    return (
      <AppLayout title="Paycheck Budget">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
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
  const { data: settings } = useAppSelector((state) => state.settings);
  const [logSpendingOpen, setLogSpendingOpen] = useState(false);
  const [endCycleOpen, setEndCycleOpen] = useState(false);
  const [markBillPaidOpen, setMarkBillPaidOpen] = useState(false);
  const [useBufferOpen, setUseBufferOpen] = useState(false);
  const [editPaycheckOpen, setEditPaycheckOpen] = useState(false);

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
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
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

  const formatDateRange = (start: Date, end: Date) => {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
  };

  return (
    <div className="space-y-6">
      {/* Spending Alert if over budget or low */}
      {spendingProgress.isOverBudget && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-800">Over Spending Limit</p>
            <p className="text-sm text-red-600">
              You've spent ${Math.abs(cycle.remainingToSpend).toFixed(2)} more than your limit.
              Consider using your buffer if needed.
            </p>
          </div>
        </div>
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Remaining to Spend */}
        <Card className={spendingProgress.isOverBudget ? 'ring-2 ring-red-200' : ''}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Remaining to Spend</p>
              <p
                className={`text-3xl font-bold ${
                  spendingProgress.isOverBudget ? 'text-red-600' : 'text-green-600'
                }`}
              >
                {formatCurrency(Math.max(0, cycle.remainingToSpend))}
              </p>
              {cycleProgress.daysRemaining > 0 && !spendingProgress.isOverBudget && (
                <p className="text-xs text-gray-500 mt-1">
                  ~{formatCurrency(spendingProgress.dailyBudget)}/day
                </p>
              )}
            </div>
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center ${
                spendingProgress.isOverBudget ? 'bg-red-100' : 'bg-green-100'
              }`}
            >
              <Wallet
                className={`w-6 h-6 ${
                  spendingProgress.isOverBudget ? 'text-red-600' : 'text-green-600'
                }`}
              />
            </div>
          </div>
        </Card>

        {/* Total Spent */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Spent This Cycle</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(cycle.totalSpent)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                of {formatCurrency(cycle.spendingLimit)} limit
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </Card>

        {/* Bills Reserved */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Bills Reserved</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(cycle.billsTotal)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {cycle.bills.filter((b) => b.isPaid).length}/{cycle.bills.length} paid
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Receipt className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        {/* Minimum Save */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Saving This Cycle</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(cycle.minimumSave)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Buffer: {formatCurrency(buffer?.totalAmount || 0)}
              </p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
              <PiggyBank className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Spending Progress */}
      <Card>
        <CardHeader
          title="Spending Progress"
          subtitle={`${cycleProgress.daysRemaining} days remaining in this cycle`}
        />
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">
                Spent: {formatCurrency(cycle.totalSpent)}
              </span>
              <span className="text-gray-600">
                Limit: {formatCurrency(cycle.spendingLimit)}
              </span>
            </div>
            <ProgressBar
              value={Math.min(spendingProgress.percent, 100)}
              size="lg"
              isOverBudget={spendingProgress.isOverBudget}
              showLabel
            />
          </div>

          {/* Cycle Timeline */}
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
              <span>{cycle.startDate.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              <span>{cycle.endDate.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all"
                style={{ width: `${cycleProgress.percentComplete}%` }}
              />
            </div>
            <p className="text-center text-xs text-gray-500 mt-2">
              Day {cycleProgress.daysElapsed} of {cycleProgress.totalDays}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bills Due */}
        <CycleBillsList bills={cycle.bills} />

        {/* Recent Spending */}
        <SpendingSummary cycleId={cycle.id} />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader title="Quick Actions" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
          <h3 className="text-lg font-semibold text-gray-900">Paycheck Breakdown</h3>
          <button
            onClick={() => setEditPaycheckOpen(true)}
            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            title="Edit paycheck amount"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-600">Paycheck Amount</span>
            <span className="font-semibold text-gray-900">
              {formatCurrency(cycle.paycheckAmount)}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 text-red-600">
            <span>− Bills Reserved</span>
            <span>−{formatCurrency(cycle.billsTotal)}</span>
          </div>
          <div className="flex justify-between items-center py-2 text-blue-600">
            <span>− Minimum Save</span>
            <span>−{formatCurrency(cycle.minimumSave)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-t border-gray-200 font-semibold">
            <span className="text-gray-900">= Spending Limit</span>
            <span className="text-green-600">{formatCurrency(cycle.spendingLimit)}</span>
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
    </div>
  );
};
