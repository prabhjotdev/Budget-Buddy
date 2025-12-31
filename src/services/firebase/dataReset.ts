import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './config';

// Delete all documents in a collection
const deleteCollection = async (userId: string, collectionName: string): Promise<number> => {
  const collRef = collection(db, `users/${userId}/${collectionName}`);
  const snapshot = await getDocs(collRef);

  if (snapshot.empty) return 0;

  const batch = writeBatch(db);
  snapshot.docs.forEach((document) => {
    batch.delete(document.ref);
  });
  await batch.commit();

  return snapshot.size;
};

// Delete a single document
const deleteDocument = async (userId: string, path: string): Promise<void> => {
  const docRef = doc(db, `users/${userId}/${path}`);
  try {
    await deleteDoc(docRef);
  } catch {
    // Document may not exist, ignore error
  }
};

export interface ResetResult {
  collectionsCleared: string[];
  totalDocumentsDeleted: number;
}

// Reset all paycheck system data
export const resetPaycheckData = async (userId: string): Promise<ResetResult> => {
  const collections = [
    'paycheckCycles',
    'paymentMethods',
    'bills',
    'spendingTags',
    'spendingTransactions',
    'bufferTransactions',
  ];

  let totalDeleted = 0;
  const cleared: string[] = [];

  for (const collName of collections) {
    const count = await deleteCollection(userId, collName);
    if (count > 0) {
      cleared.push(collName);
      totalDeleted += count;
    }
  }

  // Also delete the buffer document
  await deleteDocument(userId, 'buffer/main');
  cleared.push('buffer');

  return {
    collectionsCleared: cleared,
    totalDocumentsDeleted: totalDeleted,
  };
};

// Reset legacy system data
export const resetLegacyData = async (userId: string): Promise<ResetResult> => {
  const collections = [
    'budgetPeriods',
    'categories',
    'transactions',
    'templates',
    'incomeSources',
    'recurringTransactions',
  ];

  let totalDeleted = 0;
  const cleared: string[] = [];

  for (const collName of collections) {
    const count = await deleteCollection(userId, collName);
    if (count > 0) {
      cleared.push(collName);
      totalDeleted += count;
    }
  }

  return {
    collectionsCleared: cleared,
    totalDocumentsDeleted: totalDeleted,
  };
};

// Reset ALL data (both systems)
export const resetAllData = async (userId: string): Promise<ResetResult> => {
  const paycheckResult = await resetPaycheckData(userId);
  const legacyResult = await resetLegacyData(userId);

  return {
    collectionsCleared: [...paycheckResult.collectionsCleared, ...legacyResult.collectionsCleared],
    totalDocumentsDeleted: paycheckResult.totalDocumentsDeleted + legacyResult.totalDocumentsDeleted,
  };
};
