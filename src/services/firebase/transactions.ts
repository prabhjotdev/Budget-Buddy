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
  limit,
  startAfter,
  serverTimestamp,
  runTransaction,
  increment,
  Timestamp,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from './config';
import { Transaction } from '../../types';

const getTransactionsRef = (userId: string) => collection(db, `users/${userId}/transactions`);

const PAGE_SIZE = 25;

export const getTransactions = async (
  userId: string,
  filters: {
    periodId?: string;
    categoryId?: string;
    type?: 'expense' | 'income';
  } = {},
  lastDoc?: DocumentSnapshot | null
): Promise<{
  transactions: Transaction[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
}> => {
  let q = query(
    getTransactionsRef(userId),
    orderBy('date', 'desc'),
    limit(PAGE_SIZE + 1)
  );

  if (filters.periodId) {
    q = query(q, where('budgetPeriodId', '==', filters.periodId));
  }
  if (filters.categoryId) {
    q = query(q, where('categoryId', '==', filters.categoryId));
  }
  if (filters.type) {
    q = query(q, where('type', '==', filters.type));
  }
  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }

  const snapshot = await getDocs(q);
  const docs = snapshot.docs;
  const hasMore = docs.length > PAGE_SIZE;

  const transactions = docs
    .slice(0, PAGE_SIZE)
    .map((doc) => ({ id: doc.id, ...doc.data() }) as Transaction);

  const newLastDoc = transactions.length > 0 ? docs[transactions.length - 1] : null;

  return { transactions, lastDoc: newLastDoc, hasMore };
};

export const getRecentTransactions = async (
  userId: string,
  periodId: string,
  limitCount: number = 5
): Promise<Transaction[]> => {
  const q = query(
    getTransactionsRef(userId),
    where('budgetPeriodId', '==', periodId),
    orderBy('date', 'desc'),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Transaction);
};

export const addTransaction = async (
  userId: string,
  transaction: {
    budgetPeriodId: string;
    categoryId: string;
    categoryName: string;
    type: 'expense' | 'income';
    amount: number;
    description: string;
    date: Date;
    recurringTransactionId?: string | null;
  }
): Promise<string> => {
  const transactionRef = doc(getTransactionsRef(userId));

  await runTransaction(db, async (firestoreTransaction) => {
    // Update period totals
    const periodRef = doc(db, `users/${userId}/budgetPeriods/${transaction.budgetPeriodId}`);

    if (transaction.type === 'expense') {
      // Find and update allocation
      const allocationsRef = collection(
        db,
        `users/${userId}/budgetPeriods/${transaction.budgetPeriodId}/allocations`
      );
      const allocQuery = query(allocationsRef, where('categoryId', '==', transaction.categoryId));
      const allocSnap = await getDocs(allocQuery);

      if (!allocSnap.empty) {
        const allocDoc = allocSnap.docs[0];
        firestoreTransaction.update(allocDoc.ref, {
          spentAmount: increment(transaction.amount),
          remainingAmount: increment(-transaction.amount),
          updatedAt: serverTimestamp(),
        });
      }

      firestoreTransaction.update(periodRef, {
        totalSpent: increment(transaction.amount),
        remainingBudget: increment(-transaction.amount),
        updatedAt: serverTimestamp(),
      });
    }

    // Create the transaction
    firestoreTransaction.set(transactionRef, {
      ...transaction,
      date: Timestamp.fromDate(transaction.date),
      recurringTransactionId: transaction.recurringTransactionId || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  return transactionRef.id;
};

export const updateTransaction = async (
  userId: string,
  transactionId: string,
  updates: Partial<Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
  const docRef = doc(db, `users/${userId}/transactions/${transactionId}`);
  const updateData: Record<string, unknown> = { ...updates, updatedAt: serverTimestamp() };
  if (updates.date && updates.date instanceof Date) {
    updateData.date = Timestamp.fromDate(updates.date);
  }
  await updateDoc(docRef, updateData);
};

export const deleteTransaction = async (
  userId: string,
  transactionId: string,
  periodId: string,
  categoryId: string,
  amount: number,
  type: 'expense' | 'income'
): Promise<void> => {
  await runTransaction(db, async (firestoreTransaction) => {
    const transactionRef = doc(db, `users/${userId}/transactions/${transactionId}`);
    const periodRef = doc(db, `users/${userId}/budgetPeriods/${periodId}`);

    if (type === 'expense') {
      // Update allocation
      const allocationsRef = collection(db, `users/${userId}/budgetPeriods/${periodId}/allocations`);
      const allocQuery = query(allocationsRef, where('categoryId', '==', categoryId));
      const allocSnap = await getDocs(allocQuery);

      if (!allocSnap.empty) {
        const allocDoc = allocSnap.docs[0];
        firestoreTransaction.update(allocDoc.ref, {
          spentAmount: increment(-amount),
          remainingAmount: increment(amount),
          updatedAt: serverTimestamp(),
        });
      }

      firestoreTransaction.update(periodRef, {
        totalSpent: increment(-amount),
        remainingBudget: increment(amount),
        updatedAt: serverTimestamp(),
      });
    }

    firestoreTransaction.delete(transactionRef);
  });
};
