import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';
import { IncomeSource } from '../../types';

const getIncomeSourcesRef = (userId: string) => collection(db, `users/${userId}/incomeSources`);

export const getIncomeSources = async (userId: string): Promise<IncomeSource[]> => {
  const q = query(getIncomeSourcesRef(userId), orderBy('createdAt'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as IncomeSource);
};

export const createIncomeSource = async (
  userId: string,
  source: Omit<IncomeSource, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const docRef = await addDoc(getIncomeSourcesRef(userId), {
    ...source,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const updateIncomeSource = async (
  userId: string,
  sourceId: string,
  updates: Partial<Omit<IncomeSource, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
  const docRef = doc(db, `users/${userId}/incomeSources/${sourceId}`);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const deleteIncomeSource = async (userId: string, sourceId: string): Promise<void> => {
  const docRef = doc(db, `users/${userId}/incomeSources/${sourceId}`);
  await deleteDoc(docRef);
};
