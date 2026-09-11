// src/lib/offlineSkinScans.ts
// IndexedDB-backed offline queue for skin scan requests.
// localStorage is NOT suitable here — base64 images can be 6-8MB each,
// which immediately blows the 5MB localStorage quota.
// IndexedDB has no practical size limit on most browsers.

import { logger } from '@/lib/logger';

// --- Types ---
export interface OfflineSkinScan {
  id: string;
  userId: string;
  imageBase64: string;
  itchingLevel: string;
  spreadRate: string;
  recentChanges: string;
  enqueuedAtIso: string;
  retryCount: number;
}

// --- Constants ---
const DB_NAME = 'pulsecheck_offline';
const DB_VERSION = 1;
const STORE_NAME = 'skin_scans';

// --- DB Access ---
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txPromise<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.onerror = () => reject(tx.error);
  });
}

// --- Public API ---

/**
 * Saves a skin scan request to IndexedDB for later retry.
 * Safe for large base64 payloads (6-8MB) that would exceed localStorage limits.
 */
export async function saveOfflineSkinScan(scanData: {
  userId: string;
  imageBase64: string;
  itchingLevel: string;
  spreadRate: string;
  recentChanges: string;
}): Promise<void> {
  if (typeof indexedDB === 'undefined') {
    logger.error('offlineSkinScans: IndexedDB not available');
    throw new Error('Offline storage not available in this browser.');
  }

  const record: OfflineSkinScan = {
    id: `skin_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...scanData,
    enqueuedAtIso: new Date().toISOString(),
    retryCount: 0,
  };

  const db = await openDB();
  try {
    await txPromise(db, STORE_NAME, 'readwrite', (store) => store.put(record));
    logger.info('offlineSkinScans: saved', { id: record.id, userId: scanData.userId });
  } finally {
    // db.close() omitted to prevent interrupting IDB transactions
  }
}

/**
 * Reads all queued skin scans from IndexedDB.
 */
export async function getOfflineSkinScans(): Promise<OfflineSkinScan[]> {
  if (typeof indexedDB === 'undefined') return [];

  const db = await openDB();
  try {
    return await txPromise(db, STORE_NAME, 'readonly', (store) => store.getAll());
  } finally {
    // db.close() omitted to prevent interrupting IDB transactions
  }
}

/**
 * Removes a single scan from the queue after successful upload.
 */
async function removeScan(id: string): Promise<void> {
  const db = await openDB();
  try {
    await txPromise(db, STORE_NAME, 'readwrite', (store) => store.delete(id));
  } finally {
    // db.close() omitted to prevent interrupting IDB transactions
  }
}

/**
 * Increments the retry count for a failed flush attempt.
 */
async function incrementRetry(scan: OfflineSkinScan): Promise<void> {
  const db = await openDB();
  try {
    await txPromise(db, STORE_NAME, 'readwrite', (store) =>
      store.put({ ...scan, retryCount: scan.retryCount + 1 })
    );
  } finally {
    // db.close() omitted to prevent interrupting IDB transactions
  }
}

/**
 * Drains the offline queue by re-submitting each scan to /api/skin-scan.
 * Call on app startup and on 'online' event.
 *
 * - Successful uploads are removed from the store.
 * - Retryable failures increment retryCount; items with retryCount >= 10 are dropped.
 * - Non-retryable failures are dropped immediately.
 */
export async function flushOfflineSkinScans(): Promise<{ flushed: number; remaining: number }> {
  if (typeof indexedDB === 'undefined' || !navigator.onLine) {
    const scans = await getOfflineSkinScans();
    return { flushed: 0, remaining: scans.length };
  }

  const scans = await getOfflineSkinScans();
  if (scans.length === 0) return { flushed: 0, remaining: 0 };

  let flushed = 0;
  let remaining = 0;

  for (const scan of scans) {
    try {
      const res = await fetch('/api/skin-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: scan.imageBase64,
          itchingLevel: scan.itchingLevel,
          spreadRate: scan.spreadRate,
          recentChanges: scan.recentChanges,
        }),
      });

      if (res.ok) {
        await removeScan(scan.id);
        flushed++;
        logger.info('offlineSkinScans: flushed', { id: scan.id });
      } else if (res.status === 503) {
        // Still at capacity — stop flushing, try again later.
        remaining = scans.length - flushed;
        logger.warn('offlineSkinScans: still at capacity, stopping flush');
        break;
      } else {
        // Non-retryable server error — drop after too many attempts.
        if (scan.retryCount >= 10) {
          await removeScan(scan.id);
          logger.error('offlineSkinScans: dropped after max retries', { id: scan.id });
        } else {
          await incrementRetry(scan);
          remaining++;
        }
      }
    } catch (err) {
      // Network error — stop flushing.
      remaining = scans.length - flushed;
      logger.warn('offlineSkinScans: network error during flush', { err });
      break;
    }
  }

  if (flushed > 0) {
    logger.info('offlineSkinScans: flush complete', { flushed, remaining });
  }
  return { flushed, remaining };
}

/**
 * Wire up auto-flush on 'online' event. Call once in your root client component.
 */
export function initOfflineSkinScanSync(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => {
    void flushOfflineSkinScans();
  });
  // Opportunistic flush on load.
  void flushOfflineSkinScans();
}
