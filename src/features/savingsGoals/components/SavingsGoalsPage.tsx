import { useEffect, useState, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { AppLayout } from '../../../components/layout';
import { Card, CardHeader, Button, Spinner, ProgressBar } from '../../../components/shared';
import {
  fetchSavingsGoals,
  createSavingsGoal,
  deleteSavingsGoal,
  depositToSavingsGoal,
  withdrawFromSavingsGoal,
  fetchSavingsGoalTransactions,
} from '../savingsGoalsSlice';
import { CreateGoalModal } from './CreateGoalModal';
import { GoalTransactionModal } from './GoalTransactionModal';
import { formatCurrency } from '../../../utils';
import {
  Target,
  Plus,
  Minus,
  TrendingUp,
  Trash2,
  Calendar,
} from 'lucide-react';

export const SavingsGoalsPage = () => {
  return (
    <AppLayout title="Savings Goals">
      <SavingsGoalsContent />
    </AppLayout>
  );
};

const SavingsGoalsContent = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { goals, transactions, status } = useAppSelector((state) => state.savingsGoals);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [transactionModal, setTransactionModal] = useState<{
    goalId: string;
    goalName: string;
    type: 'deposit' | 'withdrawal';
    currentBalance: number;
  } | null>(null);
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      dispatch(fetchSavingsGoals(user.uid));
      dispatch(fetchSavingsGoalTransactions({ userId: user.uid }));
    }
  }, [dispatch, user]);

  const activeGoals = useMemo(() => {
    return goals.allIds.map((id) => goals.byId[id]).filter((g) => g && g.isActive);
  }, [goals]);

  const totalSaved = useMemo(() => {
    return activeGoals.reduce((sum, goal) => sum + goal.currentBalance, 0);
  }, [activeGoals]);

  const handleCreateGoal = async (name: string, targetAmount?: number) => {
    if (!user) return;
    await dispatch(
      createSavingsGoal({
        userId: user.uid,
        goal: { name, targetAmount, currentBalance: 0, isActive: true },
      })
    ).unwrap();
  };

  const handleDeposit = async (amount: number, description: string) => {
    if (!user || !transactionModal) return;
    await dispatch(
      depositToSavingsGoal({
        userId: user.uid,
        goalId: transactionModal.goalId,
        amount,
        description,
        cycleId: null,
      })
    ).unwrap();
  };

  const handleWithdraw = async (amount: number, description: string) => {
    if (!user || !transactionModal) return;
    await dispatch(
      withdrawFromSavingsGoal({
        userId: user.uid,
        goalId: transactionModal.goalId,
        amount,
        description,
        cycleId: null,
      })
    ).unwrap();
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!user) return;
    if (confirm('Are you sure you want to delete this savings goal? This cannot be undone.')) {
      await dispatch(deleteSavingsGoal({ userId: user.uid, goalId })).unwrap();
    }
  };

  const getGoalTransactions = (goalId: string) => {
    return transactions.allIds
      .map((id) => transactions.byId[id])
      .filter((tx) => tx && tx.goalId === goalId);
  };

  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Target className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h3 className="font-semibold text-indigo-900 dark:text-indigo-100">Savings Goals</h3>
              <p className="text-sm text-indigo-700 dark:text-indigo-300">
                {activeGoals.length} active goal{activeGoals.length !== 1 ? 's' : ''} &middot; {formatCurrency(totalSaved)} total saved
              </p>
            </div>
          </div>
          <Button onClick={() => setCreateModalOpen(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Goal
          </Button>
        </div>
      </div>

      {/* Goals List */}
      {activeGoals.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Target className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No savings goals yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4 max-w-sm mx-auto">
              Create your first savings goal to start tracking progress toward things that matter.
            </p>
            <Button onClick={() => setCreateModalOpen(true)} className="inline-flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create Your First Goal
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {activeGoals.map((goal) => {
            const progress = goal.targetAmount
              ? Math.min((goal.currentBalance / goal.targetAmount) * 100, 100)
              : 0;
            const goalTransactions = getGoalTransactions(goal.id);
            const isExpanded = expandedGoalId === goal.id;

            return (
              <Card key={goal.id}>
                <div className="p-4 md:p-6">
                  {/* Goal header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
                        <Target className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                          {goal.name}
                        </h4>
                        {goal.targetAmount && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Target: {formatCurrency(goal.targetAmount)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                        {formatCurrency(goal.currentBalance)}
                      </p>
                      {goal.targetAmount && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {formatCurrency(Math.max(0, goal.targetAmount - goal.currentBalance))} to go
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  {goal.targetAmount && (
                    <div className="mb-4">
                      <div className="relative h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500 rounded-full"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                        {progress.toFixed(0)}%
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        setTransactionModal({
                          goalId: goal.id,
                          goalName: goal.name,
                          type: 'deposit',
                          currentBalance: goal.currentBalance,
                        })
                      }
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setTransactionModal({
                          goalId: goal.id,
                          goalName: goal.name,
                          type: 'withdrawal',
                          currentBalance: goal.currentBalance,
                        })
                      }
                      disabled={goal.currentBalance <= 0}
                    >
                      <Minus className="w-3 h-3 mr-1" />
                      Withdraw
                    </Button>
                    <button
                      onClick={() => setExpandedGoalId(isExpanded ? null : goal.id)}
                      className="ml-auto text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {isExpanded ? 'Hide' : 'Show'} history
                    </button>
                    <button
                      onClick={() => handleDeleteGoal(goal.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      title="Delete goal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Transaction history (expanded) */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      {goalTransactions.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                          No transactions yet
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {goalTransactions.slice(0, 10).map((tx) => (
                            <div
                              key={tx.id}
                              className="flex items-center justify-between py-2"
                            >
                              <div className="flex items-center gap-2">
                                {tx.type === 'deposit' ? (
                                  <TrendingUp className="w-3 h-3 text-green-500" />
                                ) : (
                                  <Minus className="w-3 h-3 text-orange-500" />
                                )}
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                  {tx.description}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span
                                  className={`text-sm font-medium ${
                                    tx.type === 'deposit'
                                      ? 'text-green-600 dark:text-green-400'
                                      : 'text-orange-600 dark:text-orange-400'
                                  }`}
                                >
                                  {tx.type === 'deposit' ? '+' : '-'}
                                  {formatCurrency(tx.amount)}
                                </span>
                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                  {tx.createdAt.toDate().toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <CreateGoalModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={handleCreateGoal}
      />

      {transactionModal && (
        <GoalTransactionModal
          isOpen={!!transactionModal}
          onClose={() => setTransactionModal(null)}
          type={transactionModal.type}
          goalName={transactionModal.goalName}
          currentBalance={transactionModal.currentBalance}
          onSubmit={transactionModal.type === 'deposit' ? handleDeposit : handleWithdraw}
        />
      )}
    </div>
  );
};
