import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  orderBy,
  where,
  limit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './config';
import { PaycheckCycle, CycleStatus, CycleVariableObligationEntry } from '../../types';

const getCyclesRef = (userId: string) => collection(db, `users/${userId}/paycheckCycles`);

export const getPaycheckCycles = async (userId: string): Promise<PaycheckCycle[]> => {
  const q = query(getCyclesRef(userId), orderBy('startDate', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as PaycheckCycle);
};

export const getActiveCycle = async (userId: string): Promise<PaycheckCycle | null> => {
  const q = query(
    getCyclesRef(userId),
    where('status', '==', 'active'),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as PaycheckCycle;
};

export const getCycleById = async (
  userId: string,
  cycleId: string
): Promise<PaycheckCycle | null> => {
  const docRef = doc(db, `users/${userId}/paycheckCycles/${cycleId}`);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as PaycheckCycle;
};

export const createPaycheckCycle = async (
  userId: string,
  cycle: Omit<PaycheckCycle, 'id' | 'createdAt' | 'updatedAt'>
): Promise<PaycheckCycle> => {
  const docRef = await addDoc(getCyclesRef(userId), {
    ...cycle,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const snapshot = await getDoc(docRef);
  return { id: docRef.id, ...snapshot.data() } as PaycheckCycle;
};

export const updatePaycheckCycle = async (
  userId: string,
  cycleId: string,
  updates: Partial<Omit<PaycheckCycle, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
  const docRef = doc(db, `users/${userId}/paycheckCycles/${cycleId}`);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

// Update spending totals after a discretionary transaction
export const updateCycleSpending = async (
  userId: string,
  cycleId: string,
  totalSpent: number,
  remainingToSpend: number
): Promise<void> => {
  const docRef = doc(db, `users/${userId}/paycheckCycles/${cycleId}`);
  await updateDoc(docRef, {
    totalSpent,
    remainingToSpend,
    updatedAt: serverTimestamp(),
  });
};

// Update spending totals after a variable obligation transaction
// Does NOT change remainingToSpend (obligation spending comes from a separate pool)
export const updateCycleObligationSpending = async (
  userId: string,
  cycleId: string,
  obligationId: string,
  newObligationAmountSpent: number,
  newVariableObligationsSpent: number,
  newTotalSpent: number
): Promise<void> => {
  const cycleRef = doc(db, `users/${userId}/paycheckCycles/${cycleId}`);
  const cycleSnap = await getDoc(cycleRef);
  if (!cycleSnap.exists()) return;

  const cycle = cycleSnap.data() as PaycheckCycle;
  const updatedObligations = (cycle.variableObligations || []).map(
    (o: CycleVariableObligationEntry) =>
      o.obligationId === obligationId
        ? { ...o, amountSpent: newObligationAmountSpent }
        : o
  );

  await updateDoc(cycleRef, {
    variableObligations: updatedObligations,
    variableObligationsSpent: newVariableObligationsSpent,
    totalSpent: newTotalSpent,
    updatedAt: serverTimestamp(),
  });
};

// Complete a cycle
export const completeCycle = async (
  userId: string,
  cycleId: string,
  actualSaved: number,
  bufferContribution: number,
  reflection?: string
): Promise<void> => {
  const docRef = doc(db, `users/${userId}/paycheckCycles/${cycleId}`);
  await updateDoc(docRef, {
    status: 'completed' as CycleStatus,
    actualSaved,
    bufferContribution,
    reflection: reflection || null,
    updatedAt: serverTimestamp(),
  });
};

// Mark a bill as paid within a cycle
export const markCycleBillPaid = async (
  userId: string,
  cycleId: string,
  billId: string,
  isPaid: boolean
): Promise<void> => {
  const cycleRef = doc(db, `users/${userId}/paycheckCycles/${cycleId}`);
  const cycleSnap = await getDoc(cycleRef);

  if (!cycleSnap.exists()) return;

  const cycle = cycleSnap.data() as PaycheckCycle;
  const updatedBills = cycle.bills.map((b) =>
    b.billId === billId ? { ...b, isPaid } : b
  );

  await updateDoc(cycleRef, {
    bills: updatedBills,
    updatedAt: serverTimestamp(),
  });
};

// Sync bill amount changes to active cycles
export const syncBillAmountToActiveCycles = async (
  userId: string,
  billId: string,
  newAmount: number,
  newName?: string
): Promise<{ cycleId: string; updates: Partial<PaycheckCycle> } | null> => {
  // Get the active cycle
  const activeCycle = await getActiveCycle(userId);
  if (!activeCycle) return null;

  // Check if this bill is in the active cycle
  const billIndex = activeCycle.bills.findIndex((b) => b.billId === billId);
  if (billIndex === -1) return null;

  const oldAmount = activeCycle.bills[billIndex].amount;
  const amountDiff = newAmount - oldAmount;

  // Update the bill in the bills array
  const updatedBills = activeCycle.bills.map((b) =>
    b.billId === billId
      ? { ...b, amount: newAmount, billName: newName || b.billName }
      : b
  );

  // Recalculate totals
  const newBillsTotal = activeCycle.billsTotal + amountDiff;
  const newSpendingLimit = activeCycle.spendingLimit - amountDiff;
  const newRemainingToSpend = activeCycle.remainingToSpend - amountDiff;

  const updates: Partial<PaycheckCycle> = {
    bills: updatedBills,
    billsTotal: newBillsTotal,
    spendingLimit: newSpendingLimit,
    remainingToSpend: newRemainingToSpend,
  };

  // Update in Firebase
  const cycleRef = doc(db, `users/${userId}/paycheckCycles/${activeCycle.id}`);
  await updateDoc(cycleRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });

  return { cycleId: activeCycle.id, updates };
};

// Remove a bill from active cycles (when bill is deleted)
export const removeBillFromActiveCycles = async (
  userId: string,
  billId: string
): Promise<{ cycleId: string; updates: Partial<PaycheckCycle> } | null> => {
  // Get the active cycle
  const activeCycle = await getActiveCycle(userId);
  if (!activeCycle) return null;

  // Check if this bill is in the active cycle
  const billEntry = activeCycle.bills.find((b) => b.billId === billId);
  if (!billEntry) return null;

  const billAmount = billEntry.amount;

  // Remove the bill from the bills array
  const updatedBills = activeCycle.bills.filter((b) => b.billId !== billId);

  // Recalculate totals (bill removed = more spending money)
  const newBillsTotal = activeCycle.billsTotal - billAmount;
  const newSpendingLimit = activeCycle.spendingLimit + billAmount;
  const newRemainingToSpend = activeCycle.remainingToSpend + billAmount;

  const updates: Partial<PaycheckCycle> = {
    bills: updatedBills,
    billsTotal: newBillsTotal,
    spendingLimit: newSpendingLimit,
    remainingToSpend: newRemainingToSpend,
  };

  // Update in Firebase
  const cycleRef = doc(db, `users/${userId}/paycheckCycles/${activeCycle.id}`);
  await updateDoc(cycleRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });

  return { cycleId: activeCycle.id, updates };
};

// Add a new bill to active cycle if it falls within the cycle dates
export const addBillToActiveCycle = async (
  userId: string,
  billId: string,
  billName: string,
  amount: number,
  dueDay: number,
  frequency: string,
  startDate?: Date
): Promise<{ cycleId: string; updates: Partial<PaycheckCycle> } | null> => {
  // Get the active cycle
  const activeCycle = await getActiveCycle(userId);
  if (!activeCycle) return null;

  const cycleStart = activeCycle.startDate.toDate();
  const cycleEnd = activeCycle.endDate.toDate();

  // Check if bill is already in the cycle
  if (activeCycle.bills.some((b) => b.billId === billId)) {
    return null;
  }

  // Calculate if this bill falls within the cycle
  let dueDate: Date | null = null;

  if (frequency === 'one-time' && startDate) {
    // One-time bills use their start date
    if (startDate >= cycleStart && startDate <= cycleEnd) {
      dueDate = startDate;
    }
  } else if (frequency === 'bi-weekly' && startDate) {
    // Bi-weekly: find occurrence within cycle
    const currentDate = new Date(startDate);
    while (currentDate < cycleStart) {
      currentDate.setDate(currentDate.getDate() + 14);
    }
    if (currentDate >= cycleStart && currentDate <= cycleEnd) {
      dueDate = new Date(currentDate);
    }
  } else if (
    (frequency === 'quarterly' || frequency === 'semi-annual' || frequency === 'annual') &&
    startDate
  ) {
    // Quarterly/semi-annual/annual: anchor to startDate and advance by frequency
    const months =
      frequency === 'quarterly' ? 3 : frequency === 'semi-annual' ? 6 : 12;
    const currentDate = new Date(startDate);

    if (currentDate <= cycleEnd) {
      while (currentDate < cycleStart) {
        currentDate.setMonth(currentDate.getMonth() + months);
      }
      if (currentDate >= cycleStart && currentDate <= cycleEnd) {
        dueDate = new Date(currentDate);
      }
    }
  } else {
    // Monthly and other frequencies: check if dueDay falls within cycle
    const startMonth = cycleStart.getMonth();
    const startYear = cycleStart.getFullYear();
    const lastDayOfStartMonth = new Date(startYear, startMonth + 1, 0).getDate();
    const effectiveDueDay = Math.min(dueDay, lastDayOfStartMonth);
    const dueDateInStartMonth = new Date(startYear, startMonth, effectiveDueDay);

    if (dueDateInStartMonth >= cycleStart && dueDateInStartMonth <= cycleEnd) {
      dueDate = dueDateInStartMonth;
    } else if (cycleStart.getMonth() !== cycleEnd.getMonth()) {
      // Cycle spans two months, check end month too
      const endMonth = cycleEnd.getMonth();
      const endYear = cycleEnd.getFullYear();
      const lastDayOfEndMonth = new Date(endYear, endMonth + 1, 0).getDate();
      const effectiveDueDayEnd = Math.min(dueDay, lastDayOfEndMonth);
      const dueDateInEndMonth = new Date(endYear, endMonth, effectiveDueDayEnd);

      if (dueDateInEndMonth >= cycleStart && dueDateInEndMonth <= cycleEnd) {
        dueDate = dueDateInEndMonth;
      }
    }
  }

  // If no due date found within cycle, don't add
  if (!dueDate) return null;

  // Add bill to cycle
  const newBillEntry = {
    billId,
    billName,
    amount,
    dueDate: Timestamp.fromDate(dueDate),
    isPaid: false,
    isDeferred: false,
  };

  const updatedBills = [...activeCycle.bills, newBillEntry];
  const newBillsTotal = activeCycle.billsTotal + amount;
  const newSpendingLimit = activeCycle.spendingLimit - amount;
  const newRemainingToSpend = activeCycle.remainingToSpend - amount;

  const updates: Partial<PaycheckCycle> = {
    bills: updatedBills,
    billsTotal: newBillsTotal,
    spendingLimit: newSpendingLimit,
    remainingToSpend: newRemainingToSpend,
  };

  // Update in Firebase
  const cycleRef = doc(db, `users/${userId}/paycheckCycles/${activeCycle.id}`);
  await updateDoc(cycleRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });

  return { cycleId: activeCycle.id, updates };
};
