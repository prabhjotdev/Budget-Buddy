import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from './config';
import { DebtEntry } from '../../types/debtTracking';

export const getDebtEntries = async (userId: string): Promise<DebtEntry[]> => {
  const ref = collection(db, `users/${userId}/debtEntries`);
  const q = query(ref, orderBy('date', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as DebtEntry);
};

export const createDebtEntry = async (
  userId: string,
  entry: Omit<DebtEntry, 'id' | 'createdAt' | 'updatedAt'>
): Promise<DebtEntry> => {
  const ref = collection(db, `users/${userId}/debtEntries`);
  const now = Timestamp.now();

  const data: Record<string, unknown> = { createdAt: now, updatedAt: now };
  for (const [key, value] of Object.entries(entry)) {
    if (value !== undefined) {
      data[key] = value;
    }
  }

  const docRef = await addDoc(ref, data);
  return { id: docRef.id, ...entry, createdAt: now, updatedAt: now };
};

export const updateDebtEntry = async (
  userId: string,
  entryId: string,
  updates: Partial<Omit<DebtEntry, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
  const docRef = doc(db, `users/${userId}/debtEntries/${entryId}`);

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    sanitized[key] = value === undefined ? deleteField() : value;
  }

  await updateDoc(docRef, { ...sanitized, updatedAt: Timestamp.now() });
};

export const deleteDebtEntry = async (userId: string, entryId: string): Promise<void> => {
  const docRef = doc(db, `users/${userId}/debtEntries/${entryId}`);
  await deleteDoc(docRef);
};

export const markDebtPaid = async (
  userId: string,
  entryId: string,
  isPaid: boolean
): Promise<{ isPaid: boolean; paidDate: Timestamp | undefined }> => {
  const docRef = doc(db, `users/${userId}/debtEntries/${entryId}`);
  const paidDate = isPaid ? Timestamp.now() : undefined;

  await updateDoc(docRef, {
    isPaid,
    paidDate: paidDate ?? deleteField(),
    updatedAt: Timestamp.now(),
  });

  return { isPaid, paidDate };
};
