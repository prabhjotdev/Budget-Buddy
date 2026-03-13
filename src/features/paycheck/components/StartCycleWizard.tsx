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
  TrendingDown,
  Info,
  Target,
  ShieldCheck,
  ShoppingCart,
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { fetchBills, createBill } from '../billsSlice';
import { fetchPaymentMethods, createPaymentMethod } from '../paymentMethodsSlice';
import { createPaycheckCycle, fetchPaycheckCycles, updatePaycheckCycle } from '../paycheckCyclesSlice';
import { fetchVariableObligations, createVariableObligation } from '../variableObligationsSlice';
import { fetchBuffer, withdrawFromBuffer, addToBuffer } from '../bufferSlice';
import { fetchSavingsGoals, depositToSavingsGoal, withdrawFromSavingsGoal } from '../../savingsGoals/savingsGoalsSlice';
import { addDeposit as addEmergencyDeposit, addWithdrawal as addEmergencyWithdrawal } from '../../emergencyFund/emergencyFundSlice';
import { Card, CardHeader, Button, Input } from '../../../components/shared';
import { formatCurrency } from '../../../utils/currency';
import { CycleBillEntry, CycleStatus, PaymentMethodType, BillFrequency, PaycheckCycle, UserSettings, CycleVariableObligationEntry } from '../../../types';

type WizardStep = 'paycheck' | 'paymentMethods' | 'bills' | 'variableObligations' | 'savings' | 'allocate' | 'buffer-draw' | 'review';

type BufferDrawOption = 'none' | 'minimum' | 'moderate' | 'comfortable' | 'custom';

const STEPS: { id: WizardStep; title: string; icon: typeof Wallet }[] = [
  { id: 'paycheck', title: 'Paycheck', icon: Wallet },
  { id: 'paymentMethods', title: 'Accounts', icon: CreditCard },
  { id: 'bills', title: 'Bills', icon: Receipt },
  { id: 'variableObligations', title: 'Needs', icon: ShoppingCart },
  { id: 'savings', title: 'Savings', icon: PiggyBank },
  { id: 'allocate', title: 'Allocate', icon: Target },
  { id: 'review', title: 'Review', icon: Check },
];

// Steps for edit mode (skip paymentMethods)
const EDIT_STEPS: { id: WizardStep; title: string; icon: typeof Wallet }[] = [
  { id: 'paycheck', title: 'Paycheck', icon: Wallet },
  { id: 'bills', title: 'Bills', icon: Receipt },
  { id: 'variableObligations', title: 'Needs', icon: ShoppingCart },
  { id: 'savings', title: 'Savings', icon: PiggyBank },
  { id: 'allocate', title: 'Allocate', icon: Target },
  { id: 'review', title: 'Review', icon: Check },
];

interface StartCycleWizardProps {
  editingCycle?: PaycheckCycle;
  onClose?: () => void;
}

export const StartCycleWizard = ({ editingCycle, onClose }: StartCycleWizardProps = {}) => {
  const isEditMode = !!editingCycle;
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { byId: billsById, allIds: billIds } = useAppSelector((state) => state.bills);
  const { byId: paymentMethodsById, allIds: paymentMethodIds } = useAppSelector((state) => state.paymentMethods);
  const { byId: obligationsById, allIds: obligationIds } = useAppSelector((state) => state.variableObligations);
  const { buffer } = useAppSelector((state) => state.buffer);
  const { byId: cyclesById, allIds: cycleIds } = useAppSelector((state) => state.paycheckCycles);
  const { goals: savingsGoalsState } = useAppSelector((state) => state.savingsGoals);
  const { fund: emergencyFund } = useAppSelector((state) => state.emergencyFund);
  const { data: settings } = useAppSelector((state) => state.settings);

  const [currentStep, setCurrentStep] = useState<WizardStep>('paycheck');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [paycheckAmount, setPaycheckAmount] = useState('');
  const [cycleStartDate, setCycleStartDate] = useState(formatLocalDate(new Date()));
  const [cycleEndDate, setCycleEndDate] = useState('');
  const [selectedBills, setSelectedBills] = useState<Record<string, { selected: boolean; amount: number }>>({});
  const [minimumSave, setMinimumSave] = useState(50);

  // Buffer draw state
  const [bufferDrawOption, setBufferDrawOption] = useState<BufferDrawOption>('none');
  const [customBufferDraw, setCustomBufferDraw] = useState(0);

  // Savings allocation state
  const [bufferAllocation, setBufferAllocation] = useState(0);
  const [emergencyFundAllocation, setEmergencyFundAllocation] = useState(0);
  const [goalAllocations, setGoalAllocations] = useState<Record<string, number>>({});

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

  // Variable obligations state: id → { selected, amount }
  const [selectedObligations, setSelectedObligations] = useState<
    Record<string, { selected: boolean; amount: number }>
  >({});

  // Inline obligation creation state
  const [showAddObligation, setShowAddObligation] = useState(false);
  const [newObligationName, setNewObligationName] = useState('');
  const [newObligationAmount, setNewObligationAmount] = useState('');
  const [isAddingObligation, setIsAddingObligation] = useState(false);

  // Load payment methods, bills, buffer, historical cycles, savings goals, and obligations
  useEffect(() => {
    if (user) {
      dispatch(fetchPaymentMethods(user.uid));
      dispatch(fetchBills(user.uid));
      dispatch(fetchBuffer(user.uid));
      dispatch(fetchPaycheckCycles(user.uid));
      dispatch(fetchSavingsGoals(user.uid));
      dispatch(fetchVariableObligations(user.uid));
    }
  }, [dispatch, user]);

  // Calculate default end date based on pay schedule settings - only for new cycles
  useEffect(() => {
    if (cycleStartDate && !isEditMode) {
      const start = parseLocalDate(cycleStartDate);
      let end: Date;
      if (settings?.scheduleType === 'semi-monthly' && settings.semiMonthlyDays) {
        end = getSemiMonthlyEndDate(start, settings.semiMonthlyDays);
      } else {
        end = new Date(start);
        end.setDate(end.getDate() + 13); // 14 days including start
      }
      setCycleEndDate(formatLocalDate(end));
    }
  }, [cycleStartDate, isEditMode, settings?.scheduleType, settings?.semiMonthlyDays]);

  // Pre-populate state when editing an existing cycle
  useEffect(() => {
    if (editingCycle) {
      // Set paycheck amount
      setPaycheckAmount(editingCycle.paycheckAmount.toString());

      // Set dates from existing cycle
      setCycleStartDate(formatLocalDate(editingCycle.startDate.toDate()));
      setCycleEndDate(formatLocalDate(editingCycle.endDate.toDate()));

      // Set savings
      setMinimumSave(editingCycle.minimumSave);

      // Set buffer draw if any
      if (editingCycle.bufferDraw && editingCycle.bufferDraw > 0) {
        setBufferDrawOption('custom');
        setCustomBufferDraw(editingCycle.bufferDraw);
      }

      // Pre-select bills that were in the cycle
      const billSelections: Record<string, { selected: boolean; amount: number }> = {};
      editingCycle.bills.forEach((cycleBill) => {
        billSelections[cycleBill.billId] = {
          selected: true,
          amount: cycleBill.amount,
        };
      });
      setSelectedBills(billSelections);

      // Pre-populate variable obligations from existing cycle
      if (editingCycle.variableObligations) {
        const obligationSelections: Record<string, { selected: boolean; amount: number }> = {};
        editingCycle.variableObligations.forEach((o) => {
          obligationSelections[o.obligationId] = {
            selected: true,
            amount: o.estimatedAmount,
          };
        });
        setSelectedObligations(obligationSelections);
      }

      // Pre-populate savings allocations from existing cycle
      if (editingCycle.savingsAllocations) {
        setBufferAllocation(editingCycle.savingsAllocations.buffer);
        setEmergencyFundAllocation(editingCycle.savingsAllocations.emergencyFund);
        const ga: Record<string, number> = {};
        editingCycle.savingsAllocations.goals.forEach((g) => {
          ga[g.goalId] = g.amount;
        });
        setGoalAllocations(ga);
      }
    }
  }, [editingCycle]);

  // Pre-fill from pay schedule settings for new cycles
  useEffect(() => {
    if (isEditMode || !settings) return;
    if (settings.defaultMinimumSave !== undefined) {
      setMinimumSave(settings.defaultMinimumSave);
    }
    const suggestedStart = getSuggestedStartDate(settings);
    if (suggestedStart) {
      setCycleStartDate(suggestedStart);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.scheduleType, settings?.semiMonthlyDays, settings?.biWeeklyAnchorDate, settings?.defaultMinimumSave, isEditMode]);

  const activePaymentMethods = useMemo(() => {
    return paymentMethodIds.map((id) => paymentMethodsById[id]).filter((m) => m && m.isActive);
  }, [paymentMethodIds, paymentMethodsById]);

  const activeBills = useMemo(() => {
    return billIds.map((id) => billsById[id]).filter((b) => b && b.isActive);
  }, [billIds, billsById]);

  const activeObligations = useMemo(() => {
    return obligationIds.map((id) => obligationsById[id]).filter((o) => o && o.isActive);
  }, [obligationIds, obligationsById]);

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
        // Use startDate if available, otherwise fall back to createdAt (same as BillCalendarPage)
        const anchorSource = bill.startDate ? bill.startDate.toDate() : bill.createdAt.toDate();
        const currentDate = new Date(
          anchorSource.getFullYear(),
          anchorSource.getMonth(),
          anchorSource.getDate()
        );

        // If anchor is before the cycle, advance by 2 weeks until we reach or pass the start
        while (currentDate < startDate) {
          currentDate.setDate(currentDate.getDate() + 14);
        }

        // Check if this occurrence falls within the cycle
        if (currentDate >= startDate && currentDate <= endDate) {
          return true;
        }
        return false;
      }

      // For quarterly/semi-annual/annual bills, anchor to startDate and advance by frequency
      if (
        bill.frequency === 'quarterly' ||
        bill.frequency === 'semi-annual' ||
        bill.frequency === 'annual'
      ) {
        const anchorSource = bill.startDate ? bill.startDate.toDate() : bill.createdAt.toDate();
        const months =
          bill.frequency === 'quarterly' ? 3 : bill.frequency === 'semi-annual' ? 6 : 12;
        const currentDate = new Date(
          anchorSource.getFullYear(),
          anchorSource.getMonth(),
          Math.min(
            bill.dueDay,
            new Date(anchorSource.getFullYear(), anchorSource.getMonth() + 1, 0).getDate()
          )
        );

        // If the first occurrence is already past the cycle end, skip
        if (currentDate > endDate) return false;

        // Advance until we reach or pass the cycle start
        while (currentDate < startDate) {
          currentDate.setMonth(currentDate.getMonth() + months);
        }

        return currentDate >= startDate && currentDate <= endDate;
      }

      // For monthly bills, check if dueDay falls within the cycle
      // We need to check each month that the cycle spans
      const dueDay = bill.dueDay;

      // Check in the start month
      const startMonth = startDate.getMonth();
      const startYear = startDate.getFullYear();
      const lastDayOfStartMonth = new Date(startYear, startMonth + 1, 0).getDate();
      const effectiveDueDayStart = Math.min(dueDay, lastDayOfStartMonth);
      const dueDateInStartMonth = new Date(startYear, startMonth, effectiveDueDayStart);

      if (dueDateInStartMonth >= startDate && dueDateInStartMonth <= endDate) {
        return true;
      }

      // If cycle spans to a different month, check that month too
      const endMonth = endDate.getMonth();
      const endYear = endDate.getFullYear();
      if (endMonth !== startMonth || endYear !== startYear) {
        const lastDayOfEndMonth = new Date(endYear, endMonth + 1, 0).getDate();
        const effectiveDueDayEnd = Math.min(dueDay, lastDayOfEndMonth);
        const dueDateInEndMonth = new Date(endYear, endMonth, effectiveDueDayEnd);

        if (dueDateInEndMonth >= startDate && dueDateInEndMonth <= endDate) {
          return true;
        }
      }

      return false;
    });
  }, [activeBills, cycleStartDate, cycleEndDate]);

  // Helper to get the actual due date for a bill within the cycle
  const getBillDueDateInCycle = (bill: typeof activeBills[0]): number => {
    if (!cycleStartDate || !cycleEndDate) return bill.dueDay;

    const startDate = parseLocalDate(cycleStartDate);
    const endDate = parseLocalDate(cycleEndDate);

    if (bill.frequency === 'bi-weekly') {
      const anchorSource = bill.startDate ? bill.startDate.toDate() : bill.createdAt.toDate();
      const currentDate = new Date(
        anchorSource.getFullYear(),
        anchorSource.getMonth(),
        anchorSource.getDate()
      );

      // Advance to find the occurrence within the cycle
      while (currentDate < startDate) {
        currentDate.setDate(currentDate.getDate() + 14);
      }

      if (currentDate >= startDate && currentDate <= endDate) {
        return currentDate.getDate();
      }
    }

    // For monthly and other frequencies, use dueDay
    return bill.dueDay;
  };

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

  // Auto-select all active obligations for new cycles
  useEffect(() => {
    if (isEditMode) return; // pre-populated from editingCycle
    const initial: Record<string, { selected: boolean; amount: number }> = {};
    activeObligations.forEach((obligation) => {
      // Preserve existing selection if already set
      if (selectedObligations[obligation.id] === undefined) {
        initial[obligation.id] = { selected: true, amount: obligation.estimatedAmount };
      }
    });
    if (Object.keys(initial).length > 0) {
      setSelectedObligations((prev) => ({ ...initial, ...prev }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeObligations, isEditMode]);

  const variableObligationsTotal = useMemo(() => {
    return Object.values(selectedObligations)
      .filter(({ selected }) => selected)
      .reduce((sum, { amount }) => sum + amount, 0);
  }, [selectedObligations]);

  // Raw spending limit before buffer draw
  const rawSpendingLimit = useMemo(() => {
    const paycheck = parseFloat(paycheckAmount) || 0;
    return paycheck - billsTotal - variableObligationsTotal - minimumSave;
  }, [paycheckAmount, billsTotal, variableObligationsTotal, minimumSave]);

  // Calculate the gap (how much we're short by)
  const spendingGap = useMemo(() => {
    return rawSpendingLimit < 0 ? Math.abs(rawSpendingLimit) : 0;
  }, [rawSpendingLimit]);

  // Calculate cycle days for average spending calculation
  const cycleDays = useMemo(() => {
    if (!cycleStartDate || !cycleEndDate) return 14;
    const start = parseLocalDate(cycleStartDate);
    const end = parseLocalDate(cycleEndDate);
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }, [cycleStartDate, cycleEndDate]);

  // Calculate historical average daily spending from completed cycles
  const historicalSpending = useMemo(() => {
    const completedCycles = cycleIds
      .map((id) => cyclesById[id])
      .filter((cycle) => cycle && cycle.status === 'completed' && cycle.totalSpent > 0)
      .slice(0, 5); // Use last 5 completed cycles

    if (completedCycles.length === 0) {
      return { avgDailySpending: 50, totalCycles: 0, hasHistory: false }; // Default fallback
    }

    let totalDays = 0;
    let totalSpent = 0;

    completedCycles.forEach((cycle) => {
      const start = cycle.startDate.toDate();
      const end = cycle.endDate.toDate();
      const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      totalDays += days;
      totalSpent += cycle.totalSpent;
    });

    const avgDailySpending = totalDays > 0 ? totalSpent / totalDays : 50;

    return {
      avgDailySpending: Math.round(avgDailySpending * 100) / 100,
      totalCycles: completedCycles.length,
      hasHistory: true,
    };
  }, [cycleIds, cyclesById]);

  // Buffer availability
  const bufferBalance = buffer?.totalAmount || 0;

  // Active savings goals
  const activeSavingsGoals = useMemo(() => {
    return savingsGoalsState.allIds
      .map((id) => savingsGoalsState.byId[id])
      .filter((g) => g && g.isActive);
  }, [savingsGoalsState]);

  // Total allocated savings
  const totalAllocated = useMemo(() => {
    const goalsTotal = Object.values(goalAllocations).reduce((sum, amt) => sum + amt, 0);
    return Math.round((bufferAllocation + emergencyFundAllocation + goalsTotal) * 100) / 100;
  }, [bufferAllocation, emergencyFundAllocation, goalAllocations]);

  // Calculate tiered buffer draw options
  const bufferDrawOptions = useMemo(() => {
    const estimatedSpending = historicalSpending.avgDailySpending * cycleDays;

    // Minimum: Just cover the bill gap (bring to $0)
    const minimum = spendingGap;

    // Moderate: Gap + 50% of estimated spending
    const moderate = spendingGap + (estimatedSpending * 0.5);

    // Comfortable: Gap + 100% of estimated spending
    const comfortable = spendingGap + estimatedSpending;

    return {
      minimum: Math.round(minimum * 100) / 100,
      moderate: Math.round(moderate * 100) / 100,
      comfortable: Math.round(comfortable * 100) / 100,
      estimatedSpending: Math.round(estimatedSpending * 100) / 100,
    };
  }, [spendingGap, historicalSpending.avgDailySpending, cycleDays]);

  // Get the actual buffer draw amount based on selection
  const selectedBufferDraw = useMemo(() => {
    switch (bufferDrawOption) {
      case 'minimum':
        return Math.min(bufferDrawOptions.minimum, bufferBalance);
      case 'moderate':
        return Math.min(bufferDrawOptions.moderate, bufferBalance);
      case 'comfortable':
        return Math.min(bufferDrawOptions.comfortable, bufferBalance);
      case 'custom':
        return Math.min(customBufferDraw, bufferBalance);
      default:
        return 0;
    }
  }, [bufferDrawOption, bufferDrawOptions, customBufferDraw, bufferBalance]);

  // Final spending limit (after buffer draw)
  const spendingLimit = useMemo(() => {
    return Math.max(0, rawSpendingLimit + selectedBufferDraw);
  }, [rawSpendingLimit, selectedBufferDraw]);

  // Check if buffer draw step is needed
  const needsBufferDraw = rawSpendingLimit <= 0 && bufferBalance > 0;

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 'paycheck':
        return parseFloat(paycheckAmount) > 0 && cycleStartDate && cycleEndDate;
      case 'paymentMethods':
        return true; // Can skip payment methods
      case 'bills':
        return true; // Can skip bills
      case 'variableObligations':
        return true; // Can skip / have no obligations
      case 'savings':
        return minimumSave >= 0;
      case 'allocate':
        return totalAllocated <= minimumSave;
      case 'buffer-draw':
        return true; // Can proceed with any buffer draw option (including none)
      case 'review':
        return spendingLimit >= 0 || selectedBufferDraw > 0;
      default:
        return false;
    }
  }, [currentStep, paycheckAmount, cycleStartDate, cycleEndDate, minimumSave, spendingLimit, selectedBufferDraw, totalAllocated]);

  // Use appropriate steps based on edit mode
  const activeSteps = isEditMode ? EDIT_STEPS : STEPS;

  const handleNext = () => {
    // allocate → buffer-draw (if needed) → review
    if (currentStep === 'allocate' && needsBufferDraw) {
      setCurrentStep('buffer-draw');
      return;
    }
    if (currentStep === 'buffer-draw') {
      setCurrentStep('review');
      return;
    }
    // Skip buffer-draw if not needed
    if (currentStep === 'allocate' && !needsBufferDraw) {
      setCurrentStep('review');
      return;
    }
    const stepIndex = activeSteps.findIndex((s) => s.id === currentStep);
    if (stepIndex < activeSteps.length - 1) {
      setCurrentStep(activeSteps[stepIndex + 1].id);
    }
  };

  const handleBack = () => {
    // review → buffer-draw (if needed) → allocate
    if (currentStep === 'review' && needsBufferDraw) {
      setCurrentStep('buffer-draw');
      return;
    }
    if (currentStep === 'buffer-draw') {
      setCurrentStep('allocate');
      return;
    }
    // Skip buffer-draw if going back from review
    if (currentStep === 'review' && !needsBufferDraw) {
      setCurrentStep('allocate');
      return;
    }
    const stepIndex = activeSteps.findIndex((s) => s.id === currentStep);
    if (stepIndex > 0) {
      setCurrentStep(activeSteps[stepIndex - 1].id);
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

  const handleObligationToggle = (obligationId: string, defaultAmount: number) => {
    setSelectedObligations((prev) => ({
      ...prev,
      [obligationId]: {
        selected: !prev[obligationId]?.selected,
        amount: prev[obligationId]?.amount ?? defaultAmount,
      },
    }));
  };

  const handleObligationAmountChange = (obligationId: string, amount: number) => {
    setSelectedObligations((prev) => ({
      ...prev,
      [obligationId]: { ...prev[obligationId], amount },
    }));
  };

  const handleAddObligation = async () => {
    if (!user || !newObligationName || !newObligationAmount) return;

    setIsAddingObligation(true);
    try {
      const amount = parseFloat(newObligationAmount);
      if (isNaN(amount) || amount <= 0) return;

      const result = await dispatch(
        createVariableObligation({
          userId: user.uid,
          obligation: {
            name: newObligationName.trim(),
            estimatedAmount: amount,
            isActive: true,
          },
        })
      ).unwrap();

      // Auto-select the newly created obligation
      setSelectedObligations((prev) => ({
        ...prev,
        [(result as { id: string }).id]: { selected: true, amount },
      }));

      setNewObligationName('');
      setNewObligationAmount('');
      setShowAddObligation(false);
    } catch (error) {
      console.error('Failed to add obligation:', error);
    } finally {
      setIsAddingObligation(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      const startDate = parseLocalDate(cycleStartDate);
      const endDate = parseLocalDate(cycleEndDate);

      // Build cycle bills - preserve isPaid status for existing bills in edit mode
      const cycleBills: CycleBillEntry[] = Object.entries(selectedBills)
        .filter((entry) => entry[1].selected)
        .map(([billId, { amount }]) => {
          const bill = billsById[billId];
          const dueDay = bill?.dueDay || 1;
          const actualDueDate = calculateBillDueDate(dueDay, startDate, endDate);

          // In edit mode, preserve isPaid status for bills that were already in the cycle
          const existingBillEntry = editingCycle?.bills.find((b) => b.billId === billId);

          return {
            billId,
            billName: bill?.name || 'Unknown',
            amount,
            dueDate: Timestamp.fromDate(actualDueDate),
            isPaid: existingBillEntry?.isPaid || false,
            isDeferred: existingBillEntry?.isDeferred || false,
          };
        });

      // Build savings allocations object
      const savingsAllocations = {
        buffer: bufferAllocation,
        emergencyFund: emergencyFundAllocation,
        goals: activeSavingsGoals
          .filter((g) => (goalAllocations[g.id] || 0) > 0)
          .map((g) => ({
            goalId: g.id,
            goalName: g.name,
            amount: goalAllocations[g.id],
          })),
      };

      // Build cycle variable obligations
      const cycleVariableObligations: CycleVariableObligationEntry[] = Object.entries(selectedObligations)
        .filter(([, { selected }]) => selected)
        .map(([obligationId, { amount }]) => {
          const obligation = obligationsById[obligationId];
          // In edit mode, preserve amountSpent for obligations already in the cycle
          const existingEntry = editingCycle?.variableObligations?.find(
            (o) => o.obligationId === obligationId
          );
          return {
            obligationId,
            obligationName: obligation?.name || 'Unknown',
            estimatedAmount: amount,
            amountSpent: existingEntry?.amountSpent || 0,
          };
        });

      if (isEditMode && editingCycle) {
        // EDIT MODE: Update existing cycle
        const newRemainingToSpend = spendingLimit - (editingCycle.totalSpent - (editingCycle.variableObligationsSpent || 0));

        // Calculate any additional buffer draw needed (if user increased buffer draw)
        const existingBufferDraw = editingCycle.bufferDraw || 0;
        const additionalBufferDraw = Math.max(0, selectedBufferDraw - existingBufferDraw);

        if (additionalBufferDraw > 0) {
          await dispatch(
            withdrawFromBuffer({
              userId: user.uid,
              amount: additionalBufferDraw,
              reason: `Additional buffer draw for cycle edit ${cycleStartDate} to ${cycleEndDate}`,
            })
          ).unwrap();
        }

        // Reverse previous allocations and apply new ones
        const prev = editingCycle.savingsAllocations;
        if (prev) {
          // Reverse old buffer allocation, apply new
          const bufferDiff = bufferAllocation - prev.buffer;
          if (bufferDiff > 0) {
            await dispatch(addToBuffer({ userId: user.uid, amount: bufferDiff, reason: `Cycle edit savings allocation`, cycleId: editingCycle.id })).unwrap();
          } else if (bufferDiff < 0) {
            await dispatch(withdrawFromBuffer({ userId: user.uid, amount: Math.abs(bufferDiff), reason: `Cycle edit savings reallocation` })).unwrap();
          }

          // Reverse old emergency fund, apply new
          const efDiff = emergencyFundAllocation - prev.emergencyFund;
          if (efDiff > 0) {
            await dispatch(addEmergencyDeposit({ userId: user.uid, amount: efDiff, description: `Cycle edit savings allocation`, date: Timestamp.now() })).unwrap();
          } else if (efDiff < 0) {
            await dispatch(addEmergencyWithdrawal({ userId: user.uid, amount: Math.abs(efDiff), description: `Cycle edit savings reallocation`, date: Timestamp.now() })).unwrap();
          }

          // Reverse old goal allocations, apply new
          const allGoalIds = new Set([
            ...prev.goals.map((g) => g.goalId),
            ...Object.keys(goalAllocations),
          ]);
          for (const goalId of allGoalIds) {
            const oldAmt = prev.goals.find((g) => g.goalId === goalId)?.amount || 0;
            const newAmt = goalAllocations[goalId] || 0;
            const diff = newAmt - oldAmt;
            if (diff > 0) {
              await dispatch(depositToSavingsGoal({ userId: user.uid, goalId, amount: diff, description: `Cycle edit savings allocation`, cycleId: editingCycle.id })).unwrap();
            } else if (diff < 0) {
              await dispatch(withdrawFromSavingsGoal({ userId: user.uid, goalId, amount: Math.abs(diff), description: `Cycle edit savings reallocation`, cycleId: editingCycle.id })).unwrap();
            }
          }
        } else {
          // No previous allocations — just deposit new ones
          if (bufferAllocation > 0) {
            await dispatch(addToBuffer({ userId: user.uid, amount: bufferAllocation, reason: `Savings allocation for cycle`, cycleId: editingCycle.id })).unwrap();
          }
          if (emergencyFundAllocation > 0) {
            await dispatch(addEmergencyDeposit({ userId: user.uid, amount: emergencyFundAllocation, description: `Savings allocation for cycle`, date: Timestamp.now() })).unwrap();
          }
          for (const goal of savingsAllocations.goals) {
            await dispatch(depositToSavingsGoal({ userId: user.uid, goalId: goal.goalId, amount: goal.amount, description: `Savings allocation for cycle`, cycleId: editingCycle.id })).unwrap();
          }
        }

        const updates = {
          paycheckAmount: parseFloat(paycheckAmount),
          bills: cycleBills,
          billsTotal,
          variableObligations: cycleVariableObligations,
          variableObligationsTotal,
          variableObligationsSpent: editingCycle.variableObligationsSpent || 0,
          minimumSave,
          spendingLimit,
          remainingToSpend: newRemainingToSpend,
          bufferDraw: selectedBufferDraw,
          savingsAllocations,
        };

        await dispatch(
          updatePaycheckCycle({
            userId: user.uid,
            cycleId: editingCycle.id,
            updates,
          })
        ).unwrap();

        // Close the modal
        onClose?.();
      } else {
        // CREATE MODE: Create new cycle
        // If buffer draw is selected, withdraw from buffer first
        if (selectedBufferDraw > 0) {
          await dispatch(
            withdrawFromBuffer({
              userId: user.uid,
              amount: selectedBufferDraw,
              reason: `Buffer draw for cycle ${cycleStartDate} to ${cycleEndDate}`,
            })
          ).unwrap();
        }

        const cycle = {
          startDate: Timestamp.fromDate(startDate),
          endDate: Timestamp.fromDate(endDate),
          paycheckAmount: parseFloat(paycheckAmount),
          bills: cycleBills,
          billsTotal,
          variableObligations: cycleVariableObligations,
          variableObligationsTotal,
          variableObligationsSpent: 0,
          minimumSave,
          actualSaved: 0,
          spendingLimit,
          totalSpent: 0,
          remainingToSpend: spendingLimit,
          bufferContribution: 0,
          bufferDraw: selectedBufferDraw,
          savingsAllocations,
          status: 'active' as CycleStatus,
        };

        const createdCycle = await dispatch(createPaycheckCycle({ userId: user.uid, cycle })).unwrap();

        // Execute savings deposits after cycle creation
        const cycleId = createdCycle.id;

        if (bufferAllocation > 0) {
          await dispatch(addToBuffer({ userId: user.uid, amount: bufferAllocation, reason: `Savings allocation for cycle`, cycleId })).unwrap();
        }
        if (emergencyFundAllocation > 0) {
          await dispatch(addEmergencyDeposit({ userId: user.uid, amount: emergencyFundAllocation, description: `Savings allocation for cycle`, date: Timestamp.now() })).unwrap();
        }
        for (const goal of savingsAllocations.goals) {
          await dispatch(depositToSavingsGoal({ userId: user.uid, goalId: goal.goalId, amount: goal.amount, description: `Savings allocation for cycle`, cycleId })).unwrap();
        }
      }
    } catch (error) {
      console.error('Failed to save cycle:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentStepIndex = activeSteps.findIndex((s) => s.id === currentStep);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6 md:mb-8">
        <div className="w-12 h-12 md:w-16 md:h-16 bg-indigo-100 dark:bg-indigo-900/50 rounded-2xl flex items-center justify-center mx-auto mb-3 md:mb-4">
          <Calendar className="w-6 h-6 md:w-8 md:h-8 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">
          {isEditMode ? 'Edit Cycle' : 'Start a New Paycheck Cycle'}
        </h1>
        <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 mt-2">
          {isEditMode
            ? 'Reconfigure your bills, savings, and buffer for this cycle'
            : 'Set up your budget for the next pay period'}
        </p>
      </div>

      {/* Step Indicators */}
      <div className="flex items-center justify-between mb-8 px-2">
        {activeSteps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div
              className={`flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full ${
                index <= currentStepIndex
                  ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                  : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
              }`}
            >
              {index < currentStepIndex ? (
                <Check className="w-4 h-4 md:w-5 md:h-5" />
              ) : (
                <step.icon className="w-4 h-4 md:w-5 md:h-5" />
              )}
            </div>
            {index < activeSteps.length - 1 && (
              <div
                className={`h-0.5 md:h-1 mx-1 md:mx-2 ${
                  index < currentStepIndex ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-gray-200 dark:bg-gray-700'
                }`}
                style={{ width: '24px', minWidth: '24px' }}
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Paycheck Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
                  <input
                    type="number"
                    value={paycheckAmount}
                    onChange={(e) => setPaycheckAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-3 text-2xl font-semibold border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Cycle Start Date"
                  type="date"
                  value={cycleStartDate}
                  onChange={(e) => setCycleStartDate(e.target.value)}
                  disabled={isEditMode}
                />
                <Input
                  label="Cycle End Date"
                  type="date"
                  value={cycleEndDate}
                  onChange={(e) => setCycleEndDate(e.target.value)}
                  disabled={isEditMode}
                />
              </div>
              {isEditMode && (
                <p className="text-sm text-gray-500">
                  Cycle dates cannot be changed. Transactions recorded during this cycle will be preserved.
                </p>
              )}
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
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 dark:border-indigo-400'
                        : 'border-gray-200 dark:border-gray-700'
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
                          <span className="font-medium text-gray-900 dark:text-gray-100">{bill.name}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                            Due: {getBillDueDateInCycle(bill)}
                            {getOrdinalSuffix(getBillDueDateInCycle(bill))}
                          </span>
                          {bill.paymentMethodId && paymentMethodsById[bill.paymentMethodId] && (
                            <span className="text-xs text-indigo-600 dark:text-indigo-400 ml-2">
                              via {paymentMethodsById[bill.paymentMethodId].name}
                            </span>
                          )}
                        </div>
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 dark:text-gray-400">$</span>
                        <input
                          type="number"
                          value={selectedBills[bill.id]?.amount || bill.amount}
                          onChange={(e) =>
                            handleBillAmountChange(bill.id, parseFloat(e.target.value) || 0)
                          }
                          disabled={!selectedBills[bill.id]?.selected}
                          className="w-24 px-3 py-1 text-right border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 dark:disabled:bg-gray-800"
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
                <Receipt className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                <p className="text-gray-500 dark:text-gray-400 mb-4">No bills set up yet.</p>
                <Button onClick={() => setShowAddBill(true)} className="inline-flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add Your First Bill
                </Button>
              </div>
            )}

            {/* No bills due this cycle (but user has bills) */}
            {activeBills.length > 0 && billsDueThisCycle.length === 0 && !showAddBill && (
              <div className="text-center py-8">
                <Receipt className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                <p className="text-gray-500 dark:text-gray-400 mb-2">No bills due during this cycle</p>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  ({cycleStartDate} to {cycleEndDate})
                </p>
              </div>
            )}

            {/* Add bill form */}
            {showAddBill && (
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Add a Bill</h4>
                <div className="space-y-4">
                  <Input
                    label="Bill Name"
                    placeholder="e.g., Rent, Electric, Internet"
                    value={newBillName}
                    onChange={(e) => setNewBillName(e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Amount{newBillIsVariable ? ' (Estimated)' : ''}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
                        <input
                          type="number"
                          placeholder="0.00"
                          value={newBillAmount}
                          onChange={(e) => setNewBillAmount(e.target.value)}
                          className="w-full pl-8 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Day</label>
                      <select
                        value={newBillDueDay}
                        onChange={(e) => setNewBillDueDay(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Frequency</label>
                      <select
                        value={newBillFrequency}
                        onChange={(e) => setNewBillFrequency(e.target.value as BillFrequency)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Paid With</label>
                      <select
                        value={newBillPaymentMethodId || ''}
                        onChange={(e) => setNewBillPaymentMethodId(e.target.value || null)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                      <span className="text-sm text-gray-700 dark:text-gray-300">Variable amount (confirm each cycle)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newBillIsAutoPay}
                        onChange={(e) => setNewBillIsAutoPay(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Auto-pay enabled</span>
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
                className="w-full p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:border-indigo-500 dark:hover:text-indigo-400 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Another Bill
              </button>
            )}

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Total Bills Reserved</span>
              <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {formatCurrency(billsTotal)}
              </span>
            </div>
          </div>
        )}

        {currentStep === 'variableObligations' && (
          <div className="space-y-6">
            <CardHeader
              title="Variable Obligations"
              subtitle="Recurring necessities without a specific due date — pre-allocated from your paycheck"
            />

            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg flex items-start gap-2">
              <Info className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
              <p className="text-sm text-orange-700 dark:text-orange-300">
                These are budgeted separately from your discretionary spending. Gas and grocery purchases still go on your credit card as normal — just assign them to an obligation when logging to track your budget.
              </p>
            </div>

            {/* Existing obligations */}
            {activeObligations.length > 0 && (
              <div className="space-y-3">
                {activeObligations.map((obligation) => (
                  <div
                    key={obligation.id}
                    className={`p-4 rounded-lg border-2 transition-colors ${
                      selectedObligations[obligation.id]?.selected
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-400'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-3 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={selectedObligations[obligation.id]?.selected || false}
                          onChange={() =>
                            handleObligationToggle(obligation.id, obligation.estimatedAmount)
                          }
                          className="w-5 h-5 text-orange-600 rounded"
                        />
                        <div>
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {obligation.name}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                            No specific due date
                          </span>
                        </div>
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 dark:text-gray-400">$</span>
                        <input
                          type="number"
                          value={selectedObligations[obligation.id]?.amount ?? obligation.estimatedAmount}
                          onChange={(e) =>
                            handleObligationAmountChange(
                              obligation.id,
                              parseFloat(e.target.value) || 0
                            )
                          }
                          disabled={!selectedObligations[obligation.id]?.selected}
                          className="w-24 px-3 py-1 text-right border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {activeObligations.length === 0 && !showAddObligation && (
              <div className="text-center py-8">
                <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                <p className="text-gray-500 dark:text-gray-400 mb-2">No variable obligations set up yet</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
                  Add things like Gas or Groceries to pre-allocate budget from your paycheck
                </p>
                <Button onClick={() => setShowAddObligation(true)} className="inline-flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add Your First Obligation
                </Button>
              </div>
            )}

            {/* Add obligation inline form */}
            {showAddObligation && (
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Add an Obligation</h4>
                <div className="space-y-3">
                  <Input
                    label="Name"
                    placeholder="e.g., Gas, Groceries"
                    value={newObligationName}
                    onChange={(e) => setNewObligationName(e.target.value)}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Estimated Amount this Cycle
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={newObligationAmount}
                        onChange={(e) => setNewObligationAmount(e.target.value)}
                        className="w-full pl-8 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={handleAddObligation}
                      disabled={!newObligationName || !newObligationAmount || isAddingObligation}
                      isLoading={isAddingObligation}
                    >
                      Add Obligation
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setShowAddObligation(false);
                        setNewObligationName('');
                        setNewObligationAmount('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Add another */}
            {activeObligations.length > 0 && !showAddObligation && (
              <button
                onClick={() => setShowAddObligation(true)}
                className="w-full p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-orange-400 hover:text-orange-600 dark:hover:border-orange-500 dark:hover:text-orange-400 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Another Obligation
              </button>
            )}

            {variableObligationsTotal > 0 && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Total Obligations Budget</span>
                <span className="text-xl font-bold text-orange-600 dark:text-orange-400">
                  {formatCurrency(variableObligationsTotal)}
                </span>
              </div>
            )}
          </div>
        )}

        {currentStep === 'savings' && (
          <div className="space-y-6">
            <CardHeader
              title="Set Your Savings"
              subtitle="How much do you want to save this cycle?"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Minimum to Save
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
                <input
                  type="number"
                  value={minimumSave}
                  onChange={(e) => setMinimumSave(parseFloat(e.target.value) || 0)}
                  min="0"
                  step="10"
                  className="w-full pl-8 pr-4 py-3 text-xl font-semibold border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                This amount will be set aside before calculating your spending limit.
                You can set it to $0 if needed.
              </p>
            </div>

            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                <PiggyBank className="w-5 h-5" />
                <span className="font-medium">Savings Tip</span>
              </div>
              <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-1">
                Even saving $25 per paycheck adds up to $650/year!
              </p>
            </div>
          </div>
        )}

        {currentStep === 'allocate' && (
          <div className="space-y-6">
            <CardHeader
              title="Allocate Savings"
              subtitle={`Where should your ${formatCurrency(minimumSave)} savings go?`}
            />

            {minimumSave === 0 ? (
              <div className="text-center py-6">
                <PiggyBank className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">
                  No savings to allocate this cycle. You can continue to the next step.
                </p>
              </div>
            ) : (
              <>
                {/* Buffer allocation */}
                <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                        <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">Buffer</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Balance: {formatCurrency(bufferBalance)}
                        </p>
                      </div>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
                      <input
                        type="number"
                        value={bufferAllocation || ''}
                        onChange={(e) => setBufferAllocation(parseFloat(e.target.value) || 0)}
                        min="0"
                        className="w-28 pl-7 pr-3 py-2 text-right border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Emergency Fund allocation */}
                <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
                        <ShieldCheck className="w-4 h-4 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">Emergency Fund</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Balance: {formatCurrency(emergencyFund?.currentBalance || 0)}
                        </p>
                      </div>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
                      <input
                        type="number"
                        value={emergencyFundAllocation || ''}
                        onChange={(e) => setEmergencyFundAllocation(parseFloat(e.target.value) || 0)}
                        min="0"
                        className="w-28 pl-7 pr-3 py-2 text-right border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Savings Goals allocations */}
                {activeSavingsGoals.map((goal) => (
                  <div key={goal.id} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
                          <Target className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{goal.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Balance: {formatCurrency(goal.currentBalance)}
                            {goal.targetAmount ? ` / ${formatCurrency(goal.targetAmount)}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
                        <input
                          type="number"
                          value={goalAllocations[goal.id] || ''}
                          onChange={(e) =>
                            setGoalAllocations((prev) => ({
                              ...prev,
                              [goal.id]: parseFloat(e.target.value) || 0,
                            }))
                          }
                          min="0"
                          className="w-28 pl-7 pr-3 py-2 text-right border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {activeSavingsGoals.length === 0 && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-sm text-gray-500 dark:text-gray-400 text-center">
                    No savings goals yet. Create goals from the Savings Goals page to allocate to them here.
                  </div>
                )}

                {/* Allocation summary */}
                <div className={`p-4 rounded-lg border ${
                  totalAllocated === minimumSave
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : totalAllocated > minimumSave
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${
                      totalAllocated === minimumSave
                        ? 'text-green-800 dark:text-green-300'
                        : totalAllocated > minimumSave
                        ? 'text-red-800 dark:text-red-300'
                        : 'text-amber-800 dark:text-amber-300'
                    }`}>
                      Allocated: {formatCurrency(totalAllocated)} / {formatCurrency(minimumSave)}
                    </span>
                    {totalAllocated === minimumSave && (
                      <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                    )}
                  </div>
                  {totalAllocated > minimumSave && (
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                      Over-allocated by {formatCurrency(totalAllocated - minimumSave)}. Reduce allocations to continue.
                    </p>
                  )}
                  {totalAllocated < minimumSave && totalAllocated > 0 && (
                    <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                      {formatCurrency(minimumSave - totalAllocated)} unallocated (will not be deposited anywhere)
                    </p>
                  )}
                  {totalAllocated === 0 && minimumSave > 0 && (
                    <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                      Savings won't be deposited anywhere. Allocate above or skip to continue.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {currentStep === 'buffer-draw' && (
          <div className="space-y-6">
            <CardHeader
              title="Draw from Buffer"
              subtitle="Your bills exceed your paycheck. Choose how much to draw from your buffer."
            />

            {/* Warning about the gap */}
            <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-3">
              <TrendingDown className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-300">Budget Gap Detected</p>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                  Your bills ({formatCurrency(billsTotal)}) + savings ({formatCurrency(minimumSave)}) exceed your paycheck ({formatCurrency(parseFloat(paycheckAmount) || 0)}) by <strong>{formatCurrency(spendingGap)}</strong>.
                </p>
              </div>
            </div>

            {/* Buffer balance info */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PiggyBank className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span className="font-medium text-blue-800 dark:text-blue-300">Available Buffer</span>
                </div>
                <span className="text-xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(bufferBalance)}</span>
              </div>
            </div>

            {/* Historical spending info */}
            <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg flex items-start gap-2">
              <Info className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {historicalSpending.hasHistory ? (
                  <>
                    Based on your last {historicalSpending.totalCycles} cycle{historicalSpending.totalCycles > 1 ? 's' : ''}, you spend an average of <strong>{formatCurrency(historicalSpending.avgDailySpending)}/day</strong> on non-bill expenses.
                    For this {cycleDays}-day cycle, that's approximately <strong>{formatCurrency(bufferDrawOptions.estimatedSpending)}</strong>.
                  </>
                ) : (
                  <>
                    No spending history available yet. Estimates are based on a default of $50/day.
                  </>
                )}
              </div>
            </div>

            {/* Tiered options */}
            <div className="space-y-3">
              <p className="font-medium text-gray-900 dark:text-gray-100">Choose a buffer draw option:</p>

              {/* Option: None (skip) */}
              <button
                onClick={() => setBufferDrawOption('none')}
                className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
                  bufferDrawOption === 'none'
                    ? 'border-gray-500 dark:border-gray-400 bg-gray-50 dark:bg-gray-800/50'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">Skip Buffer Draw</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Start with $0 spending limit (reduce bills or savings first)
                    </p>
                  </div>
                  <span className="text-lg font-semibold text-gray-500 dark:text-gray-400">$0</span>
                </div>
              </button>

              {/* Option: Minimum */}
              <button
                onClick={() => setBufferDrawOption('minimum')}
                disabled={bufferDrawOptions.minimum > bufferBalance}
                className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
                  bufferDrawOption === 'minimum'
                    ? 'border-orange-500 dark:border-orange-400 bg-orange-50 dark:bg-orange-900/30'
                    : bufferDrawOptions.minimum > bufferBalance
                    ? 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 opacity-50 cursor-not-allowed'
                    : 'border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 dark:text-gray-100">Minimum</p>
                      <span className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 rounded">Cover Gap Only</span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Just cover the bill gap, bringing spending limit to $0
                    </p>
                  </div>
                  <span className={`text-lg font-semibold ${bufferDrawOptions.minimum > bufferBalance ? 'text-gray-400' : 'text-orange-600 dark:text-orange-400'}`}>
                    {formatCurrency(bufferDrawOptions.minimum)}
                  </span>
                </div>
                {bufferDrawOptions.minimum > bufferBalance && (
                  <p className="text-xs text-red-500 dark:text-red-400 mt-2">Insufficient buffer balance</p>
                )}
              </button>

              {/* Option: Moderate */}
              <button
                onClick={() => setBufferDrawOption('moderate')}
                disabled={bufferDrawOptions.moderate > bufferBalance}
                className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
                  bufferDrawOption === 'moderate'
                    ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30'
                    : bufferDrawOptions.moderate > bufferBalance
                    ? 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 opacity-50 cursor-not-allowed'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 dark:text-gray-100">Moderate</p>
                      <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded">Recommended</span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Gap + 50% of your typical spending ({formatCurrency(bufferDrawOptions.estimatedSpending * 0.5)})
                    </p>
                  </div>
                  <span className={`text-lg font-semibold ${bufferDrawOptions.moderate > bufferBalance ? 'text-gray-400' : 'text-blue-600 dark:text-blue-400'}`}>
                    {formatCurrency(bufferDrawOptions.moderate)}
                  </span>
                </div>
                {bufferDrawOptions.moderate > bufferBalance && (
                  <p className="text-xs text-red-500 dark:text-red-400 mt-2">Insufficient buffer balance</p>
                )}
              </button>

              {/* Option: Comfortable */}
              <button
                onClick={() => setBufferDrawOption('comfortable')}
                disabled={bufferDrawOptions.comfortable > bufferBalance}
                className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
                  bufferDrawOption === 'comfortable'
                    ? 'border-green-500 dark:border-green-400 bg-green-50 dark:bg-green-900/30'
                    : bufferDrawOptions.comfortable > bufferBalance
                    ? 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 opacity-50 cursor-not-allowed'
                    : 'border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 dark:text-gray-100">Comfortable</p>
                      <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded">Full Coverage</span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Gap + 100% of your typical spending ({formatCurrency(bufferDrawOptions.estimatedSpending)})
                    </p>
                  </div>
                  <span className={`text-lg font-semibold ${bufferDrawOptions.comfortable > bufferBalance ? 'text-gray-400' : 'text-green-600 dark:text-green-400'}`}>
                    {formatCurrency(bufferDrawOptions.comfortable)}
                  </span>
                </div>
                {bufferDrawOptions.comfortable > bufferBalance && (
                  <p className="text-xs text-red-500 dark:text-red-400 mt-2">Insufficient buffer balance</p>
                )}
              </button>

              {/* Option: Custom */}
              <button
                onClick={() => setBufferDrawOption('custom')}
                className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
                  bufferDrawOption === 'custom'
                    ? 'border-purple-500 dark:border-purple-400 bg-purple-50 dark:bg-purple-900/30'
                    : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">Custom Amount</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Enter your own amount to draw
                    </p>
                  </div>
                  {bufferDrawOption === 'custom' ? (
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
                      <input
                        type="number"
                        value={customBufferDraw || ''}
                        onChange={(e) => setCustomBufferDraw(parseFloat(e.target.value) || 0)}
                        min="0"
                        max={bufferBalance}
                        className="w-28 pl-7 pr-3 py-2 text-right border border-purple-300 dark:border-purple-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  ) : (
                    <span className="text-lg font-semibold text-purple-600 dark:text-purple-400">Custom</span>
                  )}
                </div>
              </button>
            </div>

            {/* Preview of result */}
            {bufferDrawOption !== 'none' && selectedBufferDraw > 0 && (
              <div className="p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-green-800 dark:text-green-300">Resulting Spending Limit:</span>
                  <span className="text-xl font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(Math.max(0, rawSpendingLimit + selectedBufferDraw))}
                  </span>
                </div>
                <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                  Buffer remaining after draw: {formatCurrency(bufferBalance - selectedBufferDraw)}
                </p>
              </div>
            )}
          </div>
        )}

        {currentStep === 'review' && (
          <div className="space-y-6">
            <CardHeader
              title="Review Your Cycle"
              subtitle="Make sure everything looks correct"
            />

            {spendingLimit < 0 && (
              <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800 dark:text-red-300">Spending limit is negative!</p>
                  <p className="text-sm text-red-600 dark:text-red-400">
                    Your bills and savings exceed your paycheck. Go back and adjust.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Paycheck</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {formatCurrency(parseFloat(paycheckAmount) || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center text-red-600 dark:text-red-400">
                <span>− Bills Reserved ({Object.values(selectedBills).filter((b) => b.selected).length})</span>
                <span>−{formatCurrency(billsTotal)}</span>
              </div>
              {variableObligationsTotal > 0 && (
                <div className="flex justify-between items-center text-orange-600 dark:text-orange-400">
                  <span>− Variable Obligations ({Object.values(selectedObligations).filter((o) => o.selected).length})</span>
                  <span>−{formatCurrency(variableObligationsTotal)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-blue-600 dark:text-blue-400">
                <span>− Savings</span>
                <span>−{formatCurrency(minimumSave)}</span>
              </div>
              {totalAllocated > 0 && (
                <div className="ml-4 space-y-1 text-sm">
                  {bufferAllocation > 0 && (
                    <div className="flex justify-between text-gray-500 dark:text-gray-400">
                      <span>→ Buffer</span>
                      <span>{formatCurrency(bufferAllocation)}</span>
                    </div>
                  )}
                  {emergencyFundAllocation > 0 && (
                    <div className="flex justify-between text-gray-500 dark:text-gray-400">
                      <span>→ Emergency Fund</span>
                      <span>{formatCurrency(emergencyFundAllocation)}</span>
                    </div>
                  )}
                  {activeSavingsGoals.map((goal) =>
                    goalAllocations[goal.id] > 0 ? (
                      <div key={goal.id} className="flex justify-between text-gray-500 dark:text-gray-400">
                        <span>→ {goal.name}</span>
                        <span>{formatCurrency(goalAllocations[goal.id])}</span>
                      </div>
                    ) : null
                  )}
                  {totalAllocated < minimumSave && (
                    <div className="flex justify-between text-gray-400 dark:text-gray-500 italic">
                      <span>→ Unallocated</span>
                      <span>{formatCurrency(minimumSave - totalAllocated)}</span>
                    </div>
                  )}
                </div>
              )}
              {selectedBufferDraw > 0 && (
                <div className="flex justify-between items-center text-purple-600 dark:text-purple-400">
                  <span>+ Buffer Draw</span>
                  <span>+{formatCurrency(selectedBufferDraw)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-4 border-t border-gray-300 dark:border-gray-600">
                <span className="font-semibold text-gray-900 dark:text-gray-100">= Your Spending Limit</span>
                <span
                  className={`text-2xl font-bold ${
                    spendingLimit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {formatCurrency(spendingLimit)}
                </span>
              </div>
            </div>

            {selectedBufferDraw > 0 && (
              <div className="p-3 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg text-sm text-purple-700 dark:text-purple-300">
                <strong>Note:</strong> {formatCurrency(selectedBufferDraw)} will be withdrawn from your buffer when you start this cycle.
                Buffer balance after: {formatCurrency(bufferBalance - selectedBufferDraw)}
              </div>
            )}

            <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
              Cycle: {parseLocalDate(cycleStartDate).toLocaleDateString()} -{' '}
              {parseLocalDate(cycleEndDate).toLocaleDateString()}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-6 border-t">
          <div className="flex gap-2">
            {isEditMode && currentStepIndex === 0 && (
              <Button
                variant="secondary"
                onClick={onClose}
                className="flex items-center gap-2"
              >
                Cancel
              </Button>
            )}
            {currentStepIndex > 0 && (
              <Button
                variant="secondary"
                onClick={handleBack}
                className="flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
            )}
          </div>

          {currentStep === 'review' ? (
            <Button
              onClick={handleSubmit}
              isLoading={isSubmitting}
              disabled={!canProceed || spendingLimit < 0}
              className="flex items-center gap-2"
            >
              {isEditMode ? 'Save Changes' : 'Start Cycle'}
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

// Returns the suggested cycle start date based on the user's pay schedule settings
function getSuggestedStartDate(settings: UserSettings): string | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (settings.scheduleType === 'semi-monthly' && settings.semiMonthlyDays) {
    const [day1, day2] = settings.semiMonthlyDays;
    const year = today.getFullYear();
    const month = today.getMonth();
    const todayDay = today.getDate();

    if (todayDay <= day1) {
      return formatLocalDate(new Date(year, month, day1));
    } else if (todayDay <= day2) {
      return formatLocalDate(new Date(year, month, day2));
    } else {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      return formatLocalDate(new Date(nextYear, nextMonth, day1));
    }
  }

  if (settings.scheduleType === 'bi-weekly' && settings.biWeeklyAnchorDate) {
    const anchor = settings.biWeeklyAnchorDate.toDate();
    anchor.setHours(0, 0, 0, 0);
    const current = new Date(anchor);
    while (current < today) {
      current.setDate(current.getDate() + 14);
    }
    return formatLocalDate(current);
  }

  return null;
}

// Returns the end date for a semi-monthly cycle given its start date and pay days
function getSemiMonthlyEndDate(startDate: Date, payDays: [number, number]): Date {
  const [day1, day2] = payDays;
  const startDay = startDate.getDate();
  const year = startDate.getFullYear();
  const month = startDate.getMonth();

  let nextPayDate: Date;
  if (startDay <= day1) {
    nextPayDate = new Date(year, month, day2);
  } else {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    nextPayDate = new Date(nextYear, nextMonth, day1);
  }

  const end = new Date(nextPayDate);
  end.setDate(end.getDate() - 1);
  return end;
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
