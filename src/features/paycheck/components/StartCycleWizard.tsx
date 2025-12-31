import { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  Calendar,
  Receipt,
  PiggyBank,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { fetchBills } from '../billsSlice';
import { createPaycheckCycle } from '../paycheckCyclesSlice';
import { Card, CardHeader, Button, Input } from '../../../components/shared';
import { formatCurrency } from '../../../utils/currency';
import { Bill, CycleBillEntry, CycleStatus } from '../../../types';

type WizardStep = 'paycheck' | 'bills' | 'savings' | 'review';

const STEPS: { id: WizardStep; title: string; icon: typeof Wallet }[] = [
  { id: 'paycheck', title: 'Paycheck', icon: Wallet },
  { id: 'bills', title: 'Bills', icon: Receipt },
  { id: 'savings', title: 'Savings', icon: PiggyBank },
  { id: 'review', title: 'Review', icon: Check },
];

export const StartCycleWizard = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { byId: billsById, allIds: billIds } = useAppSelector((state) => state.bills);
  const { data: settings } = useAppSelector((state) => state.settings);

  const [currentStep, setCurrentStep] = useState<WizardStep>('paycheck');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [paycheckAmount, setPaycheckAmount] = useState('');
  const [cycleStartDate, setCycleStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [cycleEndDate, setCycleEndDate] = useState('');
  const [selectedBills, setSelectedBills] = useState<Record<string, { selected: boolean; amount: number }>>({});
  const [minimumSave, setMinimumSave] = useState(50);

  // Load bills
  useEffect(() => {
    if (user) {
      dispatch(fetchBills(user.uid));
    }
  }, [dispatch, user]);

  // Initialize selected bills
  useEffect(() => {
    const initial: Record<string, { selected: boolean; amount: number }> = {};
    billIds.forEach((id) => {
      const bill = billsById[id];
      if (bill && bill.isActive) {
        initial[id] = { selected: true, amount: bill.amount };
      }
    });
    setSelectedBills(initial);
  }, [billIds, billsById]);

  // Calculate default end date (14 days from start for bi-weekly)
  useEffect(() => {
    if (cycleStartDate) {
      const start = new Date(cycleStartDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 13); // 14 days including start
      setCycleEndDate(end.toISOString().split('T')[0]);
    }
  }, [cycleStartDate]);

  const activeBills = useMemo(() => {
    return billIds.map((id) => billsById[id]).filter((b) => b && b.isActive);
  }, [billIds, billsById]);

  const billsTotal = useMemo(() => {
    return Object.entries(selectedBills)
      .filter(([_, { selected }]) => selected)
      .reduce((sum, [_, { amount }]) => sum + amount, 0);
  }, [selectedBills]);

  const spendingLimit = useMemo(() => {
    const paycheck = parseFloat(paycheckAmount) || 0;
    return Math.max(0, paycheck - billsTotal - minimumSave);
  }, [paycheckAmount, billsTotal, minimumSave]);

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 'paycheck':
        return parseFloat(paycheckAmount) > 0 && cycleStartDate && cycleEndDate;
      case 'bills':
        return true; // Can skip bills
      case 'savings':
        return minimumSave >= 0;
      case 'review':
        return spendingLimit >= 0;
      default:
        return false;
    }
  }, [currentStep, paycheckAmount, cycleStartDate, cycleEndDate, minimumSave, spendingLimit]);

  const handleNext = () => {
    const stepIndex = STEPS.findIndex((s) => s.id === currentStep);
    if (stepIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[stepIndex + 1].id);
    }
  };

  const handleBack = () => {
    const stepIndex = STEPS.findIndex((s) => s.id === currentStep);
    if (stepIndex > 0) {
      setCurrentStep(STEPS[stepIndex - 1].id);
    }
  };

  const handleBillToggle = (billId: string) => {
    setSelectedBills((prev) => ({
      ...prev,
      [billId]: { ...prev[billId], selected: !prev[billId]?.selected },
    }));
  };

  const handleBillAmountChange = (billId: string, amount: number) => {
    setSelectedBills((prev) => ({
      ...prev,
      [billId]: { ...prev[billId], amount },
    }));
  };

  const handleSubmit = async () => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      const startDate = new Date(cycleStartDate);
      const endDate = new Date(cycleEndDate);

      // Build cycle bills
      const cycleBills: CycleBillEntry[] = Object.entries(selectedBills)
        .filter(([_, { selected }]) => selected)
        .map(([billId, { amount }]) => {
          const bill = billsById[billId];
          const dueDay = bill?.dueDay || 1;
          const actualDueDate = calculateBillDueDate(dueDay, startDate, endDate);
          return {
            billId,
            billName: bill?.name || 'Unknown',
            amount,
            dueDate: Timestamp.fromDate(actualDueDate),
            isPaid: false,
            isDeferred: false,
          };
        });

      const cycle = {
        startDate: Timestamp.fromDate(startDate),
        endDate: Timestamp.fromDate(endDate),
        paycheckAmount: parseFloat(paycheckAmount),
        bills: cycleBills,
        billsTotal,
        minimumSave,
        actualSaved: 0,
        spendingLimit,
        totalSpent: 0,
        remainingToSpend: spendingLimit,
        bufferContribution: 0,
        status: 'active' as CycleStatus,
      };

      await dispatch(createPaycheckCycle({ userId: user.uid, cycle })).unwrap();
    } catch (error) {
      console.error('Failed to create cycle:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Calendar className="w-8 h-8 text-indigo-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Start a New Paycheck Cycle</h1>
        <p className="text-gray-500 mt-2">
          Set up your budget for the next pay period
        </p>
      </div>

      {/* Step Indicators */}
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full ${
                index <= currentStepIndex
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {index < currentStepIndex ? (
                <Check className="w-5 h-5" />
              ) : (
                <step.icon className="w-5 h-5" />
              )}
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={`w-full h-1 mx-2 ${
                  index < currentStepIndex ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
                style={{ width: '60px' }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        {currentStep === 'paycheck' && (
          <div className="space-y-6">
            <CardHeader
              title="Enter Your Paycheck"
              subtitle="How much did you receive this pay period?"
            />
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Paycheck Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={paycheckAmount}
                    onChange={(e) => setPaycheckAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-3 text-2xl font-semibold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Cycle Start Date"
                  type="date"
                  value={cycleStartDate}
                  onChange={(e) => setCycleStartDate(e.target.value)}
                />
                <Input
                  label="Cycle End Date"
                  type="date"
                  value={cycleEndDate}
                  onChange={(e) => setCycleEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {currentStep === 'bills' && (
          <div className="space-y-6">
            <CardHeader
              title="Bills Due This Cycle"
              subtitle="Select which bills are due before your next paycheck"
            />
            {activeBills.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Receipt className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No bills set up yet.</p>
                <p className="text-sm">You can add bills in Settings later.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeBills.map((bill) => (
                  <div
                    key={bill.id}
                    className={`p-4 rounded-lg border-2 transition-colors ${
                      selectedBills[bill.id]?.selected
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-3 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={selectedBills[bill.id]?.selected || false}
                          onChange={() => handleBillToggle(bill.id)}
                          className="w-5 h-5 text-indigo-600 rounded"
                        />
                        <div>
                          <span className="font-medium text-gray-900">{bill.name}</span>
                          <span className="text-xs text-gray-500 ml-2">
                            Due: {bill.dueDay}
                            {getOrdinalSuffix(bill.dueDay)}
                          </span>
                        </div>
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">$</span>
                        <input
                          type="number"
                          value={selectedBills[bill.id]?.amount || bill.amount}
                          onChange={(e) =>
                            handleBillAmountChange(bill.id, parseFloat(e.target.value) || 0)
                          }
                          disabled={!selectedBills[bill.id]?.selected}
                          className="w-24 px-3 py-1 text-right border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="pt-4 border-t flex justify-between items-center">
              <span className="text-gray-600">Total Bills Reserved</span>
              <span className="text-xl font-bold text-gray-900">
                {formatCurrency(billsTotal)}
              </span>
            </div>
          </div>
        )}

        {currentStep === 'savings' && (
          <div className="space-y-6">
            <CardHeader
              title="Set Your Savings"
              subtitle="How much do you want to save this cycle?"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minimum to Save
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  value={minimumSave}
                  onChange={(e) => setMinimumSave(parseFloat(e.target.value) || 0)}
                  min="0"
                  step="10"
                  className="w-full pl-8 pr-4 py-3 text-xl font-semibold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <p className="text-sm text-gray-500 mt-2">
                This amount will be set aside before calculating your spending limit.
                You can set it to $0 if needed.
              </p>
            </div>

            <div className="p-4 bg-emerald-50 rounded-lg">
              <div className="flex items-center gap-2 text-emerald-800">
                <PiggyBank className="w-5 h-5" />
                <span className="font-medium">Savings Tip</span>
              </div>
              <p className="text-sm text-emerald-700 mt-1">
                Even saving $25 per paycheck adds up to $650/year!
              </p>
            </div>
          </div>
        )}

        {currentStep === 'review' && (
          <div className="space-y-6">
            <CardHeader
              title="Review Your Cycle"
              subtitle="Make sure everything looks correct"
            />

            {spendingLimit < 0 && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">Spending limit is negative!</p>
                  <p className="text-sm text-red-600">
                    Your bills and savings exceed your paycheck. Go back and adjust.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Paycheck</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(parseFloat(paycheckAmount) || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center text-red-600">
                <span>− Bills Reserved ({Object.values(selectedBills).filter((b) => b.selected).length})</span>
                <span>−{formatCurrency(billsTotal)}</span>
              </div>
              <div className="flex justify-between items-center text-blue-600">
                <span>− Savings</span>
                <span>−{formatCurrency(minimumSave)}</span>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-gray-300">
                <span className="font-semibold text-gray-900">= Your Spending Limit</span>
                <span
                  className={`text-2xl font-bold ${
                    spendingLimit >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {formatCurrency(spendingLimit)}
                </span>
              </div>
            </div>

            <div className="text-sm text-gray-500 text-center">
              Cycle: {new Date(cycleStartDate).toLocaleDateString()} -{' '}
              {new Date(cycleEndDate).toLocaleDateString()}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-6 border-t">
          <Button
            variant="secondary"
            onClick={handleBack}
            disabled={currentStepIndex === 0}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </Button>

          {currentStep === 'review' ? (
            <Button
              onClick={handleSubmit}
              isLoading={isSubmitting}
              disabled={!canProceed || spendingLimit < 0}
              className="flex items-center gap-2"
            >
              Start Cycle
              <Check className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={!canProceed}
              className="flex items-center gap-2"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

// Calculate the actual due date for a bill within a cycle
function calculateBillDueDate(dueDay: number, cycleStart: Date, cycleEnd: Date): Date {
  // Try the due day in the start month first
  const startMonth = cycleStart.getMonth();
  const startYear = cycleStart.getFullYear();

  // Get the last day of the start month
  const lastDayOfStartMonth = new Date(startYear, startMonth + 1, 0).getDate();
  const effectiveDueDay = Math.min(dueDay, lastDayOfStartMonth);

  let dueDate = new Date(startYear, startMonth, effectiveDueDay);

  // If the due date is within the cycle, use it
  if (dueDate >= cycleStart && dueDate <= cycleEnd) {
    return dueDate;
  }

  // If the due date is before the cycle start, try next month
  if (dueDate < cycleStart) {
    const nextMonth = startMonth + 1;
    const nextYear = nextMonth > 11 ? startYear + 1 : startYear;
    const actualNextMonth = nextMonth % 12;

    const lastDayOfNextMonth = new Date(nextYear, actualNextMonth + 1, 0).getDate();
    const effectiveDueDayNext = Math.min(dueDay, lastDayOfNextMonth);

    dueDate = new Date(nextYear, actualNextMonth, effectiveDueDayNext);
  }

  // Clamp to cycle end if still outside range
  if (dueDate > cycleEnd) {
    return cycleEnd;
  }

  return dueDate;
}
