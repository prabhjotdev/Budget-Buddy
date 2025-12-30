import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';
import { Buffer, BufferTransaction } from '../../types';

// Buffer document is stored at users/{userId}/buffer/main
const getBufferRef = (userId: string) => doc(db, `users/${userId}/buffer/main`);
const getBufferTransactionsRef = (userId: string) =>
  collection(db, `users/${userId}/bufferTransactions`);

export const getBuffer = async (userId: string): Promise<Buffer | null> => {
  const docRef = getBufferRef(userId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return snapshot.data() as Buffer;
};

export const initializeBuffer = async (
  userId: string,
  initialAmount: number = 0
): Promise<Buffer> => {
  const docRef = getBufferRef(userId);
  await setDoc(docRef, {
    totalAmount: initialAmount,
    updatedAt: serverTimestamp(),
  });
  const snapshot = await getDoc(docRef);
  return snapshot.data() as Buffer;
};

export const updateBufferAmount = async (
  userId: string,
  newAmount: number
): Promise<void> => {
  const docRef = getBufferRef(userId);
  await setDoc(
    docRef,
    {
      totalAmount: newAmount,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const addToBuffer = async (
  userId: string,
  amount: number,
  reason: string,
  cycleId?: string
): Promise<{ newTotal: number; transactionId: string }> => {
  // Update buffer total
  const bufferRef = getBufferRef(userId);
  const buffer = await getBuffer(userId);
  const currentAmount = buffer?.totalAmount || 0;
  const newTotal = currentAmount + amount;

  await setDoc(
    bufferRef,
    {
      totalAmount: newTotal,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // Add transaction record
  const txRef = await addDoc(getBufferTransactionsRef(userId), {
    type: 'deposit',
    amount,
    reason,
    cycleId: cycleId || null,
    createdAt: serverTimestamp(),
  });

  return { newTotal, transactionId: txRef.id };
};

export const withdrawFromBuffer = async (
  userId: string,
  amount: number,
  reason: string,
  cycleId?: string
): Promise<{ newTotal: number; transactionId: string }> => {
  // Update buffer total
  const bufferRef = getBufferRef(userId);
  const buffer = await getBuffer(userId);
  const currentAmount = buffer?.totalAmount || 0;
  const newTotal = Math.max(0, currentAmount - amount);

  await setDoc(
    bufferRef,
    {
      totalAmount: newTotal,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // Add transaction record
  const txRef = await addDoc(getBufferTransactionsRef(userId), {
    type: 'withdrawal',
    amount,
    reason,
    cycleId: cycleId || null,
    createdAt: serverTimestamp(),
  });

  return { newTotal, transactionId: txRef.id };
};

export const getBufferTransactions = async (
  userId: string,
  limitCount?: number
): Promise<BufferTransaction[]> => {
  let q = query(getBufferTransactionsRef(userId), orderBy('createdAt', 'desc'));
  if (limitCount) {
    q = query(q, limit(limitCount));
  }
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as BufferTransaction);
};
