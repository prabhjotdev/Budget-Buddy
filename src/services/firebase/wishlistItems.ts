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
import { WishlistItem } from '../../types';

const getWishlistRef = (userId: string) => collection(db, `users/${userId}/wishlistItems`);

export const getWishlistItems = async (userId: string): Promise<WishlistItem[]> => {
  const q = query(getWishlistRef(userId), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as WishlistItem);
};

export const createWishlistItem = async (
  userId: string,
  item: Omit<WishlistItem, 'id' | 'createdAt' | 'updatedAt' | 'isPurchased'>
): Promise<string> => {
  const docRef = await addDoc(getWishlistRef(userId), {
    ...item,
    isPurchased: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const updateWishlistItem = async (
  userId: string,
  itemId: string,
  updates: Partial<Omit<WishlistItem, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
  const docRef = doc(db, `users/${userId}/wishlistItems/${itemId}`);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const markItemPurchased = async (
  userId: string,
  itemId: string
): Promise<void> => {
  const docRef = doc(db, `users/${userId}/wishlistItems/${itemId}`);
  await updateDoc(docRef, {
    isPurchased: true,
    purchasedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const deleteWishlistItem = async (userId: string, itemId: string): Promise<void> => {
  const docRef = doc(db, `users/${userId}/wishlistItems/${itemId}`);
  await deleteDoc(docRef);
};
