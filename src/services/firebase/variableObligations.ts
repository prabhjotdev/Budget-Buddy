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
import { VariableObligation } from '../../types';

const getObligationsRef = (userId: string) =>
  collection(db, `users/${userId}/variableObligations`);

export const getVariableObligations = async (userId: string): Promise<VariableObligation[]> => {
  const q = query(getObligationsRef(userId), orderBy('createdAt', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as VariableObligation);
};

export const getActiveVariableObligations = async (
  userId: string
): Promise<VariableObligation[]> => {
  const q = query(
    getObligationsRef(userId),
    where('isActive', '==', true),
    orderBy('createdAt', 'asc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as VariableObligation);
};

export const createVariableObligation = async (
  userId: string,
  obligation: Omit<VariableObligation, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const docRef = await addDoc(getObligationsRef(userId), {
    ...obligation,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const updateVariableObligation = async (
  userId: string,
  obligationId: string,
  updates: Partial<Omit<VariableObligation, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
  const docRef = doc(db, `users/${userId}/variableObligations/${obligationId}`);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const deleteVariableObligation = async (
  userId: string,
  obligationId: string
): Promise<void> => {
  const docRef = doc(db, `users/${userId}/variableObligations/${obligationId}`);
  await deleteDoc(docRef);
};
