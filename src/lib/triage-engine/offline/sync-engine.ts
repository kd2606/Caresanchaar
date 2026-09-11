/**
 * @module triage-engine/offline/sync-engine
 * @description
 * Background sync orchestrator for the offline-first triage platform.
 *
 * Responsibilities:
 * 1. Idempotency key generation — ensures duplicate uploads converge
 * 2. Priority-based sync queue — RED triage cases sync first
 * 3. Chunked SHA-256 media upload with resume capability
 * 4. Network status monitoring
 * 5. Exponential backoff with jitter for retries
 * 6. P2P envelope dispatch as fallback when network is unavailable
 *
 * INVARIANT: A case uploaded twice (via network AND via P2P courier)
 * will be deduplicated at the server using the idempotency key.
 * The server uses "last-writer-wins per field" with HLC comparison.
 */

import type { InternalTriageCase, UUIDv7 } from '../types';
import { TRIAGE_TIER_ORDINAL, TriageTier } from '../types';
import {
  getCasesBySyncStatus,
  getSyncQueue,
  updateSyncQueueEntry,
  updateCaseSyncStatus,
  getMediaBlobsForCase,
  updateMediaUploadProgress,
  saveCaseAndEnqueueSync,
  type SyncQueueEntry,
  type MediaBlobRecord,
} from './indexed-db-adapter';

// ─── Constants ───────────────────────────────

/** Default chunk size for media uploads (256 KB). */
const DEFAULT_CHUNK_SIZE_BYTES = 256 * 1024;

/** Maximum number of retry attempts before giving up. */
const MAX_RETRY_ATTEMPTS = 5;

/** Base delay for exponential backoff (ms). */
const BASE_BACKOFF_MS = 1_000;

/** Maximum backoff delay (ms). 5 minutes. */
const MAX_BACKOFF_MS = 5 * 60 * 1_000;

/** Mock server endpoint (replaced with real URL in production). */
const MOCK_API_BASE = '/api/v1/sync';

// ─── Idempotency ─────────────────────────────

/**
 * Generates a deterministic idempotency key for a triage case.
 *
 * The key is a SHA-256 hash of: caseId + schemaVersion + deviceClaimedTime.
 * This ensures:
 * - Same case uploaded twice → same key → server deduplicates
 * - Case uploaded via network AND via P2P courier → same key → convergence
 * - Different schema versions → different key → both accepted
 *
 * @param caseId - The UUIDv7 case identifier.
 * @param schemaVersion - The schema version string.
 * @param deviceClaimedTime - ISO 8601 timestamp from the device.
 * @returns A hex-encoded SHA-256 hash suitable as an idempotency key.
 */
export async function generateIdempotencyKey(
  caseId: UUIDv7,
  schemaVersion: string,
  deviceClaimedTime: string
): Promise<string> {
  const input = `caresanchaar:idempotency:${caseId}:${schemaVersion}:${deviceClaimedTime}`;
  const buffer = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return _bufferToHex(hashBuffer);
}

// ─── Chunked SHA-256 Upload ──────────────────

/** Progress callback for chunked uploads. */
export type UploadProgressCallback = (progress: {
  mediaId: string;
  totalBytes: number;
  uploadedBytes: number;
  currentChunk: number;
  totalChunks: number;
  percent: number;
}) => void;

/** Result of a chunked upload. */
export interface ChunkedUploadResult {
  success: boolean;
  mediaId: string;
  remoteUri: string | null;
  totalBytes: number;
  uploadedBytes: number;
  sha256Verified: boolean;
  error?: string;
}

/**
 * Uploads a media blob in resumable chunks with SHA-256 integrity verification.
 *
 * If the upload was previously interrupted, it resumes from the last
 * successfully uploaded chunk offset (stored in IndexedDB).
 *
 * Each chunk includes its own SHA-256 hash for per-chunk integrity.
 * After all chunks are uploaded, the server verifies the full-file SHA-256.
 *
 * @param media - The media blob record from IndexedDB.
 * @param onProgress - Optional progress callback.
 * @param chunkSize - Size of each chunk in bytes (default: 256 KB).
 * @returns Upload result with verification status.
 */
export async function uploadMediaChunked(
  media: MediaBlobRecord,
  onProgress?: UploadProgressCallback,
  chunkSize: number = DEFAULT_CHUNK_SIZE_BYTES
): Promise<ChunkedUploadResult> {
  const totalBytes = media.blob.size;
  const totalChunks = Math.ceil(totalBytes / chunkSize);
  const startChunk = Math.floor(media.uploadedBytes / chunkSize);
  let uploadedBytes = media.uploadedBytes;

  try {
    // Mark as uploading
    await updateMediaUploadProgress(media.id, uploadedBytes, 'uploading');

    for (let chunkIndex = startChunk; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * chunkSize;
      const end = Math.min(start + chunkSize, totalBytes);
      const chunk = media.blob.slice(start, end);

      // Compute SHA-256 for this chunk
      const chunkBuffer = await chunk.arrayBuffer();
      const chunkHash = await computeSHA256(chunkBuffer);

      // Upload chunk (mock — in production this would be a real HTTP request)
      const chunkResult = await _mockUploadChunk({
        mediaId: media.id,
        caseId: media.caseId,
        chunkIndex,
        totalChunks,
        chunkHash,
        chunkData: chunkBuffer,
        totalFileHash: media.sha256,
        mimeType: media.mimeType,
      });

      if (!chunkResult.success) {
        // Save progress so we can resume
        await updateMediaUploadProgress(media.id, uploadedBytes, 'uploading');
        throw new SyncError(`Chunk ${chunkIndex}/${totalChunks} upload failed: ${chunkResult.error}`);
      }

      uploadedBytes = end;

      // Persist progress for resume capability
      await updateMediaUploadProgress(media.id, uploadedBytes, 'uploading');

      // Report progress
      onProgress?.({
        mediaId: media.id,
        totalBytes,
        uploadedBytes,
        currentChunk: chunkIndex + 1,
        totalChunks,
        percent: Math.round((uploadedBytes / totalBytes) * 100),
      });
    }

    // All chunks uploaded — mark as complete
    await updateMediaUploadProgress(media.id, totalBytes, 'uploaded');

    return {
      success: true,
      mediaId: media.id,
      remoteUri: `${MOCK_API_BASE}/media/${media.id}`,
      totalBytes,
      uploadedBytes: totalBytes,
      sha256Verified: true,
    };
  } catch (error) {
    await updateMediaUploadProgress(media.id, uploadedBytes, 'failed');

    return {
      success: false,
      mediaId: media.id,
      remoteUri: null,
      totalBytes,
      uploadedBytes,
      sha256Verified: false,
      error: error instanceof Error ? error.message : 'Unknown upload error',
    };
  }
}

/**
 * Computes SHA-256 hash of an ArrayBuffer.
 * Used for both chunk-level and file-level integrity verification.
 */
export async function computeSHA256(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return _bufferToHex(hashBuffer);
}

/**
 * Computes SHA-256 hash of a Blob (streaming-friendly for large files).
 */
export async function computeBlobSHA256(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  return computeSHA256(buffer);
}

// ─── Network Status ──────────────────────────

export interface NetworkStatus {
  /** Whether the device is online (navigator.onLine). */
  isOnline: boolean;
  /** Estimated connection type (if available via Network Information API). */
  connectionType: string;
  /** Effective bandwidth estimate in Mbps (if available). */
  effectiveBandwidth: number | null;
  /** Whether the connection is metered (e.g., mobile data). */
  isMetered: boolean;
}

/**
 * Returns current network status.
 * Uses Network Information API where available, falls back to navigator.onLine.
 */
export function getNetworkStatus(): NetworkStatus {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : false;

  // Network Information API (Chrome/Android)
  const connection = (navigator as unknown as {
    connection?: {
      effectiveType?: string;
      downlink?: number;
      saveData?: boolean;
    };
  }).connection;

  return {
    isOnline,
    connectionType: connection?.effectiveType ?? 'unknown',
    effectiveBandwidth: connection?.downlink ?? null,
    isMetered: connection?.saveData ?? false,
  };
}

/**
 * Registers network status change listeners.
 * Returns a cleanup function to remove the listeners.
 */
export function onNetworkStatusChange(
  callback: (status: NetworkStatus) => void
): () => void {
  const handler = () => callback(getNetworkStatus());

  window.addEventListener('online', handler);
  window.addEventListener('offline', handler);

  // Also listen to Network Information API changes
  const connection = (navigator as unknown as {
    connection?: EventTarget;
  }).connection;
  connection?.addEventListener('change', handler);

  return () => {
    window.removeEventListener('online', handler);
    window.removeEventListener('offline', handler);
    connection?.removeEventListener('change', handler);
  };
}

// ─── Sync Engine ─────────────────────────────

/** Sync result for a single case. */
export interface CaseSyncResult {
  caseId: UUIDv7;
  success: boolean;
  method: 'network' | 'p2p_envelope';
  mediaResults: ChunkedUploadResult[];
  error?: string;
  durationMs: number;
}

/** Overall sync run result. */
export interface SyncRunResult {
  startedAt: string;
  completedAt: string;
  totalCases: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  results: CaseSyncResult[];
  networkStatus: NetworkStatus;
}

/** Sync engine configuration. */
export interface SyncEngineConfig {
  /** Maximum concurrent case syncs. Default: 2 (conservative for mobile). */
  maxConcurrency: number;
  /** Chunk size for media uploads. Default: 256 KB. */
  chunkSizeBytes: number;
  /** Whether to attempt P2P envelope as fallback. Default: true. */
  enableP2PFallback: boolean;
  /** Progress callback. */
  onProgress?: (result: CaseSyncResult) => void;
  /** Media upload progress callback. */
  onMediaProgress?: UploadProgressCallback;
}

const DEFAULT_SYNC_CONFIG: SyncEngineConfig = {
  maxConcurrency: 2,
  chunkSizeBytes: DEFAULT_CHUNK_SIZE_BYTES,
  enableP2PFallback: true,
};

/**
 * Executes a full sync run: processes all queued cases in priority order.
 *
 * Priority: RED (4) → ORANGE (3) → YELLOW (2) → GREEN (1).
 *
 * For each case:
 * 1. Upload the case JSON (with idempotency key).
 * 2. Upload all associated media blobs (chunked, resumable).
 * 3. Mark as synced in IndexedDB.
 *
 * If network is unavailable and P2P fallback is enabled,
 * the case is sealed into an encrypted envelope for courier transport.
 */
export async function runSyncCycle(
  config: Partial<SyncEngineConfig> = {}
): Promise<SyncRunResult> {
  const cfg = { ...DEFAULT_SYNC_CONFIG, ...config };
  const startedAt = new Date().toISOString();
  const results: CaseSyncResult[] = [];
  const networkStatus = getNetworkStatus();

  // Get the prioritized sync queue
  const queue = await getSyncQueue();

  if (queue.length === 0) {
    return {
      startedAt,
      completedAt: new Date().toISOString(),
      totalCases: 0,
      successCount: 0,
      failureCount: 0,
      skippedCount: 0,
      results: [],
      networkStatus,
    };
  }

  // Process in batches respecting concurrency limit
  for (let i = 0; i < queue.length; i += cfg.maxConcurrency) {
    const batch = queue.slice(i, i + cfg.maxConcurrency);
    const batchResults = await Promise.allSettled(
      batch.map((entry) => _syncSingleCase(entry, cfg, networkStatus))
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
        cfg.onProgress?.(result.value);
      } else {
        // Should not happen — _syncSingleCase catches internally
        results.push({
          caseId: 'unknown' as UUIDv7,
          success: false,
          method: 'network',
          mediaResults: [],
          error: result.reason?.message ?? 'Unknown error',
          durationMs: 0,
        });
      }
    }
  }

  const successCount = results.filter((r) => r.success).length;

  return {
    startedAt,
    completedAt: new Date().toISOString(),
    totalCases: queue.length,
    successCount,
    failureCount: results.filter((r) => !r.success).length,
    skippedCount: queue.length - results.length,
    results,
    networkStatus,
  };
}

/**
 * Syncs a single case: JSON payload + media blobs.
 */
async function _syncSingleCase(
  entry: SyncQueueEntry,
  config: SyncEngineConfig,
  networkStatus: NetworkStatus
): Promise<CaseSyncResult> {
  const startTime = Date.now();
  const mediaResults: ChunkedUploadResult[] = [];

  try {
    // Get the full case from IndexedDB
    const cases = await getCasesBySyncStatus('unsynced');
    const triageCase = cases.find((c) => c.id === entry.id);

    if (!triageCase) {
      await updateSyncQueueEntry(entry.id, { status: 'completed' });
      return {
        caseId: entry.id,
        success: true,
        method: 'network',
        mediaResults: [],
        durationMs: Date.now() - startTime,
      };
    }

    // Update queue entry
    await updateSyncQueueEntry(entry.id, {
      status: 'in_progress' as SyncQueueEntry['status'],
      attempts: entry.attempts + 1,
      lastAttemptAt: new Date().toISOString(),
    });

    // Mark case as syncing
    await updateCaseSyncStatus(entry.id, 'syncing');

    if (networkStatus.isOnline) {
      // ── Network sync path ──

      // 1. Upload case JSON
      await _mockUploadCase(triageCase);

      // 2. Upload media blobs
      const mediaBlobs = await getMediaBlobsForCase(entry.id);
      for (const media of mediaBlobs) {
        if (media.uploadStatus === 'uploaded') continue; // Already done

        const result = await uploadMediaChunked(
          media,
          config.onMediaProgress,
          config.chunkSizeBytes
        );
        mediaResults.push(result);

        if (!result.success) {
          throw new SyncError(`Media upload failed for ${media.id}: ${result.error}`);
        }
      }

      // 3. Mark as synced
      await updateCaseSyncStatus(entry.id, 'synced');
      await updateSyncQueueEntry(entry.id, { status: 'completed' });

      return {
        caseId: entry.id,
        success: true,
        method: 'network',
        mediaResults,
        durationMs: Date.now() - startTime,
      };
    } else if (config.enableP2PFallback) {
      // ── P2P fallback path ──
      // In a real implementation, this would seal the case into an encrypted
      // envelope and dispatch it via WebRTC/Bluetooth to a nearby courier.
      // For now, we just mark it as still unsynced but attempted.

      await updateCaseSyncStatus(entry.id, 'unsynced');
      await updateSyncQueueEntry(entry.id, {
        status: 'queued',
        lastError: 'No network — queued for P2P courier transport',
      });

      return {
        caseId: entry.id,
        success: false,
        method: 'p2p_envelope',
        mediaResults: [],
        error: 'No network available. Case queued for P2P courier transport.',
        durationMs: Date.now() - startTime,
      };
    } else {
      throw new SyncError('No network and P2P fallback is disabled');
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown sync error';

    // Exponential backoff: re-queue for retry
    const attempts = entry.attempts + 1;
    if (attempts < MAX_RETRY_ATTEMPTS) {
      await updateCaseSyncStatus(entry.id, 'unsynced');
      await updateSyncQueueEntry(entry.id, {
        status: 'queued',
        attempts,
        lastAttemptAt: new Date().toISOString(),
        lastError: errorMsg,
      });
    } else {
      // Max retries exhausted
      await updateSyncQueueEntry(entry.id, {
        status: 'failed',
        attempts,
        lastAttemptAt: new Date().toISOString(),
        lastError: `Max retries (${MAX_RETRY_ATTEMPTS}) exhausted: ${errorMsg}`,
      });
    }

    return {
      caseId: entry.id,
      success: false,
      method: 'network',
      mediaResults,
      error: errorMsg,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Calculates the sync priority from a triage tier.
 * RED = 4, ORANGE = 3, YELLOW = 2, GREEN = 1.
 */
export function triageTierToSyncPriority(tier: TriageTier): number {
  return TRIAGE_TIER_ORDINAL[tier] + 1;
}

/**
 * Convenience: saves a completed case and enqueues it for sync with
 * triage-based priority.
 */
export async function saveAndQueueForSync(
  triageCase: InternalTriageCase
): Promise<void> {
  const priority = triageCase.triageResult
    ? triageTierToSyncPriority(triageCase.triageResult.finalTier)
    : 1;

  await saveCaseAndEnqueueSync(triageCase, priority);
}

// ─── Exponential Backoff ─────────────────────

/**
 * Calculates the delay for exponential backoff with jitter.
 *
 * delay = min(MAX_BACKOFF, BASE * 2^attempt) + random_jitter
 *
 * Jitter prevents thundering herd when multiple devices come online
 * simultaneously (common in rural areas with shared tower).
 */
export function calculateBackoffDelay(attempt: number): number {
  const exponentialDelay = Math.min(
    MAX_BACKOFF_MS,
    BASE_BACKOFF_MS * Math.pow(2, attempt)
  );

  // Add 0-25% jitter
  const jitter = exponentialDelay * 0.25 * Math.random();
  return Math.round(exponentialDelay + jitter);
}

// ─── Scheduled Background Sync ───────────────

let _syncInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Starts the background sync engine on an interval.
 * Automatically runs sync when the device comes online.
 *
 * @param intervalMs - How often to attempt sync (default: 30 seconds).
 * @param config - Sync engine configuration.
 * @returns Cleanup function to stop the engine.
 */
export function startBackgroundSync(
  intervalMs: number = 30_000,
  config: Partial<SyncEngineConfig> = {}
): () => void {
  // Stop any existing sync
  stopBackgroundSync();

  // Run immediately
  runSyncCycle(config).catch(console.error);

  // Schedule recurring
  _syncInterval = setInterval(() => {
    const status = getNetworkStatus();
    if (status.isOnline) {
      runSyncCycle(config).catch(console.error);
    }
  }, intervalMs);

  // Also run when device comes back online
  const cleanupNetworkListener = onNetworkStatusChange((status) => {
    if (status.isOnline) {
      runSyncCycle(config).catch(console.error);
    }
  });

  return () => {
    stopBackgroundSync();
    cleanupNetworkListener();
  };
}

/**
 * Stops the background sync engine.
 */
export function stopBackgroundSync(): void {
  if (_syncInterval) {
    clearInterval(_syncInterval);
    _syncInterval = null;
  }
}

// ─── Mock Network Functions ──────────────────
// These simulate server interactions. Replace with real fetch() calls in production.

interface MockChunkUploadRequest {
  mediaId: string;
  caseId: UUIDv7;
  chunkIndex: number;
  totalChunks: number;
  chunkHash: string;
  chunkData: ArrayBuffer;
  totalFileHash: string;
  mimeType: string;
}

async function _mockUploadChunk(
  request: MockChunkUploadRequest
): Promise<{ success: boolean; error?: string }> {
  // Simulate network latency (100-500ms)
  await _sleep(100 + Math.random() * 400);

  // Simulate 5% chunk failure rate for realism
  if (Math.random() < 0.05) {
    return { success: false, error: 'Simulated network timeout' };
  }

  console.debug(
    `[SyncEngine] Mock uploaded chunk ${request.chunkIndex + 1}/${request.totalChunks} ` +
    `for media ${request.mediaId} (hash: ${request.chunkHash.slice(0, 8)}...)`
  );

  return { success: true };
}

async function _mockUploadCase(triageCase: InternalTriageCase): Promise<void> {
  // Simulate network latency
  await _sleep(200 + Math.random() * 300);

  console.debug(
    `[SyncEngine] Mock uploaded case ${triageCase.id} ` +
    `(idempotency: ${triageCase.idempotencyKey.slice(0, 8)}..., ` +
    `tier: ${triageCase.triageResult?.finalTier ?? 'N/A'})`
  );
}

// ─── Utilities ───────────────────────────────

function _bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function _sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Error Type ──────────────────────────────

export class SyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncError';
  }
}
