import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore, memoryLocalCache } from "firebase/firestore";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim(),
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim(),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim(),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim(),
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim(),
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim(),
};

// Guard initialization to prevent errors during build time when env vars might be missing
const isConfigValid = !!firebaseConfig.apiKey;

let app;
if (isConfigValid) {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
} else {
    // During build, we might not have the config. Mock slightly to avoid crashes,
    // but the app should handle null auth/db gracefully.
    app = null;
}

const auth = app ? getAuth(app) : null as any;

let db: any;
if (app) {
    // Only disable IndexedDB cache for worker/district routes to protect PII
    // B2C patient routes keep default persistence behavior
    const isStaffRoute = typeof window !== 'undefined' && 
        (window.location.pathname.includes('/worker') || window.location.pathname.includes('/district'));
        
    if (isStaffRoute) {
        try {
            db = initializeFirestore(app, { localCache: memoryLocalCache() });
        } catch {
            // Already initialized (Next.js HMR / React Strict Mode re-render)
            db = getFirestore(app);
        }
    } else {
        db = getFirestore(app);
    }
} else {
    db = null as any;
}

export { app, auth, db };

