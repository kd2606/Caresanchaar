/**
 * @module triage-engine/offline
 * @description
 * Barrel export for the offline resiliency module.
 * P2P Store-and-Forward Mesh, IndexedDB adapter, and Background Sync Engine.
 */

// ── IndexedDB Adapter ────────────────────────
export {
  requestPersistentStorage,
  getStorageEstimate,
  saveCase,
  saveCaseAndEnqueueSync,
  getCase,
  getCasesBySyncStatus,
  getUnsyncedCount,
  getAllCases,
  updateCaseSyncStatus,
  deleteSyncedCase,
  saveMediaBlob,
  getMediaBlob,
  getMediaBlobsForCase,
  getPendingMediaBlobs,
  updateMediaUploadProgress,
  getSyncQueue,
  updateSyncQueueEntry,
  getOfflineStats,
  __dangerouslyResetDatabase,
  OfflineStorageError,
} from './indexed-db-adapter';

export type {
  StorageQuotaInfo,
  MediaBlobRecord,
  SyncQueueEntry,
  OfflineStorageStats,
} from './indexed-db-adapter';

// ── E2E Encrypted Envelope ───────────────────
export {
  sealForPHC,
  unsealAtPHC,
  verifyEnvelopeSignature,
  addCourierHop,
  getEnvelopeRoutingInfo,
  generateDeviceSigningKeyPair,
  generatePHCKeyPair,
  importPHCPublicKey,
  EnvelopeIntegrityError,
} from './e2e-envelope';

export type {
  EncryptedEnvelope,
  DeviceSigningKeyPair,
  PHCPublicKey,
} from './e2e-envelope';

// ── Sync Engine ──────────────────────────────
export {
  generateIdempotencyKey,
  uploadMediaChunked,
  computeSHA256,
  computeBlobSHA256,
  getNetworkStatus,
  onNetworkStatusChange,
  runSyncCycle,
  saveAndQueueForSync,
  triageTierToSyncPriority,
  calculateBackoffDelay,
  startBackgroundSync,
  stopBackgroundSync,
  SyncError,
} from './sync-engine';

export type {
  UploadProgressCallback,
  ChunkedUploadResult,
  NetworkStatus,
  CaseSyncResult,
  SyncRunResult,
  SyncEngineConfig,
} from './sync-engine';
