import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';
import { SpendingTransaction } from '../../types';

const getTransactionsRef = (userId: string) =>
  collection(db, `users/${userId}/spendingTransactions`);

export const getSpendingTransactions = async (
  userId: string
): Promise<SpendingTransaction[]> => {
  const q = query(getTransactionsRef(userId), orderBy('date', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as SpendingTransaction);
};

export const getTransactionsByCycle = async (
  userId: string,
  cycleId: string
): Promise<SpendingTransaction[]> => {
  const q = query(
    getTransactionsRef(userId),
    where('cycleId', '==', cycleId),
    orderBy('date', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as SpendingTransaction);
};

export const createSpendingTransaction = async (
  userId: string,
  transaction: Omit<SpendingTransaction, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const docRef = await addDoc(getTransactionsRef(userId), {
    ...transaction,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const updateSpendingTransaction = async (
  userId: string,
  transactionId: string,
  updates: Partial<Omit<SpendingTransaction, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
  const docRef = doc(db, `users/${userId}/spendingTransactions/${transactionId}`);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const deleteSpendingTransaction = async (
  userId: string,
  transactionId: string
): Promise<void> => {
  const docRef = doc(db, `users/${userId}/spendingTransactions/${transactionId}`);
  await deleteDoc(docRef);
};

// Get total spent for a cycle (for recalculation)
export const getCycleSpendingTotal = async (
  userId: string,
  cycleId: string
): Promise<number> => {
  const transactions = await getTransactionsByCycle(userId, cycleId);
  return transactions.reduce((sum, tx) => sum + tx.amount, 0);
};
