import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';
import { BudgetTemplate, TemplateAllocation } from '../../types';

const getTemplatesRef = (userId: string) => collection(db, `users/${userId}/templates`);

export const getTemplates = async (userId: string): Promise<BudgetTemplate[]> => {
  const q = query(getTemplatesRef(userId), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as BudgetTemplate);
};

export const getTemplate = async (
  userId: string,
  templateId: string
): Promise<BudgetTemplate | null> => {
  const docRef = doc(db, `users/${userId}/templates/${templateId}`);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as BudgetTemplate;
};

export const createTemplate = async (
  userId: string,
  template: {
    name: string;
    description: string;
    allocations: TemplateAllocation[];
    isDefault: boolean;
  }
): Promise<string> => {
  const docRef = await addDoc(getTemplatesRef(userId), {
    ...template,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const updateTemplate = async (
  userId: string,
  templateId: string,
  updates: Partial<Omit<BudgetTemplate, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
  const docRef = doc(db, `users/${userId}/templates/${templateId}`);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const deleteTemplate = async (userId: string, templateId: string): Promise<void> => {
  const docRef = doc(db, `users/${userId}/templates/${templateId}`);
  await deleteDoc(docRef);
};
