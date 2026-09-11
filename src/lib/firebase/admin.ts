// src/lib/firebase/admin.ts
// Crash-proof, lazily-initialised Firebase Admin singleton.
// Every export returns `null` on failure and NEVER throws.

import {
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import {
  getFirestore,
  initializeFirestore,
  type Firestore,
} from 'firebase-admin/firestore';

const APP_NAME = 'district-admin';

/**
 * Cache on globalThis so Next.js dev HMR and warm Vercel lambdas reuse the
 * same instance instead of re-initialising (which triggers duplicate-app
 * warnings and wasted gRPC channels).
 */
type AdminCache = {
  app: App | null;
  db: Firestore | null;
  auth: Auth | null;
  initialised: boolean;
  error: string | null;
};

const globalForAdmin = globalThis as unknown as {
  __firebaseAdminCache?: AdminCache;
};

const cache: AdminCache =
  globalForAdmin.__firebaseAdminCache ??
  (globalForAdmin.__firebaseAdminCache = {
    app: null,
    db: null,
    auth: null,
    initialised: false,
    error: null,
  });

/** Reads and normalises the credential from whichever env var is present. */
function resolveServiceAccount(): ServiceAccount | null {
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

    if (raw && raw.trim().length > 0) {
      // Defensive clean-up: strip accidental wrapping quotes and any
      // whitespace/newlines that Vercel's UI or a shell pipe may have added.
      let cleaned = raw.trim().replace(/^['"]|['"]$/g, '').replace(/\s/g, '');

      let json: string;
      if (cleaned.startsWith('{')) {
        // Someone pasted raw JSON instead of Base64 — handle it anyway.
        json = raw.trim();
      } else {
        // Convert URL-safe Base64 to standard Base64 before decoding.
        cleaned = cleaned.replace(/-/g, '+').replace(/_/g, '/');
        json = Buffer.from(cleaned, 'base64').toString('utf8');
      }

      const parsed = JSON.parse(json) as {
        project_id?: string;
        projectId?: string;
        client_email?: string;
        clientEmail?: string;
        private_key?: string;
        privateKey?: string;
      };

      const projectId = parsed.project_id ?? parsed.projectId;
      const clientEmail = parsed.client_email ?? parsed.clientEmail;
      const privateKey = (parsed.private_key ?? parsed.privateKey ?? '')
        .replace(/\\n/g, '\n')
        .trim();

      if (!projectId || !clientEmail || !privateKey) {
        cache.error = 'Decoded service account is missing required fields.';
        return null;
      }
      if (!privateKey.includes('BEGIN PRIVATE KEY')) {
        cache.error = 'Decoded private_key is not a valid PEM block.';
        return null;
      }

      return { projectId, clientEmail, privateKey };
    }

    // Fallback: legacy three-variable setup, kept so an older Vercel
    // environment still boots instead of hard-failing.
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const legacyKey = process.env.FIREBASE_PRIVATE_KEY;

    if (projectId && clientEmail && legacyKey) {
      const privateKey = legacyKey
        .replace(/^['"]|['"]$/g, '')
        .replace(/\\n/g, '\n')
        .trim();

      if (!privateKey.includes('BEGIN PRIVATE KEY')) {
        cache.error = 'FIREBASE_PRIVATE_KEY is not a valid PEM block.';
        return null;
      }
      return { projectId, clientEmail, privateKey };
    }

    cache.error = 'No Firebase credentials found in the environment.';
    return null;
  } catch (err) {
    cache.error =
      err instanceof Error
        ? `Credential parse failed: ${err.message}`
        : 'Credential parse failed.';
    return null;
  }
}

/** Idempotent initialiser. Returns the App or null. Never throws. */
export function getAdminApp(): App | null {
  if (cache.initialised) return cache.app;
  cache.initialised = true;

  try {
    const existing = getApps().find((a) => a.name === APP_NAME);
    if (existing) {
      cache.app = existing;
      return cache.app;
    }

    const serviceAccount = resolveServiceAccount();
    if (!serviceAccount) {
      cache.app = null;
      return null;
    }

    cache.app = initializeApp(
      {
        credential: cert(serviceAccount),
        projectId: serviceAccount.projectId,
      },
      APP_NAME,
    );

    cache.error = null;
    return cache.app;
  } catch (err) {
    cache.error =
      err instanceof Error
        ? `initializeApp failed: ${err.message}`
        : 'initializeApp failed.';
    cache.app = null;
    return null;
  }
}

/** Firestore client, or null. Never throws. */
export function getAdminDb(): Firestore | null {
  if (cache.db) return cache.db;

  const app = getAdminApp();
  if (!app) return null;

  try {
    // preferRest avoids opening long-lived gRPC streams, which are the main
    // cause of hangs and socket errors inside short-lived Vercel lambdas.
    cache.db = initializeFirestore(app, {
      preferRest: true,
    });
  } catch {
    // Already initialised on a warm lambda — just grab the existing instance.
    try {
      cache.db = getFirestore(app);
    } catch (err) {
      cache.error =
        err instanceof Error
          ? `getFirestore failed: ${err.message}`
          : 'getFirestore failed.';
      cache.db = null;
    }
  }

  return cache.db;
}

/** Auth client, or null. Never throws. */
export function getAdminAuth(): Auth | null {
  if (cache.auth) return cache.auth;

  const app = getAdminApp();
  if (!app) return null;

  try {
    cache.auth = getAuth(app);
  } catch (err) {
    cache.error =
      err instanceof Error
        ? `getAuth failed: ${err.message}`
        : 'getAuth failed.';
    cache.auth = null;
  }

  return cache.auth;
}

/** Non-sensitive diagnostic string for logs and health checks. */
export function getAdminInitError(): string | null {
  return cache.error;
}

export function isAdminReady(): boolean {
  return getAdminApp() !== null;
}

// ──────────────────────────────────────────────────────────────────
// Backward-compatible aliases so existing call-sites that import
// `adminDb` / `adminAuth` keep working without modifications.
// ──────────────────────────────────────────────────────────────────
export const adminDb = getAdminDb;
export const adminAuth = getAdminAuth;