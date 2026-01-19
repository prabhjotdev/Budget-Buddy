import {
  collection,
  getDocs,
  doc,
  getDoc,
  writeBatch,
  setDoc,
  DocumentReference,
} from 'firebase/firestore';
import { db } from './config';

export interface ExportData {
  version: string;
  exportDate: string;
  userId: string;
  collections: {
    [key: string]: Record<string, unknown>[];
  };
  documents: {
    [key: string]: Record<string, unknown>;
  };
}

export interface ImportResult {
  success: boolean;
  message: string;
  collectionsImported: string[];
  totalDocumentsImported: number;
}

// Export all user data to JSON
export const exportAllData = async (userId: string): Promise<ExportData> => {
  const collections_to_export = [
    'paycheckCycles',
    'paymentMethods',
    'bills',
    'spendingTags',
    'spendingTransactions',
    'bufferTransactions',
    'budgetPeriods',
    'categories',
    'transactions',
    'templates',
    'incomeSources',
    'recurringTransactions',
  ];

  const exportData: ExportData = {
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    userId,
    collections: {},
    documents: {},
  };

  // Export collections
  for (const collName of collections_to_export) {
    const collRef = collection(db, `users/${userId}/${collName}`);
    const snapshot = await getDocs(collRef);

    if (!snapshot.empty) {
      exportData.collections[collName] = snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      }));
    }
  }

  // Export single documents (buffer, settings)
  const documentsToExport = [
    { path: 'buffer/main', key: 'buffer' },
    { path: 'settings/main', key: 'settings' },
  ];

  for (const { path, key } of documentsToExport) {
    const docRef = doc(db, `users/${userId}/${path}`);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      exportData.documents[key] = docSnap.data();
    }
  }

  return exportData;
};

// Import data from JSON
export const importAllData = async (
  userId: string,
  data: ExportData,
  overwrite: boolean = false
): Promise<ImportResult> => {
  let totalImported = 0;
  const collectionsImported: string[] = [];

  try {
    // Import collections
    for (const [collName, documents] of Object.entries(data.collections)) {
      if (!documents || documents.length === 0) continue;

      const collRef = collection(db, `users/${userId}/${collName}`);

      // Use batched writes for efficiency (max 500 per batch)
      const batches: Array<Array<{ ref: DocumentReference; data: Record<string, unknown> }>> = [];
      let currentBatch: Array<{ ref: DocumentReference; data: Record<string, unknown> }> = [];

      for (const docData of documents) {
        const { id, ...dataWithoutId } = docData;
        if (typeof id !== 'string') continue; // Skip invalid documents
        const docRef = doc(collRef, id);

        currentBatch.push({ ref: docRef, data: dataWithoutId });

        if (currentBatch.length === 500) {
          batches.push(currentBatch);
          currentBatch = [];
        }
      }

      if (currentBatch.length > 0) {
        batches.push(currentBatch);
      }

      // Execute batches
      for (const batch of batches) {
        const writeBatchInstance = writeBatch(db);
        batch.forEach(({ ref, data: docData }) => {
          writeBatchInstance.set(ref, docData, { merge: !overwrite });
        });
        await writeBatchInstance.commit();
        totalImported += batch.length;
      }

      collectionsImported.push(collName);
    }

    // Import single documents
    for (const [key, docData] of Object.entries(data.documents)) {
      if (!docData) continue;

      const pathMap: { [key: string]: string } = {
        buffer: 'buffer/main',
        settings: 'settings/main',
      };

      const path = pathMap[key];
      if (!path) continue;

      const docRef = doc(db, `users/${userId}/${path}`);
      await setDoc(docRef, docData, { merge: !overwrite });
      collectionsImported.push(key);
      totalImported++;
    }

    return {
      success: true,
      message: `Successfully imported ${totalImported} records from ${collectionsImported.length} collections.`,
      collectionsImported,
      totalDocumentsImported: totalImported,
    };
  } catch (error) {
    console.error('Import error:', error);
    return {
      success: false,
      message: `Failed to import data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      collectionsImported: [],
      totalDocumentsImported: 0,
    };
  }
};

// Download data as JSON file
export const downloadDataAsJson = (data: ExportData, filename?: string) => {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `budget-buddy-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Read JSON file
export const readJsonFile = (file: File): Promise<ExportData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        resolve(data);
      } catch {
        reject(new Error('Invalid JSON file'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
};
