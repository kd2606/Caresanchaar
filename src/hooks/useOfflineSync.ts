'use client';

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { countPending, isIndexedDbAvailable, tryGetOfflineDb } from '@/lib/db/offline-db';
import {
  syncEngine,
  type SyncOutcome,
  type SyncSnapshot,
  type SyncTrigger,
} from '@/lib/sync/sync-engine';

const PERIODIC_SYNC_MS = 90_000;

function subscribeToNetwork(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

const getNetworkSnapshot = (): boolean => navigator.onLine;
/** Assume connectivity on the server so SSR markup matches the common case. */
const getNetworkServerSnapshot = (): boolean => true;

export interface UseOfflineSyncResult {
  readonly isOnline: boolean;
  readonly isSyncing: boolean;
  readonly phase: SyncSnapshot['phase'];
  readonly pendingCount: number;
  readonly lastSyncedAt: number | null;
  readonly lastError: string | null;
  readonly storageReady: boolean;
  readonly syncPendingData: (trigger?: SyncTrigger) => Promise<SyncOutcome>;
}

export function useOfflineSync(options?: {
  readonly autoSync?: boolean;
}): UseOfflineSyncResult {
  const autoSync = options?.autoSync ?? true;

  const isOnline = useSyncExternalStore(
    subscribeToNetwork,
    getNetworkSnapshot,
    getNetworkServerSnapshot,
  );

  const snapshot = useSyncExternalStore(
    syncEngine.subscribe,
    syncEngine.getSnapshot,
    syncEngine.getServerSnapshot,
  );

  const pendingCount =
    useLiveQuery(async () => {
      const db = tryGetOfflineDb();
      return db === null ? 0 : countPending(db);
    }, [], 0) ?? 0;

  const syncPendingData = useCallback(
    (trigger: SyncTrigger = 'manual'): Promise<SyncOutcome> => syncEngine.requestSync(trigger),
    [],
  );

  // Drain the queue the moment connectivity returns.
  useEffect(() => {
    if (!autoSync || !isOnline || !isIndexedDbAvailable()) return;
    void syncEngine.requestSync('online-event');
  }, [autoSync, isOnline]);

  // Catch up when the worker brings the tab back to the foreground.
  useEffect(() => {
    if (!autoSync) return;
    const onVisible = (): void => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void syncEngine.requestSync('visibility');
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [autoSync]);

  // Safety net for flaky links that never emit an 'online' event.
  useEffect(() => {
    if (!autoSync) return;
    const timer = window.setInterval(() => {
      if (navigator.onLine) void syncEngine.requestSync('interval');
    }, PERIODIC_SYNC_MS);
    return () => window.clearInterval(timer);
  }, [autoSync]);

  return useMemo<UseOfflineSyncResult>(
    () => ({
      isOnline,
      isSyncing: snapshot.phase === 'syncing',
      phase: snapshot.phase,
      pendingCount,
      lastSyncedAt: snapshot.lastSyncCompletedAt,
      lastError: snapshot.lastError,
      storageReady: isIndexedDbAvailable(),
      syncPendingData,
    }),
    [isOnline, snapshot, pendingCount, syncPendingData],
  );
}
