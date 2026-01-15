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
} from 'firebase/firestore';
import { db } from './config';
import { PaycheckCycle, CycleStatus } from '../../types';

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

// Update spending totals after a transaction
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
