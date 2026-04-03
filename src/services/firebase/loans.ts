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
import { Loan } from '../../types/loanPayoff';

export const getLoans = async (userId: string): Promise<Loan[]> => {
  const loansRef = collection(db, `users/${userId}/loans`);
  const q = query(loansRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Loan);
};

export const createLoan = async (
  userId: string,
  loan: Omit<Loan, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Loan> => {
  const loansRef = collection(db, `users/${userId}/loans`);
  const now = Timestamp.now();

  const loanData: Record<string, unknown> = { createdAt: now, updatedAt: now };
  for (const [key, value] of Object.entries(loan)) {
    if (value !== undefined) {
      loanData[key] = value;
    }
  }

  const docRef = await addDoc(loansRef, loanData);

  return {
    id: docRef.id,
    ...loan,
    createdAt: now,
    updatedAt: now,
  };
};

export const updateLoan = async (
  userId: string,
  loanId: string,
  updates: Partial<Omit<Loan, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
  const loanRef = doc(db, `users/${userId}/loans/${loanId}`);

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    sanitized[key] = value === undefined ? deleteField() : value;
  }

  await updateDoc(loanRef, {
    ...sanitized,
    updatedAt: Timestamp.now(),
  });
};

export const deleteLoan = async (userId: string, loanId: string): Promise<void> => {
  const loanRef = doc(db, `users/${userId}/loans/${loanId}`);
  await deleteDoc(loanRef);
};
