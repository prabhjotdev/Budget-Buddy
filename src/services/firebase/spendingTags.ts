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
  increment,
} from 'firebase/firestore';
import { db } from './config';
import { SpendingTag } from '../../types';

const getTagsRef = (userId: string) => collection(db, `users/${userId}/spendingTags`);

export const getSpendingTags = async (userId: string): Promise<SpendingTag[]> => {
  const q = query(getTagsRef(userId), orderBy('usageCount', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as SpendingTag);
};

export const createSpendingTag = async (
  userId: string,
  tag: Omit<SpendingTag, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const docRef = await addDoc(getTagsRef(userId), {
    ...tag,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const updateSpendingTag = async (
  userId: string,
  tagId: string,
  updates: Partial<Omit<SpendingTag, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
  const docRef = doc(db, `users/${userId}/spendingTags/${tagId}`);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const incrementTagUsage = async (userId: string, tagId: string): Promise<void> => {
  const docRef = doc(db, `users/${userId}/spendingTags/${tagId}`);
  await updateDoc(docRef, {
    usageCount: increment(1),
    updatedAt: serverTimestamp(),
  });
};

export const deleteSpendingTag = async (userId: string, tagId: string): Promise<void> => {
  const docRef = doc(db, `users/${userId}/spendingTags/${tagId}`);
  await deleteDoc(docRef);
};

// Create default spending tags for new users
export const createDefaultSpendingTags = async (userId: string): Promise<void> => {
  const defaults = [
    'Groceries',
    'Gas',
    'Food & Dining',
    'Shopping',
    'Entertainment',
    'Transportation',
    'Health',
    'Personal',
    'Home',
    'Other',
  ];

  for (const name of defaults) {
    await createSpendingTag(userId, {
      name,
      isCustom: false,
      usageCount: 0,
    });
  }
};
