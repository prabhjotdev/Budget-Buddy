import { useEffect, useState, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { AppLayout } from '../../../components/layout';
import { Card, CardHeader, Button, Spinner } from '../../../components/shared';
import {
  fetchEmergencyFund,
  fetchEmergencyFundTransactions,
  addDeposit,
  addWithdrawal,
  updateEmergencyFundGoal,
  deleteTransaction,
} from '../emergencyFundSlice';
import { TransactionModal } from './TransactionModal';
import { GoalModal } from './GoalModal';
import { formatCurrency } from '../../../utils';
import {
  ShieldCheck,
  TrendingUp,
  Plus,
  Minus,
  Target,
  Calendar,
  Trash2,
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

export const EmergencyFundPage = () => {
  return (
    <AppLayout title="Emergency Fund">
      <EmergencyFundContent />
    </AppLayout>
  );
};

const EmergencyFundContent = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { fund, transactions, status } = useAppSelector((state) => state.emergencyFund);
  const { byId: cyclesById, allIds: cycleIds } = useAppSelector(
    (state) => state.paycheckCycles
  );

  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);

  useEffect(() => {
    if (user) {
      dispatch(fetchEmergencyFund(user.uid));
      dispatch(fetchEmergencyFundTransactions(user.uid));
    }
  }, [dispatch, user]);

  // Calculate average monthly spending from last 3 cycles
  const averageMonthlySpending = useMemo(() => {
    if (cycleIds.length === 0) return 0;

    const recentCycles = cycleIds
      .slice(0, 3)
      .map((id) => cyclesById[id])
      .filter(Boolean);

    if (recentCycles.length === 0) return 0;

    const totalSpending = recentCycles.reduce(
      (sum, cycle) => sum + (cycle.totalSpent || 0) + (cycle.billsTotal || 0),
      0
    );

    return totalSpending / recentCycles.length;
  }, [cyclesById, cycleIds]);

  // Calculate months of coverage
  const monthsOfCoverage = useMemo(() => {
    if (!fund || averageMonthlySpending === 0) return 0;
    return fund.currentBalance / averageMonthlySpending;
  }, [fund, averageMonthlySpending]);

  // Calculate progress percentage
  const progressPercentage = useMemo(() => {
    if (!fund || !fund.goalAmount || fund.goalAmount === 0) return 0;
    return Math.min((fund.currentBalance / fund.goalAmount) * 100, 100);
  }, [fund]);

  const handleDeposit = async (amount: number, description: string, date: Timestamp) => {
    if (!user) return;
    await dispatch(addDeposit({ userId: user.uid, amount, description, date })).unwrap();
  };

  const handleWithdrawal = async (amount: number, description: string, date: Timestamp) => {
    if (!user) return;
    await dispatch(addWithdrawal({ userId: user.uid, amount, description, date })).unwrap();
  };

  const handleUpdateGoal = async (goal: {
    goalAmount?: number;
    goalType?: 'fixed' | 'months';
    goalMonths?: number;
  }) => {
    if (!user) return;
    await dispatch(updateEmergencyFundGoal({ userId: user.uid, ...goal })).unwrap();
  };

  const handleDeleteTransaction = async (
    transactionId: string,
    amount: number,
    type: 'deposit' | 'withdrawal'
  ) => {
    if (!user) return;
    if (confirm('Are you sure you want to delete this transaction?')) {
      await dispatch(deleteTransaction({ userId: user.uid, transactionId, amount, type })).unwrap();
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  const currentBalance = fund?.currentBalance || 0;
  const transactionsList = transactions.allIds.map((id) => transactions.byId[id]);

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-green-600 dark:text-green-400" />
          <div>
            <h3 className="font-semibold text-green-900 dark:text-green-100">Emergency Fund</h3>
            <p className="text-sm text-green-700 dark:text-green-300">
              Your safety net for unexpected expenses and financial emergencies
            </p>
          </div>
        </div>
      </div>

      {/* Balance Overview */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-green-100 dark:bg-green-900/50 rounded-full">
              <ShieldCheck className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Current Balance</p>
              <p className="text-4xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(currentBalance)}
              </p>
              {averageMonthlySpending > 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {monthsOfCoverage.toFixed(1)} months of expenses saved
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setDepositModalOpen(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Money
            </Button>
            <Button variant="secondary" onClick={() => setWithdrawModalOpen(true)}>
              <Minus className="w-4 h-4 mr-2" />
              Withdraw
            </Button>
          </div>
        </div>
      </Card>

      {/* Goal Progress (if goal is set) */}
      {fund?.goalAmount && (
        <Card>
          <CardHeader
            title="Goal Progress"
            subtitle={`Target: ${formatCurrency(fund.goalAmount)}${
              fund.goalType === 'months' ? ` (${fund.goalMonths} months)` : ''
            }`}
            action={
              <Button variant="secondary" size="sm" onClick={() => setGoalModalOpen(true)}>
                <Target className="w-4 h-4 mr-2" />
                Edit Goal
              </Button>
            }
          />
          <div className="space-y-3">
            {/* Progress Bar */}
            <div className="relative h-8 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${progressPercentage}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {progressPercentage.toFixed(0)}%
                </span>
              </div>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {formatCurrency(currentBalance)} saved
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                {formatCurrency(Math.max(0, fund.goalAmount - currentBalance))} to go
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Set Goal CTA (if no goal) */}
      {!fund?.goalAmount && (
        <Card className="border-green-200 dark:border-green-800">
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <Target className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                <div>
                  <h4 className="font-medium text-green-900 dark:text-green-300">
                    Set a savings goal
                  </h4>
                  <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                    {cycleIds.length >= 7
                      ? 'Track your progress toward 3-6 months of expenses or a custom amount'
                      : 'Set a custom dollar amount to save'}
                  </p>
                  {cycleIds.length > 0 && cycleIds.length < 7 && (
                    <p className="text-xs text-green-600 dark:text-green-500 mt-2">
                      💡 Complete {7 - cycleIds.length} more cycle{7 - cycleIds.length !== 1 ? 's' : ''} to
                      unlock months-based goals
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() => setGoalModalOpen(true)}
                className="flex-shrink-0"
              >
                Set Goal
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Transaction History */}
      <Card>
        <CardHeader
          title="Transaction History"
          subtitle={`${transactionsList.length} transaction${
            transactionsList.length !== 1 ? 's' : ''
          }`}
        />
        {transactionsList.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No transactions yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Start building your emergency fund today!
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {transactionsList.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-full ${
                      transaction.type === 'deposit'
                        ? 'bg-green-100 dark:bg-green-900/50'
                        : 'bg-orange-100 dark:bg-orange-900/50'
                    }`}
                  >
                    {transaction.type === 'deposit' ? (
                      <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <Minus className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {transaction.description || (transaction.type === 'deposit' ? 'Deposit' : 'Withdrawal')}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {transaction.date.toDate().toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`font-semibold ${
                      transaction.type === 'deposit'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-orange-600 dark:text-orange-400'
                    }`}
                  >
                    {transaction.type === 'deposit' ? '+' : '-'}
                    {formatCurrency(transaction.amount)}
                  </span>
                  <button
                    onClick={() =>
                      handleDeleteTransaction(transaction.id, transaction.amount, transaction.type)
                    }
                    className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    title="Delete transaction"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modals */}
      <TransactionModal
        isOpen={depositModalOpen}
        onClose={() => setDepositModalOpen(false)}
        type="deposit"
        currentBalance={currentBalance}
        onSubmit={handleDeposit}
      />

      <TransactionModal
        isOpen={withdrawModalOpen}
        onClose={() => setWithdrawModalOpen(false)}
        type="withdrawal"
        currentBalance={currentBalance}
        onSubmit={handleWithdrawal}
      />

      <GoalModal
        isOpen={goalModalOpen}
        onClose={() => setGoalModalOpen(false)}
        currentGoal={fund || undefined}
        averageMonthlySpending={averageMonthlySpending}
        cycleCount={cycleIds.length}
        onSubmit={handleUpdateGoal}
      />
    </div>
  );
};
