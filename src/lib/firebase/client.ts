'use client';

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  type Firestore,
} from 'firebase/firestore';

interface FirebaseClientConfig {
  readonly apiKey: string;
  readonly authDomain: string;
  readonly projectId: string;
  readonly storageBucket: string;
  readonly messagingSenderId: string;
  readonly appId: string;
}

function readConfig(): FirebaseClientConfig {
  const raw = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const missing = Object.entries(raw)
    .filter(([, value]) => value === undefined || value.length === 0)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Firebase client config incomplete. Missing: ${missing.join(', ')}`);
  }

  return raw as FirebaseClientConfig;
}

let appRef: FirebaseApp | null = null;
let firestoreRef: Firestore | null = null;
let authRef: Auth | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (appRef !== null) return appRef;
  appRef = getApps().length > 0 ? getApp() : initializeApp(readConfig());
  return appRef;
}

export function getDb(): Firestore {
  if (firestoreRef !== null) return firestoreRef;
  try {
    firestoreRef = initializeFirestore(getFirebaseApp(), {
      // Dexie is the durable offline store; keep Firestore's cache ephemeral.
      localCache: memoryLocalCache(),
      // Rural networks sit behind proxies that break gRPC streaming.
      experimentalAutoDetectLongPolling: true,
    });
  } catch {
    // Already initialized (Next.js HMR / React Strict Mode re-render)
    firestoreRef = getFirestore(getFirebaseApp());
  }
  return firestoreRef;
}

export function getFirebaseAuth(): Auth {
  authRef ??= getAuth(getFirebaseApp());
  return authRef;
}

export const auth = getFirebaseAuth();
