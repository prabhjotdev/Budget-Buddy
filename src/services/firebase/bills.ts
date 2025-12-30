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
import { Bill } from '../../types';

const getBillsRef = (userId: string) => collection(db, `users/${userId}/bills`);

export const getBills = async (userId: string): Promise<Bill[]> => {
  const q = query(getBillsRef(userId), orderBy('dueDay'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Bill);
};

export const getActiveBills = async (userId: string): Promise<Bill[]> => {
  const q = query(getBillsRef(userId), where('isActive', '==', true), orderBy('dueDay'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Bill);
};

export const createBill = async (
  userId: string,
  bill: Omit<Bill, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const docRef = await addDoc(getBillsRef(userId), {
    ...bill,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const updateBill = async (
  userId: string,
  billId: string,
  updates: Partial<Omit<Bill, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
  const docRef = doc(db, `users/${userId}/bills/${billId}`);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const deleteBill = async (userId: string, billId: string): Promise<void> => {
  const docRef = doc(db, `users/${userId}/bills/${billId}`);
  await deleteDoc(docRef);
};
