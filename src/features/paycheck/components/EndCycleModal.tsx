import { useState, useMemo, useEffect, ChangeEvent } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { Modal, Button, Input, Spinner } from '../../../components/shared';
import { completeCycle, updatePaycheckCycle } from '../paycheckCyclesSlice';
import { addToBuffer } from '../bufferSlice';
import { addDeposit, fetchEmergencyFund } from '../../emergencyFund/emergencyFundSlice';
import { depositToSavingsGoal, fetchSavingsGoals } from '../../savingsGoals/savingsGoalsSlice';
import { formatCurrency } from '../../../utils';
import { PaycheckCycle } from '../../../types';
import {
  CheckCircle,
  PiggyBank,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Shield,
  Target,
} from 'lucide-react';

interface EndCycleModalProps {
  isOpen: boolean;
  onClose: () => void;
  cycle: PaycheckCycle;
}

type Step = 'summary' | 'savings' | 'reflection' | 'complete';

export const EndCycleModal = ({ isOpen, onClose, cycle }: EndCycleModalProps) => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { buffer } = useAppSelector((state) => state.buffer);
  const { fund: emergencyFund } = useAppSelector((state) => state.emergencyFund);
  const { goals } = useAppSelector((state) => state.savingsGoals);

  const activeGoals = useMemo(
    () => goals.allIds.map((id) => goals.byId[id]).filter((g) => g.isActive),
    [goals]
  );

  const [step, setStep] = useState<Step>('summary');
  const [bufferAmount, setBufferAmount] = useState('');
  const [emergencyFundAmount, setEmergencyFundAmount] = useState('');
  const [goalAmounts, setGoalAmounts] = useState<Record<string, string>>({});
  const [reflection, setReflection] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [finalSaved, setFinalSaved] = useState(0);

  // Fetch emergency fund and savings goals when modal opens
  useEffect(() => {
    if (isOpen && user) {
      dispatch(fetchEmergencyFund(user.uid));
      dispatch(fetchSavingsGoals(user.uid));
    }
  }, [isOpen, user, dispatch]);

  // Calculate summary data
  const summary = useMemo(() => {
    const leftover = cycle.remainingToSpend;
    const billsPaid = cycle.bills.filter((b) => b.isPaid).length;
    const totalBills = cycle.bills.length;
    const isUnderBudget = leftover >= 0;
    const savedAmount = cycle.minimumSave + (leftover > 0 ? leftover : 0);

    return {
      leftover,
      billsPaid,
      totalBills,
      isUnderBudget,
      savedAmount,
      spentPercentage: Math.round((cycle.totalSpent / cycle.spendingLimit) * 100),
    };
  }, [cycle]);

  const suggestedBufferAmount = summary.leftover > 0 ? summary.leftover : 0;

  const totalAllocated = useMemo(() => {
    const bufferVal = parseFloat(bufferAmount) || 0;
    const efVal = parseFloat(emergencyFundAmount) || 0;
    const goalsVal = Object.values(goalAmounts).reduce(
      (sum, v) => sum + (parseFloat(v) || 0),
      0
    );
    return bufferVal + efVal + goalsVal;
  }, [bufferAmount, emergencyFundAmount, goalAmounts]);

  const remainingToAllocate = Math.max(0, suggestedBufferAmount - totalAllocated);

  const handleComplete = async () => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      const bufferContribution = parseFloat(bufferAmount) || 0;
      const efContribution = parseFloat(emergencyFundAmount) || 0;
      const totalLeftoverAllocated =
        bufferContribution +
        efContribution +
        activeGoals.reduce((sum, g) => sum + (parseFloat(goalAmounts[g.id]) || 0), 0);
      const actualSaved = cycle.minimumSave + totalLeftoverAllocated;

      // Complete the cycle
      await dispatch(
        completeCycle({
          userId: user.uid,
          cycleId: cycle.id,
          actualSaved,
          bufferContribution,
          reflection: reflection.trim() || undefined,
        })
      ).unwrap();

      // Persist the full savingsAllocations breakdown on the cycle document
      const goalAllocations = activeGoals
        .map((g) => ({
          goalId: g.id,
          goalName: g.name,
          amount: parseFloat(goalAmounts[g.id]) || 0,
        }))
        .filter(({ amount }) => amount > 0);

      await dispatch(
        updatePaycheckCycle({
          userId: user.uid,
          cycleId: cycle.id,
          updates: {
            savingsAllocations: {
              buffer: bufferContribution,
              emergencyFund: efContribution,
              goals: goalAllocations,
            },
          },
        })
      ).unwrap();

      // Add to buffer if contributing
      if (bufferContribution > 0) {
        await dispatch(
          addToBuffer({
            userId: user.uid,
            amount: bufferContribution,
            reason: 'Cycle leftover savings',
            cycleId: cycle.id,
          })
        ).unwrap();
      }

      // Add to emergency fund if contributing
      if (efContribution > 0) {
        await dispatch(
          addDeposit({
            userId: user.uid,
            amount: efContribution,
            description: 'Cycle leftover savings',
            date: Timestamp.now(),
          })
        ).unwrap();
      }

      // Add to each savings goal
      for (const { goalId, amount } of goalAllocations) {
        await dispatch(
          depositToSavingsGoal({
            userId: user.uid,
            goalId,
            amount,
            description: 'Cycle leftover savings',
            cycleId: cycle.id,
          })
        ).unwrap();
      }

      setFinalSaved(actualSaved);
      setStep('complete');
    } catch (error) {
      console.error('Failed to complete cycle:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep('summary');
    setBufferAmount('');
    setEmergencyFundAmount('');
    setGoalAmounts({});
    setReflection('');
    setFinalSaved(0);
    onClose();
  };

  const renderStep = () => {
    switch (step) {
      case 'summary':
        return (
          <div className="space-y-6">
            {/* Status Banner */}
            <div
              className={`p-4 rounded-lg flex items-start gap-3 ${
                summary.isUnderBudget
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-amber-50 border border-amber-200'
              }`}
            >
              {summary.isUnderBudget ? (
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0" />
              )}
              <div>
                <h4
                  className={`font-medium ${
                    summary.isUnderBudget ? 'text-green-900' : 'text-amber-900'
                  }`}
                >
                  {summary.isUnderBudget ? 'Great job staying on budget!' : 'You went over budget'}
                </h4>
                <p
                  className={`text-sm ${
                    summary.isUnderBudget ? 'text-green-700' : 'text-amber-700'
                  }`}
                >
                  {summary.isUnderBudget
                    ? `You have ${formatCurrency(summary.leftover)} remaining.`
                    : `You overspent by ${formatCurrency(Math.abs(summary.leftover))}.`}
                </p>
              </div>
            </div>

            {/* Cycle Summary Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Paycheck</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(cycle.paycheckAmount)}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Bills Paid</p>
                <p className="text-xl font-bold text-gray-900">
                  {summary.billsPaid}/{summary.totalBills}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Total Spent</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(cycle.totalSpent)}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Budget Used</p>
                <p className="text-xl font-bold text-gray-900">{summary.spentPercentage}%</p>
              </div>
            </div>

            {/* Minimum Save */}
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PiggyBank className="w-5 h-5 text-blue-600" />
                  <span className="text-blue-900 font-medium">Minimum Save Goal</span>
                </div>
                <span className="text-blue-900 font-bold">
                  {formatCurrency(cycle.minimumSave)}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={() => setStep('savings')}>
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      case 'savings':
        return (
          <div className="space-y-4">
            {/* Header */}
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-green-900">Allocate Your Leftover</h4>
                    <p className="text-sm text-green-700">
                      {summary.isUnderBudget
                        ? `You have ${formatCurrency(summary.leftover)} leftover. Distribute it across your savings destinations.`
                        : 'Even though you went over budget, you can still contribute to your savings.'}
                    </p>
                  </div>
                </div>
                {suggestedBufferAmount > 0 && (
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-green-700">Remaining</p>
                    <p
                      className={`text-sm font-bold ${
                        totalAllocated > suggestedBufferAmount
                          ? 'text-red-600'
                          : 'text-green-800'
                      }`}
                    >
                      {formatCurrency(remainingToAllocate)}
                    </p>
                  </div>
                )}
              </div>
              {totalAllocated > suggestedBufferAmount && (
                <p className="text-xs text-red-600 mt-2">
                  Allocation exceeds leftover amount ({formatCurrency(suggestedBufferAmount)}).
                </p>
              )}
            </div>

            {/* Buffer Card */}
            <div className="p-4 border border-gray-200 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-gray-900">Buffer</span>
                </div>
                {suggestedBufferAmount > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setBufferAmount(
                        (
                          Math.max(0, suggestedBufferAmount - totalAllocated) +
                          (parseFloat(bufferAmount) || 0)
                        ).toFixed(2)
                      )
                    }
                    className="text-xs text-teal-600 hover:text-teal-800"
                  >
                    Add remaining ({formatCurrency(remainingToAllocate + (parseFloat(bufferAmount) || 0))})
                  </button>
                )}
              </div>
              <Input
                type="number"
                placeholder="0.00"
                value={bufferAmount}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setBufferAmount(e.target.value)}
                min="0"
                step="0.01"
              />
              <p className="text-gray-500 text-xs">
                Current: {formatCurrency(buffer?.totalAmount || 0)}
                {parseFloat(bufferAmount) > 0 && (
                  <span className="text-green-600">
                    {' → '}
                    {formatCurrency((buffer?.totalAmount || 0) + parseFloat(bufferAmount))}
                  </span>
                )}
              </p>
            </div>

            {/* Emergency Fund Card */}
            <div className="p-4 border border-gray-200 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-900">Emergency Fund</span>
              </div>
              <Input
                type="number"
                placeholder="0.00"
                value={emergencyFundAmount}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setEmergencyFundAmount(e.target.value)
                }
                min="0"
                step="0.01"
              />
              <p className="text-gray-500 text-xs">
                {emergencyFund
                  ? <>
                      Current: {formatCurrency(emergencyFund.currentBalance)}
                      {parseFloat(emergencyFundAmount) > 0 && (
                        <span className="text-green-600">
                          {' → '}
                          {formatCurrency(
                            emergencyFund.currentBalance + parseFloat(emergencyFundAmount)
                          )}
                        </span>
                      )}
                    </>
                  : 'No emergency fund set up yet — you can still contribute'}
              </p>
            </div>

            {/* Savings Goals */}
            {activeGoals.length > 0 ? (
              activeGoals.map((goal) => (
                <div key={goal.id} className="p-4 border border-gray-200 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-teal-600" />
                    <span className="text-sm font-medium text-gray-900">{goal.name}</span>
                    {goal.targetAmount && (
                      <span className="text-xs text-gray-500 ml-auto">
                        Goal: {formatCurrency(goal.targetAmount)}
                      </span>
                    )}
                  </div>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={goalAmounts[goal.id] || ''}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setGoalAmounts((prev) => ({ ...prev, [goal.id]: e.target.value }))
                    }
                    min="0"
                    step="0.01"
                  />
                  <p className="text-gray-500 text-xs">
                    Current: {formatCurrency(goal.currentBalance)}
                    {parseFloat(goalAmounts[goal.id]) > 0 && (
                      <span className="text-green-600">
                        {' → '}
                        {formatCurrency(goal.currentBalance + parseFloat(goalAmounts[goal.id]))}
                      </span>
                    )}
                  </p>
                </div>
              ))
            ) : (
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-2 text-gray-400">
                  <Target className="w-4 h-4" />
                  <span className="text-sm">No active savings goals</span>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="secondary" onClick={() => setStep('summary')}>
                Back
              </Button>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setBufferAmount('0');
                    setEmergencyFundAmount('0');
                    setGoalAmounts({});
                    setStep('reflection');
                  }}
                >
                  Skip
                </Button>
                <Button onClick={() => setStep('reflection')}>
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        );

      case 'reflection':
        return (
          <div className="space-y-6">
            <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-teal-900">Reflect on This Cycle</h4>
                  <p className="text-sm text-teal-700">
                    Take a moment to note what went well and what you could improve.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quick Reflection (Optional)
              </label>
              <textarea
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="What did you learn this cycle? Any unexpected expenses? Things you'd do differently?"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 placeholder:text-gray-400"
                rows={4}
              />
            </div>

            {/* Final Summary */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-gray-900 mb-3">Cycle Close Summary</h4>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Minimum Save</span>
                <span className="font-medium">{formatCurrency(cycle.minimumSave)}</span>
              </div>
              {(parseFloat(bufferAmount) || 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Buffer Contribution</span>
                  <span className="font-medium text-green-600">
                    +{formatCurrency(parseFloat(bufferAmount) || 0)}
                  </span>
                </div>
              )}
              {(parseFloat(emergencyFundAmount) || 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Emergency Fund</span>
                  <span className="font-medium text-green-600">
                    +{formatCurrency(parseFloat(emergencyFundAmount) || 0)}
                  </span>
                </div>
              )}
              {activeGoals
                .filter((g) => (parseFloat(goalAmounts[g.id]) || 0) > 0)
                .map((g) => (
                  <div key={g.id} className="flex justify-between text-sm">
                    <span className="text-gray-600">{g.name}</span>
                    <span className="font-medium text-green-600">
                      +{formatCurrency(parseFloat(goalAmounts[g.id]) || 0)}
                    </span>
                  </div>
                ))}
              <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                <span className="text-gray-900 font-medium">Total Saved</span>
                <span className="font-bold text-green-600">
                  {formatCurrency(cycle.minimumSave + totalAllocated)}
                </span>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="secondary" onClick={() => setStep('savings')}>
                Back
              </Button>
              <Button onClick={handleComplete} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Closing Cycle...
                  </>
                ) : (
                  <>
                    Close Cycle
                    <CheckCircle className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Cycle Complete!</h3>
            <p className="text-gray-600 mb-6">
              You saved{' '}
              <span className="font-bold text-green-600">{formatCurrency(finalSaved)}</span>{' '}
              this cycle.
            </p>
            <Button onClick={handleClose}>Start New Cycle</Button>
          </div>
        );
    }
  };

  const getTitle = () => {
    switch (step) {
      case 'summary':
        return 'End Cycle: Summary';
      case 'savings':
        return 'End Cycle: Allocate Leftover';
      case 'reflection':
        return 'End Cycle: Reflection';
      case 'complete':
        return 'Cycle Complete';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={getTitle()}>
      {renderStep()}
    </Modal>
  );
};
