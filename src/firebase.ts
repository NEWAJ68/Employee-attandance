import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Initialize Firestore with resilient multi-tab offline local cache persistence
let dbInstance;
try {
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  }, (firebaseConfig as any).firestoreDatabaseId);
  console.log("Firestore successfully initialized with persistent multi-tab localCache.");
} catch (cacheErr) {
  console.warn("Firestore multi-tab persistence not supported in this client environment, falling back to clean memory-only instance:", cacheErr);
  try {
    dbInstance = initializeFirestore(app, {}, (firebaseConfig as any).firestoreDatabaseId);
  } catch (err2) {
    dbInstance = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
  }
}

export const db = dbInstance;

export const auth = getAuth();
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection test with a fast, non-blocking timeout fallback to detect offline environments gracefully
export async function testConnection(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Firebase connection check timed out')), 3500)
    );
    await Promise.race([
      getDocFromServer(doc(db, 'test', 'connection')),
      timeout
    ]);
    return true;
  } catch (error: any) {
    // If the server explicitly returns a Firestore error code (like permission-denied or unauthenticated),
    // it means we successfully contacted the Google Cloud Firestore endpoint and got a real-time response.
    if (error && (
      error.code === 'permission-denied' || 
      error.code === 'unauthenticated' || 
      error.code === 'not-found' ||
      error.message?.includes('permission-denied') ||
      error.message?.includes('unauthenticated')
    )) {
      console.log("Firestore connection verified (server responded):", error.code || error.message);
      return true;
    }
    console.info("Firestore status log: Operating in offline/local state. Cache/IndexedDB is active. Details:", error?.message || error);
    return false;
  }
}

// Trigger initial connection test silently
testConnection();

/**
 * Recursively removes any keys with `undefined` values from an object,
 * preventing Firestore validation errors "Unsupported field value: undefined".
 */
export function cleanFirestoreData<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanFirestoreData(item)) as any;
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key of Object.keys(obj)) {
      const val = (obj as any)[key];
      if (val !== undefined) {
        cleaned[key] = cleanFirestoreData(val);
      }
    }
    return cleaned;
  }
  return obj;
}
