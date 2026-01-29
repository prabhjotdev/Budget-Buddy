import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  Timestamp,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from './config';
import { EmergencyFund, EmergencyFundTransaction } from '../../types/emergencyFund';

// Get emergency fund
export const getEmergencyFund = async (userId: string): Promise<EmergencyFund | null> => {
  const fundRef = doc(db, `users/${userId}/emergencyFund/main`);
  const fundSnap = await getDoc(fundRef);

  if (fundSnap.exists()) {
    return { id: fundSnap.id, ...fundSnap.data() } as EmergencyFund;
  }
  return null;
};

// Create or update emergency fund
export const saveEmergencyFund = async (
  userId: string,
  fund: Partial<EmergencyFund>
): Promise<EmergencyFund> => {
  const fundRef = doc(db, `users/${userId}/emergencyFund/main`);
  const now = Timestamp.now();

  const existingFund = await getDoc(fundRef);
  const fundData = existingFund.exists()
    ? { ...existingFund.data(), ...fund, updatedAt: now }
    : { currentBalance: 0, ...fund, createdAt: now, updatedAt: now };

  await setDoc(fundRef, fundData);
  return { id: 'main', ...fundData } as EmergencyFund;
};

// Get all transactions
export const getEmergencyFundTransactions = async (
  userId: string
): Promise<EmergencyFundTransaction[]> => {
  const transactionsRef = collection(db, `users/${userId}/emergencyFundTransactions`);
  const q = query(transactionsRef, orderBy('date', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as EmergencyFundTransaction[];
};

// Add transaction
export const addEmergencyFundTransaction = async (
  userId: string,
  transaction: Omit<EmergencyFundTransaction, 'id' | 'createdAt'>
): Promise<EmergencyFundTransaction> => {
  const transactionsRef = collection(db, `users/${userId}/emergencyFundTransactions`);
  const now = Timestamp.now();

  const docRef = await addDoc(transactionsRef, {
    ...transaction,
    createdAt: now,
  });

  return {
    id: docRef.id,
    ...transaction,
    createdAt: now,
  };
};

// Delete transaction
export const deleteEmergencyFundTransaction = async (
  userId: string,
  transactionId: string
): Promise<void> => {
  const transactionRef = doc(db, `users/${userId}/emergencyFundTransactions/${transactionId}`);
  await deleteDoc(transactionRef);
};

// Update emergency fund balance
export const updateEmergencyFundBalance = async (
  userId: string,
  newBalance: number
): Promise<void> => {
  const fundRef = doc(db, `users/${userId}/emergencyFund/main`);
  await updateDoc(fundRef, {
    currentBalance: newBalance,
    updatedAt: Timestamp.now(),
  });
};
