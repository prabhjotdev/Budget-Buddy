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
import { PaymentMethod } from '../../types';

const getPaymentMethodsRef = (userId: string) =>
  collection(db, `users/${userId}/paymentMethods`);

export const getPaymentMethods = async (userId: string): Promise<PaymentMethod[]> => {
  const q = query(getPaymentMethodsRef(userId), orderBy('sortOrder'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as PaymentMethod);
};

export const createPaymentMethod = async (
  userId: string,
  paymentMethod: Omit<PaymentMethod, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const docRef = await addDoc(getPaymentMethodsRef(userId), {
    ...paymentMethod,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const updatePaymentMethod = async (
  userId: string,
  paymentMethodId: string,
  updates: Partial<Omit<PaymentMethod, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
  const docRef = doc(db, `users/${userId}/paymentMethods/${paymentMethodId}`);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const deletePaymentMethod = async (
  userId: string,
  paymentMethodId: string
): Promise<void> => {
  const docRef = doc(db, `users/${userId}/paymentMethods/${paymentMethodId}`);
  await deleteDoc(docRef);
};

// Create default payment methods for new users
export const createDefaultPaymentMethods = async (userId: string): Promise<void> => {
  const defaults: Omit<PaymentMethod, 'id' | 'createdAt' | 'updatedAt'>[] = [
    {
      name: 'Cash',
      type: 'cash',
      isDefault: false,
      isActive: true,
      sortOrder: 0,
    },
    {
      name: 'Debit Card',
      type: 'debit',
      isDefault: true,
      isActive: true,
      sortOrder: 1,
    },
  ];

  for (const pm of defaults) {
    await createPaymentMethod(userId, pm);
  }
};
