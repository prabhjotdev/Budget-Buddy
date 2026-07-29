import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Enable Firestore's persistent (IndexedDB) local cache so reads are served
// instantly from disk and synced with the server in the background. This
// survives reloads and is shared across tabs, and adds offline support.
// Falls back to an in-memory cache in environments where IndexedDB is
// unavailable (e.g. some private-browsing modes / older browsers).
let firestore: Firestore;
try {
  firestore = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch (error) {
  console.warn(
    'Firestore persistent cache unavailable; falling back to in-memory cache.',
    error
  );
  firestore = initializeFirestore(app, {});
}

export const db = firestore;
export const googleProvider = new GoogleAuthProvider();

export default app;
