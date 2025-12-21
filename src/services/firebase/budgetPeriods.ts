import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  Timestamp,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './config';
import { BudgetPeriod, BudgetAllocation, IncomeEntry } from '../../types';

const getPeriodsRef = (userId: string) => collection(db, `users/${userId}/budgetPeriods`);
const getAllocationsRef = (userId: string, periodId: string) =>
  collection(db, `users/${userId}/budgetPeriods/${periodId}/allocations`);

export const getBudgetPeriods = async (userId: string): Promise<BudgetPeriod[]> => {
  const q = query(getPeriodsRef(userId), orderBy('startDate', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as BudgetPeriod);
};

export const getActivePeriod = async (userId: string): Promise<BudgetPeriod | null> => {
  const q = query(getPeriodsRef(userId), where('status', '==', 'active'), limit(1));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as BudgetPeriod;
};

export const subscribeToActivePeriod = (
  userId: string,
  onData: (period: BudgetPeriod | null, allocations: BudgetAllocation[]) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  const q = query(getPeriodsRef(userId), where('status', '==', 'active'), limit(1));

  return onSnapshot(
    q,
    async (snapshot) => {
      if (snapshot.empty) {
        onData(null, []);
        return;
      }

      const periodDoc = snapshot.docs[0];
      const period = { id: periodDoc.id, ...periodDoc.data() } as BudgetPeriod;

      const allocationsSnap = await getDocs(getAllocationsRef(userId, period.id));
      const allocations = allocationsSnap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as BudgetAllocation
      );

      onData(period, allocations);
    },
    onError
  );
};

export const getAllocations = async (
  userId: string,
  periodId: string
): Promise<BudgetAllocation[]> => {
  const snapshot = await getDocs(getAllocationsRef(userId, periodId));
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as BudgetAllocation);
};

export const createBudgetPeriod = async (
  userId: string,
  periodData: {
    startDate: Date;
    endDate: Date;
    totalIncome: number;
    incomeBreakdown: IncomeEntry[];
    rolloverIn: number;
  },
  allocations: Array<{
    categoryId: string;
    categoryName: string;
    categoryColor: string;
    budgetedAmount: number;
    note: string;
  }>
): Promise<string> => {
  const batch = writeBatch(db);

  const periodRef = doc(getPeriodsRef(userId));
  const totalAllocated = allocations.reduce((sum, a) => sum + a.budgetedAmount, 0);

  batch.set(periodRef, {
    startDate: Timestamp.fromDate(periodData.startDate),
    endDate: Timestamp.fromDate(periodData.endDate),
    status: 'active',
    totalIncome: periodData.totalIncome,
    incomeBreakdown: periodData.incomeBreakdown,
    rolloverIn: periodData.rolloverIn,
    rolloverOut: 0,
    totalAllocated,
    totalSpent: 0,
    remainingBudget: periodData.totalIncome + periodData.rolloverIn,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  for (const allocation of allocations) {
    const allocationRef = doc(getAllocationsRef(userId, periodRef.id));
    batch.set(allocationRef, {
      ...allocation,
      spentAmount: 0,
      remainingAmount: allocation.budgetedAmount,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
  return periodRef.id;
};

export const closeBudgetPeriod = async (
  userId: string,
  periodId: string,
  rolloverOut: number
): Promise<void> => {
  const docRef = doc(db, `users/${userId}/budgetPeriods/${periodId}`);
  await updateDoc(docRef, {
    status: 'closed',
    rolloverOut,
    updatedAt: serverTimestamp(),
  });
};

export const updateAllocation = async (
  userId: string,
  periodId: string,
  allocationId: string,
  updates: Partial<Omit<BudgetAllocation, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
  const docRef = doc(db, `users/${userId}/budgetPeriods/${periodId}/allocations/${allocationId}`);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const getPreviousPeriod = async (
  userId: string,
  beforeDate: Date
): Promise<BudgetPeriod | null> => {
  const q = query(
    getPeriodsRef(userId),
    where('endDate', '<', Timestamp.fromDate(beforeDate)),
    orderBy('endDate', 'desc'),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as BudgetPeriod;
};
