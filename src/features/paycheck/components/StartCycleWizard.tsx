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
  Plus,
  CreditCard,
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { fetchBills, createBill } from '../billsSlice';
import { fetchPaymentMethods, createPaymentMethod } from '../paymentMethodsSlice';
import { createPaycheckCycle } from '../paycheckCyclesSlice';
import { Card, CardHeader, Button, Input } from '../../../components/shared';
import { formatCurrency } from '../../../utils/currency';
import { CycleBillEntry, CycleStatus, PaymentMethodType, BillFrequency } from '../../../types';

type WizardStep = 'paycheck' | 'paymentMethods' | 'bills' | 'savings' | 'review';

const STEPS: { id: WizardStep; title: string; icon: typeof Wallet }[] = [
  { id: 'paycheck', title: 'Paycheck', icon: Wallet },
  { id: 'paymentMethods', title: 'Accounts', icon: CreditCard },
  { id: 'bills', title: 'Bills', icon: Receipt },
  { id: 'savings', title: 'Savings', icon: PiggyBank },
  { id: 'review', title: 'Review', icon: Check },
];

export const StartCycleWizard = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { byId: billsById, allIds: billIds } = useAppSelector((state) => state.bills);
  const { byId: paymentMethodsById, allIds: paymentMethodIds } = useAppSelector((state) => state.paymentMethods);

  const [currentStep, setCurrentStep] = useState<WizardStep>('paycheck');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [paycheckAmount, setPaycheckAmount] = useState('');
  const [cycleStartDate, setCycleStartDate] = useState(formatLocalDate(new Date()));
  const [cycleEndDate, setCycleEndDate] = useState('');
  const [selectedBills, setSelectedBills] = useState<Record<string, { selected: boolean; amount: number }>>({});
  const [minimumSave, setMinimumSave] = useState(50);

  // Inline payment method creation state
  const [showAddPaymentMethod, setShowAddPaymentMethod] = useState(false);
  const [newMethodName, setNewMethodName] = useState('');
  const [newMethodType, setNewMethodType] = useState<PaymentMethodType>('debit');
  const [isAddingMethod, setIsAddingMethod] = useState(false);

  // Inline bill creation state
  const [showAddBill, setShowAddBill] = useState(false);
  const [newBillName, setNewBillName] = useState('');
  const [newBillAmount, setNewBillAmount] = useState('');
  const [newBillDueDay, setNewBillDueDay] = useState('1');
  const [newBillFrequency, setNewBillFrequency] = useState<BillFrequency>('monthly');
  const [newBillPaymentMethodId, setNewBillPaymentMethodId] = useState<string | null>(null);
  const [newBillIsVariable, setNewBillIsVariable] = useState(false);
  const [newBillIsAutoPay, setNewBillIsAutoPay] = useState(false);
  const [isAddingBill, setIsAddingBill] = useState(false);

  // Load payment methods and bills
  useEffect(() => {
    if (user) {
      dispatch(fetchPaymentMethods(user.uid));
      dispatch(fetchBills(user.uid));
    }
  }, [dispatch, user]);

  // Calculate default end date (14 days from start for bi-weekly)
  useEffect(() => {
    if (cycleStartDate) {
      const start = parseLocalDate(cycleStartDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 13); // 14 days including start
      setCycleEndDate(formatLocalDate(end));
    }
  }, [cycleStartDate]);

  const activePaymentMethods = useMemo(() => {
    return paymentMethodIds.map((id) => paymentMethodsById[id]).filter((m) => m && m.isActive);
  }, [paymentMethodIds, paymentMethodsById]);

  const activeBills = useMemo(() => {
    return billIds.map((id) => billsById[id]).filter((b) => b && b.isActive);
  }, [billIds, billsById]);

  // Filter bills to only show those due within the selected cycle dates
  const billsDueThisCycle = useMemo(() => {
    if (!cycleStartDate || !cycleEndDate) return activeBills;

    const startDate = parseLocalDate(cycleStartDate);
    const endDate = parseLocalDate(cycleEndDate);

    return activeBills.filter((bill) => {
      // For one-time bills, check if the start date is within the cycle
      if (bill.frequency === 'one-time') {
        if (bill.startDate) {
          const billDate = bill.startDate.toDate();
          return billDate >= startDate && billDate <= endDate;
        }
        return false; // One-time bills without a start date shouldn't show
      }

      // For bi-weekly bills, we need to check if any occurrence falls within the cycle
      if (bill.frequency === 'bi-weekly') {
        // For bi-weekly, use the anchor date or start date to project occurrences
        if (bill.startDate) {
          let currentDate = bill.startDate.toDate();
          // Find occurrences within the cycle
          while (currentDate <= endDate) {
            if (currentDate >= startDate && currentDate <= endDate) {
              return true;
            }
            currentDate = new Date(currentDate);
            currentDate.setDate(currentDate.getDate() + 14);
          }
        }
        return false;
      }

      // For monthly/quarterly/etc bills, check if dueDay falls within cycle
      const dueDate = calculateBillDueDate(bill.dueDay, startDate, endDate);
      return dueDate >= startDate && dueDate <= endDate;
    });
  }, [activeBills, cycleStartDate, cycleEndDate]);

  // Initialize selected bills based on which bills are due this cycle
  useEffect(() => {
    const initial: Record<string, { selected: boolean; amount: number }> = {};
    billsDueThisCycle.forEach((bill) => {
      initial[bill.id] = { selected: true, amount: bill.amount };
    });
    setSelectedBills(initial);
  }, [billsDueThisCycle]);

  const billsTotal = useMemo(() => {
    return Object.values(selectedBills)
      .filter(({ selected }) => selected)
      .reduce((sum, { amount }) => sum + amount, 0);
  }, [selectedBills]);

  const spendingLimit = useMemo(() => {
    const paycheck = parseFloat(paycheckAmount) || 0;
    return Math.max(0, paycheck - billsTotal - minimumSave);
  }, [paycheckAmount, billsTotal, minimumSave]);

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 'paycheck':
        return parseFloat(paycheckAmount) > 0 && cycleStartDate && cycleEndDate;
      case 'paymentMethods':
        return true; // Can skip payment methods
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

  const handleAddPaymentMethod = async () => {
    if (!user || !newMethodName) return;

    setIsAddingMethod(true);
    try {
      await dispatch(
        createPaymentMethod({
          userId: user.uid,
          paymentMethod: {
            name: newMethodName,
            type: newMethodType,
            isActive: true,
            isDefault: activePaymentMethods.length === 0,
            sortOrder: activePaymentMethods.length,
          },
        })
      ).unwrap();

      // Reset form
      setNewMethodName('');
      setNewMethodType('debit');
      setShowAddPaymentMethod(false);
    } catch (error) {
      console.error('Failed to add payment method:', error);
    } finally {
      setIsAddingMethod(false);
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

  const handleAddBill = async () => {
    if (!user || !newBillName || !newBillAmount) return;

    setIsAddingBill(true);
    try {
      const result = await dispatch(
        createBill({
          userId: user.uid,
          bill: {
            name: newBillName,
            amount: parseFloat(newBillAmount),
            dueDay: parseInt(newBillDueDay) || 1,
            isActive: true,
            isVariable: newBillIsVariable,
            frequency: newBillFrequency,
            paymentMethodId: newBillPaymentMethodId,
            isAutoPay: newBillIsAutoPay,
          },
        })
      ).unwrap();

      // Auto-select the new bill
      setSelectedBills((prev) => ({
        ...prev,
        [result.id]: { selected: true, amount: parseFloat(newBillAmount) },
      }));

      // Reset form
      setNewBillName('');
      setNewBillAmount('');
      setNewBillDueDay('1');
      setNewBillFrequency('monthly');
      setNewBillPaymentMethodId(null);
      setNewBillIsVariable(false);
      setNewBillIsAutoPay(false);
      setShowAddBill(false);
    } catch (error) {
      console.error('Failed to add bill:', error);
    } finally {
      setIsAddingBill(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      const startDate = parseLocalDate(cycleStartDate);
      const endDate = parseLocalDate(cycleEndDate);

      // Build cycle bills
      const cycleBills: CycleBillEntry[] = Object.entries(selectedBills)
        .filter((entry) => entry[1].selected)
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

        {currentStep === 'paymentMethods' && (
          <div className="space-y-6">
            <CardHeader
              title="Your Payment Methods"
              subtitle="Add your bank accounts and credit cards"
            />

            {/* Existing payment methods */}
            {activePaymentMethods.length > 0 && (
              <div className="space-y-3">
                {activePaymentMethods.map((method) => (
                  <div
                    key={method.id}
                    className="p-4 rounded-lg border border-gray-200 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        method.type === 'credit' ? 'bg-purple-100' : method.type === 'debit' ? 'bg-blue-100' : 'bg-green-100'
                      }`}>
                        <CreditCard className={`w-5 h-5 ${
                          method.type === 'credit' ? 'text-purple-600' : method.type === 'debit' ? 'text-blue-600' : 'text-green-600'
                        }`} />
                      </div>
                      <div>
                        <span className="font-medium text-gray-900">{method.name}</span>
                        <span className="text-xs text-gray-500 ml-2 capitalize">{method.type}</span>
                      </div>
                    </div>
                    {method.isDefault && (
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">Default</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {activePaymentMethods.length === 0 && !showAddPaymentMethod && (
              <div className="text-center py-8">
                <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 mb-4">No payment methods set up yet.</p>
                <Button onClick={() => setShowAddPaymentMethod(true)} className="inline-flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add Payment Method
                </Button>
              </div>
            )}

            {/* Add payment method form */}
            {showAddPaymentMethod && (
              <div className="p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <h4 className="font-medium text-gray-900 mb-4">Add a Payment Method</h4>
                <div className="space-y-4">
                  <Input
                    label="Name"
                    placeholder="e.g., Chase Checking, Amex Gold"
                    value={newMethodName}
                    onChange={(e) => setNewMethodName(e.target.value)}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['debit', 'credit', 'cash'] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setNewMethodType(type)}
                          className={`p-3 rounded-lg border-2 text-center transition-colors ${
                            newMethodType === type
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                              : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          <span className="capitalize font-medium">{type}</span>
                          <p className="text-xs mt-1">
                            {type === 'debit' && 'Bank account'}
                            {type === 'credit' && 'Credit card'}
                            {type === 'cash' && 'Cash spending'}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={handleAddPaymentMethod}
                      disabled={!newMethodName || isAddingMethod}
                      isLoading={isAddingMethod}
                    >
                      Add
                    </Button>
                    <Button variant="secondary" onClick={() => setShowAddPaymentMethod(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Add another button */}
            {activePaymentMethods.length > 0 && !showAddPaymentMethod && (
              <button
                onClick={() => setShowAddPaymentMethod(true)}
                className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Another Payment Method
              </button>
            )}

            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Tip:</strong> Add the accounts you use to pay bills and make purchases.
                This helps track which payment method each bill uses.
              </p>
            </div>
          </div>
        )}

        {currentStep === 'bills' && (
          <div className="space-y-6">
            <CardHeader
              title="Bills Due This Cycle"
              subtitle="Select which bills are due before your next paycheck"
            />

            {/* Existing bills list */}
            {billsDueThisCycle.length > 0 && (
              <div className="space-y-3">
                {billsDueThisCycle.map((bill) => (
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
                          {bill.paymentMethodId && paymentMethodsById[bill.paymentMethodId] && (
                            <span className="text-xs text-indigo-600 ml-2">
                              via {paymentMethodsById[bill.paymentMethodId].name}
                            </span>
                          )}
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

            {/* Empty state / Add bill prompt */}
            {activeBills.length === 0 && !showAddBill && (
              <div className="text-center py-8">
                <Receipt className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 mb-4">No bills set up yet.</p>
                <Button onClick={() => setShowAddBill(true)} className="inline-flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add Your First Bill
                </Button>
              </div>
            )}

            {/* No bills due this cycle (but user has bills) */}
            {activeBills.length > 0 && billsDueThisCycle.length === 0 && !showAddBill && (
              <div className="text-center py-8">
                <Receipt className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 mb-2">No bills due during this cycle</p>
                <p className="text-sm text-gray-400">
                  ({cycleStartDate} to {cycleEndDate})
                </p>
              </div>
            )}

            {/* Add bill form */}
            {showAddBill && (
              <div className="p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <h4 className="font-medium text-gray-900 mb-4">Add a Bill</h4>
                <div className="space-y-4">
                  <Input
                    label="Bill Name"
                    placeholder="e.g., Rent, Electric, Internet"
                    value={newBillName}
                    onChange={(e) => setNewBillName(e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Amount{newBillIsVariable ? ' (Estimated)' : ''}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          placeholder="0.00"
                          value={newBillAmount}
                          onChange={(e) => setNewBillAmount(e.target.value)}
                          className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Due Day</label>
                      <select
                        value={newBillDueDay}
                        onChange={(e) => setNewBillDueDay(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                          <option key={day} value={day}>
                            {day}{getOrdinalSuffix(day)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                      <select
                        value={newBillFrequency}
                        onChange={(e) => setNewBillFrequency(e.target.value as BillFrequency)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="monthly">Monthly</option>
                        <option value="bi-weekly">Bi-Weekly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="semi-annual">Semi-Annual</option>
                        <option value="annual">Annual</option>
                        <option value="one-time">One-Time</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Paid With</label>
                      <select
                        value={newBillPaymentMethodId || ''}
                        onChange={(e) => setNewBillPaymentMethodId(e.target.value || null)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">None</option>
                        {activePaymentMethods.map((method) => (
                          <option key={method.id} value={method.id}>
                            {method.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newBillIsVariable}
                        onChange={(e) => setNewBillIsVariable(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700">Variable amount (confirm each cycle)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newBillIsAutoPay}
                        onChange={(e) => setNewBillIsAutoPay(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700">Auto-pay enabled</span>
                    </label>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={handleAddBill}
                      disabled={!newBillName || !newBillAmount || isAddingBill}
                      isLoading={isAddingBill}
                    >
                      Add Bill
                    </Button>
                    <Button variant="secondary" onClick={() => setShowAddBill(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Add another bill button (when bills exist) */}
            {billsDueThisCycle.length > 0 && !showAddBill && (
              <button
                onClick={() => setShowAddBill(true)}
                className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Another Bill
              </button>
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
              Cycle: {parseLocalDate(cycleStartDate).toLocaleDateString()} -{' '}
              {parseLocalDate(cycleEndDate).toLocaleDateString()}
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

// Parse a YYYY-MM-DD string as local time instead of UTC
function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Format a Date to YYYY-MM-DD string in local time (not UTC)
function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
