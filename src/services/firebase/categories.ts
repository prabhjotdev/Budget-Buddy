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
  writeBatch,
} from 'firebase/firestore';
import { db } from './config';
import { Category } from '../../types';
import { DEFAULT_CATEGORIES } from '../../constants';

const getCategoriesRef = (userId: string) => collection(db, `users/${userId}/categories`);

export const getCategories = async (userId: string): Promise<Category[]> => {
  const q = query(getCategoriesRef(userId), orderBy('sortOrder'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Category);
};

export const createCategory = async (
  userId: string,
  category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const docRef = await addDoc(getCategoriesRef(userId), {
    ...category,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const updateCategory = async (
  userId: string,
  categoryId: string,
  updates: Partial<Omit<Category, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
  const docRef = doc(db, `users/${userId}/categories/${categoryId}`);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const deleteCategory = async (userId: string, categoryId: string): Promise<void> => {
  const docRef = doc(db, `users/${userId}/categories/${categoryId}`);
  await deleteDoc(docRef);
};

export const createDefaultCategories = async (userId: string): Promise<void> => {
  const batch = writeBatch(db);

  DEFAULT_CATEGORIES.forEach((cat, index) => {
    const docRef = doc(getCategoriesRef(userId));
    batch.set(docRef, {
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      parentId: null,
      sortOrder: index,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
};
