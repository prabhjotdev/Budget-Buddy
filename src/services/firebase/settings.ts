import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './config';
import { UserSettings } from '../../types';

const getSettingsRef = (userId: string) => doc(db, `users/${userId}/settings/main`);

export const getUserSettings = async (userId: string): Promise<UserSettings | null> => {
  const docSnap = await getDoc(getSettingsRef(userId));
  if (!docSnap.exists()) return null;
  return docSnap.data() as UserSettings;
};

export const createDefaultSettings = async (userId: string): Promise<UserSettings> => {
  const defaultSettings: UserSettings = {
    payDays: [1, 15],
    currency: 'USD',
    defaultTemplateId: null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  await setDoc(getSettingsRef(userId), {
    ...defaultSettings,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return defaultSettings;
};

export const updateUserSettings = async (
  userId: string,
  updates: Partial<Omit<UserSettings, 'createdAt' | 'updatedAt'>>
): Promise<void> => {
  await updateDoc(getSettingsRef(userId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const getOrCreateSettings = async (userId: string): Promise<UserSettings> => {
  const existing = await getUserSettings(userId);
  if (existing) return existing;
  return createDefaultSettings(userId);
};
