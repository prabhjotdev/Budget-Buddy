import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from './config';
import { SavingsGoal, SavingsGoalTransaction } from '../../types/savingsGoals';

// --- Goals CRUD ---

export const getSavingsGoals = async (userId: string): Promise<SavingsGoal[]> => {
  const goalsRef = collection(db, `users/${userId}/savingsGoals`);
  const q = query(goalsRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as SavingsGoal);
};

export const createSavingsGoal = async (
  userId: string,
  goal: Omit<SavingsGoal, 'id' | 'createdAt' | 'updatedAt'>
): Promise<SavingsGoal> => {
  const goalsRef = collection(db, `users/${userId}/savingsGoals`);
  const now = Timestamp.now();

  const docRef = await addDoc(goalsRef, {
    ...goal,
    createdAt: now,
    updatedAt: now,
  });

  return {
    id: docRef.id,
    ...goal,
    createdAt: now,
    updatedAt: now,
  };
};

export const updateSavingsGoal = async (
  userId: string,
  goalId: string,
  updates: Partial<Pick<SavingsGoal, 'name' | 'targetAmount' | 'targetDate' | 'isActive'>>
): Promise<void> => {
  const goalRef = doc(db, `users/${userId}/savingsGoals/${goalId}`);
  await updateDoc(goalRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

export const deleteSavingsGoal = async (userId: string, goalId: string): Promise<void> => {
  const goalRef = doc(db, `users/${userId}/savingsGoals/${goalId}`);
  await deleteDoc(goalRef);
};

// --- Deposits & Withdrawals ---

export const depositToSavingsGoal = async (
  userId: string,
  goalId: string,
  amount: number,
  description: string,
  cycleId: string | null
): Promise<{ newBalance: number; transaction: SavingsGoalTransaction }> => {
  // Get current balance
  const goalRef = doc(db, `users/${userId}/savingsGoals/${goalId}`);
  const goalSnap = await getDoc(goalRef);
  const currentBalance = goalSnap.exists() ? (goalSnap.data().currentBalance || 0) : 0;
  const newBalance = currentBalance + amount;

  // Update balance
  await updateDoc(goalRef, {
    currentBalance: newBalance,
    updatedAt: Timestamp.now(),
  });

  // Add transaction
  const txRef = collection(db, `users/${userId}/savingsGoalTransactions`);
  const now = Timestamp.now();
  const txDoc = await addDoc(txRef, {
    goalId,
    type: 'deposit',
    amount,
    description,
    cycleId,
    createdAt: now,
  });

  return {
    newBalance,
    transaction: {
      id: txDoc.id,
      goalId,
      type: 'deposit',
      amount,
      description,
      cycleId,
      createdAt: now,
    },
  };
};

export const withdrawFromSavingsGoal = async (
  userId: string,
  goalId: string,
  amount: number,
  description: string,
  cycleId: string | null
): Promise<{ newBalance: number; transaction: SavingsGoalTransaction }> => {
  // Get current balance
  const goalRef = doc(db, `users/${userId}/savingsGoals/${goalId}`);
  const goalSnap = await getDoc(goalRef);
  const currentBalance = goalSnap.exists() ? (goalSnap.data().currentBalance || 0) : 0;
  const newBalance = Math.max(0, currentBalance - amount);

  // Update balance
  await updateDoc(goalRef, {
    currentBalance: newBalance,
    updatedAt: Timestamp.now(),
  });

  // Add transaction
  const txRef = collection(db, `users/${userId}/savingsGoalTransactions`);
  const now = Timestamp.now();
  const txDoc = await addDoc(txRef, {
    goalId,
    type: 'withdrawal',
    amount,
    description,
    cycleId,
    createdAt: now,
  });

  return {
    newBalance,
    transaction: {
      id: txDoc.id,
      goalId,
      type: 'withdrawal',
      amount,
      description,
      cycleId,
      createdAt: now,
    },
  };
};

export const getSavingsGoalTransactions = async (
  userId: string,
  goalId?: string
): Promise<SavingsGoalTransaction[]> => {
  const txRef = collection(db, `users/${userId}/savingsGoalTransactions`);
  let q;
  if (goalId) {
    q = query(txRef, where('goalId', '==', goalId), orderBy('createdAt', 'desc'));
  } else {
    q = query(txRef, orderBy('createdAt', 'desc'));
  }
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as SavingsGoalTransaction);
};
