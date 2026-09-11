'use client';

import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';

import { describeUnknown } from '@/lib/core/result';
import { getDeviceId } from '@/lib/core/ids';
import { pushOfflineAssignments } from './facility-sync';
import {
  appendJournal,
  getOfflineDb,
  isIndexedDbAvailable,
  SYNCABLE_TABLES,
  type OfflineWorkerDB,
} from '@/lib/db/offline-db';
import type { SyncableEntity, SyncableRecord } from '@/lib/db/types';
import { getDb, getFirebaseAuth } from '@/lib/firebase/client';

/** Firestore caps a WriteBatch at 500 ops; stay well under to leave headroom. */
const BATCH_SIZE = 400;
const MAX_ROWS_PER_CYCLE = 2_000;
const MAX_ATTEMPTS = 8;
const BASE_BACKOFF_MS = 15_000;
const MAX_BACKOFF_MS = 6 * 60 * 60 * 1000;


const REMOTE_COLLECTIONS: Readonly<Record<SyncableEntity, string>> = {
  patients: 'patients',
  triage_records: 'triage_records',
  referrals: 'referrals',
    consents: 'consents',
  };

export type SyncPhase = 'idle' | 'syncing' | 'error';

export interface SyncSnapshot {
  readonly phase: SyncPhase;
  readonly lastSyncStartedAt: number | null;
  readonly lastSyncCompletedAt: number | null;
  readonly lastError: string | null;
  readonly lastPushedCount: number;
}

export interface SyncOutcome {
  readonly pushed: number;
  readonly failed: number;
  readonly quarantined: number;
  readonly skippedBackoff: number;
}

export type SyncTrigger =
  | 'manual'
  | 'online-event'
  | 'mount'
  | 'visibility'
  | 'interval'
  | 'post-intake';

const IDLE_SNAPSHOT: SyncSnapshot = {
  phase: 'idle',
  lastSyncStartedAt: null,
  lastSyncCompletedAt: null,
  lastError: null,
  lastPushedCount: 0,
};

function backoffFor(attempts: number): number {
  const delay = BASE_BACKOFF_MS * 2 ** Math.min(attempts, 12);
  const jitter = Math.floor(Math.random() * BASE_BACKOFF_MS);
  return Math.min(delay + jitter, MAX_BACKOFF_MS);
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Strips local bookkeeping and stamps server-authoritative metadata. */
function toRemotePayload(record: SyncableRecord, uid: string): Record<string, unknown> {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const {
    sync_status: _status,
    sync_attempts: _attempts,
    next_attempt_at: _next,
    last_sync_error: _error,
    ...shareable
  } = record;
  /* eslint-enable @typescript-eslint/no-unused-vars */

  return {
    ...shareable,
    owner_uid: uid,
    client_updated_at: record.updated_at,
    client_rev: record.rev,
    synced_at: serverTimestamp(),
  };
}

interface InFlightRow {
  readonly id: string;
  readonly rev: number;
}

class SyncEngine {
  private snapshot: SyncSnapshot = IDLE_SNAPSHOT;
  private readonly listeners = new Set<() => void>();
  private inFlight: Promise<SyncOutcome> | null = null;

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public getSnapshot = (): SyncSnapshot => this.snapshot;

  /** Stable reference for useSyncExternalStore during SSR. */
  public getServerSnapshot = (): SyncSnapshot => IDLE_SNAPSHOT;

  private emit(patch: Partial<SyncSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }

  /**
   * Coalescing entry point. Concurrent callers share one in-flight cycle,
   * so a burst of intakes cannot stampede Firestore.
   */
  public requestSync(trigger: SyncTrigger = 'manual'): Promise<SyncOutcome> {
    if (this.inFlight !== null) return this.inFlight;

    const run = this.runGuarded(trigger).finally(() => {
      this.inFlight = null;
    });
    this.inFlight = run;
    return run;
  }

  private async runGuarded(trigger: SyncTrigger): Promise<SyncOutcome> {
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    if (locks === undefined) return this.run(trigger);

    // Cross-tab exclusion: only one tab syncs at a time.
    return (locks.request('caresanchaar.sync', { ifAvailable: true }, async (lock) => {
      if (lock === null) return { pushed: 0, failed: 0, quarantined: 0, skippedBackoff: 0 };
      return this.run(trigger);
    }) as unknown) as Promise<SyncOutcome>;
  }

  private async run(_trigger: SyncTrigger): Promise<SyncOutcome> {
    const empty: SyncOutcome = { pushed: 0, failed: 0, quarantined: 0, skippedBackoff: 0 };

    if (!isIndexedDbAvailable()) return empty;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return empty;

    this.emit({ phase: 'syncing', lastSyncStartedAt: Date.now(), lastError: null });

    // Zero-Trust gate #1: an authenticated principal with a fresh token.
    const user = getFirebaseAuth().currentUser;
    if (user === null) {
      this.emit({ phase: 'error', lastError: 'Not signed in — sync withheld.' });
      return empty;
    }

    let claims: Readonly<Record<string, unknown>>;
    try {
      const token = await user.getIdTokenResult();
      claims = token.claims;
    } catch (error) {
      this.emit({ phase: 'error', lastError: describeUnknown(error) });
      return empty;
    }

    // Zero-Trust gate #2: role asserted by custom claims, not by client state.
    if (claims['role'] !== 'worker' && claims['role'] !== 'asha') {
      this.emit({ phase: 'error', lastError: 'Account lacks the worker role.' });
      return empty;
    }

    const db = getOfflineDb();
    const remote = getDb();
    const totals = { pushed: 0, failed: 0, quarantined: 0, skippedBackoff: 0 };

    try {
      for (const entity of SYNCABLE_TABLES) {
        const result = await this.pushEntity(db, remote, entity, user.uid);
        totals.pushed += result.pushed;
        totals.failed += result.failed;
        totals.quarantined += result.quarantined;
        totals.skippedBackoff += result.skippedBackoff;
        }

        // Drain offline assignments
        await pushOfflineAssignments();

      this.emit({
        phase: totals.failed > 0 ? 'error' : 'idle',
        lastSyncCompletedAt: Date.now(),
        lastPushedCount: totals.pushed,
        lastError: totals.failed > 0 ? `${totals.failed} record(s) failed to upload.` : null,
      });
      return totals;
    } catch (error) {
      this.emit({ phase: 'error', lastError: describeUnknown(error) });
      return totals;
    }
  }

  private async pushEntity(
    db: OfflineWorkerDB,
    remote: Firestore,
    entity: SyncableEntity,
    uid: string,
  ): Promise<SyncOutcome> {
    const now = Date.now();

    const candidates = (await db[entity]
      .where('[sync_status+next_attempt_at]')
      .between(['pending', Dexie_MIN], ['pending', now], true, true)
      .limit(MAX_ROWS_PER_CYCLE)
      .toArray()) as SyncableRecord[];

    const eligible = candidates.filter((row) => row.sync_attempts < MAX_ATTEMPTS);
    const skippedBackoff = candidates.length - eligible.length;

    // Zero-Trust gate #3: never upload another worker's rows under this token.
    const owned = eligible.filter((row) => row.created_by === uid);
    const foreign = eligible.filter((row) => row.created_by !== uid);
    for (const row of foreign) {
      await this.quarantine(db, entity, row);
    }

    if (owned.length === 0) {
      return { pushed: 0, failed: 0, quarantined: foreign.length, skippedBackoff };
    }

    const collectionRef = collection(remote, REMOTE_COLLECTIONS[entity]);
    let pushed = 0;
    let failed = 0;

    for (const group of chunk(owned, BATCH_SIZE)) {
      const batch = writeBatch(remote);
      const inFlight: InFlightRow[] = [];

      for (const row of group) {
        // merge:true + client-generated id ⇒ replay-safe, no duplicates.
        batch.set(doc(collectionRef, row.id), toRemotePayload(row, uid), { merge: true });
        inFlight.push({ id: row.id, rev: row.rev });
      }

      try {
        await batch.commit();
        pushed += await this.markSynced(db, entity, inFlight);
      } catch (error) {
        failed += group.length;
        await this.markFailed(db, entity, group, describeUnknown(error));
      }
    }

    return { pushed, failed, quarantined: foreign.length, skippedBackoff };
  }

  /**
   * Marks rows synced only if their `rev` is unchanged. A row edited while its
   * batch was in flight stays pending, preserving the newer local edit.
   */
  private async markSynced(
    db: OfflineWorkerDB,
    entity: SyncableEntity,
    rows: readonly InFlightRow[],
  ): Promise<number> {
    let confirmed = 0;

    await db.transaction('rw', [db[entity], db.sync_journal], async () => {
      for (const { id, rev } of rows) {
        const current = (await (db[entity] as any).get(id)) as SyncableRecord | undefined;
        if (current === undefined || current.rev !== rev) continue;

        await (db[entity] as any).update(id, {
          sync_status: 'synced',
          sync_attempts: 0,
          next_attempt_at: 0,
          last_sync_error: null,
        });
        confirmed += 1;
      }

      await appendJournal(db, {
        entity,
        entity_id: `${rows.length} row(s)`,
        action: 'SYNC_OK',
        occurred_at: Date.now(),
        actor_uid: getFirebaseAuth().currentUser?.uid ?? 'unknown',
        device_id: getDeviceId(),
        note: `confirmed=${confirmed}`,
      });
    });

    return confirmed;
  }

  private async markFailed(
    db: OfflineWorkerDB,
    entity: SyncableEntity,
    rows: readonly SyncableRecord[],
    reason: string,
  ): Promise<void> {
    await db.transaction('rw', [db[entity], db.sync_journal], async () => {
      for (const row of rows) {
        const attempts = row.sync_attempts + 1;
        await (db[entity] as any).update(row.id, {
          sync_attempts: attempts,
          next_attempt_at: Date.now() + backoffFor(attempts),
          last_sync_error: reason.slice(0, 300),
        });
      }
      await appendJournal(db, {
        entity,
        entity_id: `${rows.length} row(s)`,
        action: 'SYNC_FAIL',
        occurred_at: Date.now(),
        actor_uid: getFirebaseAuth().currentUser?.uid ?? 'unknown',
        device_id: getDeviceId(),
        note: reason.slice(0, 300),
      });
    });
  }

  private async quarantine(
    db: OfflineWorkerDB,
    entity: SyncableEntity,
    row: SyncableRecord,
  ): Promise<void> {
    await (db[entity] as any).update(row.id, {
      sync_attempts: MAX_ATTEMPTS,
      next_attempt_at: Number.MAX_SAFE_INTEGER,
      last_sync_error: 'Owner mismatch: row belongs to a different worker account.',
    });
  }
}

/** Lower bound for the compound-index range scan. */
const Dexie_MIN = -Infinity;

export const syncEngine = new SyncEngine();
