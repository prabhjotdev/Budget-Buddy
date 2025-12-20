import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';
import { RecurringTransaction } from '../../types';

const getRecurringRef = (userId: string) =>
  collection(db, `users/${userId}/recurringTransactions`);

export const getRecurringTransactions = async (
  userId: string
): Promise<RecurringTransaction[]> => {
  const q = query(getRecurringRef(userId), orderBy('createdAt'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as RecurringTransaction);
};

export const getActiveRecurringForPeriod = async (
  userId: string,
  periodType: 1 | 15
): Promise<RecurringTransaction[]> => {
  const q = query(
    getRecurringRef(userId),
    where('isActive', '==', true),
    where('assignToPeriod', '==', periodType)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as RecurringTransaction);
};

export const createRecurringTransaction = async (
  userId: string,
  recurring: Omit<RecurringTransaction, 'id' | 'createdAt' | 'updatedAt' | 'lastGeneratedPeriodId'>
): Promise<string> => {
  const docRef = await addDoc(getRecurringRef(userId), {
    ...recurring,
    lastGeneratedPeriodId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const updateRecurringTransaction = async (
  userId: string,
  recurringId: string,
  updates: Partial<Omit<RecurringTransaction, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
  const docRef = doc(db, `users/${userId}/recurringTransactions/${recurringId}`);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const deleteRecurringTransaction = async (
  userId: string,
  recurringId: string
): Promise<void> => {
  const docRef = doc(db, `users/${userId}/recurringTransactions/${recurringId}`);
  await deleteDoc(docRef);
};
