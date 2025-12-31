import { useState, useMemo, ChangeEvent } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { Modal, Button, Input, Spinner } from '../../../components/shared';
import { completeCycle } from '../paycheckCyclesSlice';
import { addToBuffer } from '../bufferSlice';
import { formatCurrency } from '../../../utils';
import { PaycheckCycle } from '../../../types';
import {
  CheckCircle,
  PiggyBank,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  ArrowRight,
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

  const [step, setStep] = useState<Step>('summary');
  const [bufferAmount, setBufferAmount] = useState('');
  const [reflection, setReflection] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleComplete = async () => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      const bufferContribution = parseFloat(bufferAmount) || 0;
      const actualSaved = cycle.minimumSave + bufferContribution;

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

      // If contributing to buffer, add it
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
    setReflection('');
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
          <div className="space-y-6">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-green-900">Add to Your Buffer</h4>
                  <p className="text-sm text-green-700">
                    {summary.isUnderBudget
                      ? `You have ${formatCurrency(summary.leftover)} leftover. Consider adding some or all to your emergency buffer.`
                      : 'Even though you went over budget, you can still contribute to your buffer if you have extra funds.'}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Amount to Add to Buffer
                </label>
                {suggestedBufferAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => setBufferAmount(suggestedBufferAmount.toString())}
                    className="text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    Add all ({formatCurrency(suggestedBufferAmount)})
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
              <p className="text-gray-500 text-sm mt-1">
                Current buffer: {formatCurrency(buffer?.totalAmount || 0)}
                {parseFloat(bufferAmount) > 0 && (
                  <span className="text-green-600">
                    {' → '}
                    {formatCurrency((buffer?.totalAmount || 0) + parseFloat(bufferAmount))}
                  </span>
                )}
              </p>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="secondary" onClick={() => setStep('summary')}>
                Back
              </Button>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setBufferAmount('0');
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
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-purple-900">Reflect on This Cycle</h4>
                  <p className="text-sm text-purple-700">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-gray-400"
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
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Buffer Contribution</span>
                <span className="font-medium text-green-600">
                  +{formatCurrency(parseFloat(bufferAmount) || 0)}
                </span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                <span className="text-gray-900 font-medium">Total Saved</span>
                <span className="font-bold text-green-600">
                  {formatCurrency(cycle.minimumSave + (parseFloat(bufferAmount) || 0))}
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
              <span className="font-bold text-green-600">
                {formatCurrency(cycle.minimumSave + (parseFloat(bufferAmount) || 0))}
              </span>{' '}
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
        return 'End Cycle: Buffer Contribution';
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
