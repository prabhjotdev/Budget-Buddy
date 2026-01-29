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
  deleteField,
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

  // Process the fund data - convert undefined to deleteField() for proper removal
  const processedFund: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fund)) {
    if (value === undefined) {
      processedFund[key] = deleteField();
    } else {
      processedFund[key] = value;
    }
  }

  if (existingFund.exists()) {
    // Update existing fund
    await updateDoc(fundRef, {
      ...processedFund,
      updatedAt: now,
    });

    // Fetch the updated document
    const updatedFund = await getDoc(fundRef);
    return { id: 'main', ...updatedFund.data() } as EmergencyFund;
  } else {
    // Create new fund - filter out deleteField() markers for new documents
    const newFundData: Record<string, unknown> = {
      currentBalance: 0,
    };

    for (const [key, value] of Object.entries(processedFund)) {
      if (value !== deleteField()) {
        newFundData[key] = value;
      }
    }

    newFundData.createdAt = now;
    newFundData.updatedAt = now;

    await setDoc(fundRef, newFundData);
    return { id: 'main', ...newFundData } as EmergencyFund;
  }
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
