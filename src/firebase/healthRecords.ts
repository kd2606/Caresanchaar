// src/firebase/healthRecords.ts
// Production-hardened with exponential backoff + offline localStorage queue.
// Interface preserved: saveHealthRecord(userId, recordData) — 6 consumer pages unchanged.

import { collection, addDoc, query, where, getDocs, Timestamp, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./clientApp";
import { logger } from "@/lib/logger";

// --- Existing interface (preserved for backwards compatibility) ---
export interface HealthRecordData {
    type: "symptom" | "skin" | "vision" | "cough" | "mental" | "wellness" | "stress" | "cardio" | "heart";
    title: string;
    severity: "low" | "moderate" | "high";
    verdict?: "rest" | "monitor" | "doctor_today" | "urgent_support";
    summary: string;
    details: any;
}

// --- Offline queue types ---
interface QueuedRecord {
    userId: string;
    recordData: HealthRecordData;
    enqueuedAtIso: string;
    retryCount: number;
}

// --- Constants ---
const QUEUE_KEY = 'pulsecheck:offline_health_records_v1';
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 16_000;

// --- Network classification ---
function isRetryableFirestoreError(err: unknown): boolean {
    const code = (err as { code?: string })?.code ?? '';
    return [
        'unavailable',
        'deadline-exceeded',
        'internal',
        'resource-exhausted',
        'aborted',
        'cancelled',
    ].includes(code) || (typeof navigator !== 'undefined' && !navigator?.onLine);
}

// --- Backoff with jitter (decorrelated) ---
function computeBackoffMs(attempt: number): number {
    const exp = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt);
    const jitter = Math.random() * exp * 0.3;
    return Math.floor(exp + jitter);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// --- Deduplication check (existing logic preserved) ---
async function isDuplicate(userId: string, recordData: HealthRecordData): Promise<boolean> {
    try {
        const recordsRef = collection(db, "users", userId, "healthRecords");
        const fiveMinutesAgo = Timestamp.fromMillis(Date.now() - 5 * 60 * 1000);

        const duplicateQuery = query(
            recordsRef,
            where("type", "==", recordData.type),
            where("title", "==", recordData.title),
            where("date", ">", fiveMinutesAgo)
        );

        const querySnapshot = await getDocs(duplicateQuery);
        return !querySnapshot.empty;
    } catch {
        // If dedup check fails (e.g. offline), proceed with save anyway.
        return false;
    }
}

// --- Core writer ---
async function writeToFirestore(userId: string, recordData: HealthRecordData): Promise<void> {
    const recordsRef = collection(db, "users", userId, "healthRecords");
    await addDoc(recordsRef, {
        ...recordData,
        date: Timestamp.now(),
        saved: true,
    });
}

// --- Public API (signature preserved — all 6 consumer pages unchanged) ---
export const saveHealthRecord = async (
    userId: string | undefined,
    recordData: HealthRecordData
): Promise<{ status: 'saved' | 'queued' | 'skipped'; attempts: number }> => {
    if (!userId) return { status: 'skipped', attempts: 0 };

    // Check for recent duplicates (existing logic).
    const duplicate = await isDuplicate(userId, recordData);
    if (duplicate) {
        return { status: 'skipped', attempts: 0 };
    }

    // Retry loop with exponential backoff.
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            await writeToFirestore(userId, recordData);
            logger.info('healthRecord saved', { userId, type: recordData.type, attempts: attempt + 1 });
            return { status: 'saved', attempts: attempt + 1 };
        } catch (err) {
            lastError = err;
            if (!isRetryableFirestoreError(err)) {
                // Non-retryable (e.g., permission-denied) — fail fast, don't queue corrupt writes.
                logger.error('healthRecord non-retryable failure', { userId, type: recordData.type, err });
                // Preserve existing behavior: don't crash the user flow.
                return { status: 'skipped', attempts: attempt + 1 };
            }
            const delay = computeBackoffMs(attempt);
            logger.warn('healthRecord retry', { userId, type: recordData.type, attempt, delay });
            await sleep(delay);
        }
    }

    // All retries exhausted — fall back to local queue.
    enqueueLocally(userId, recordData);
    logger.warn('healthRecord queued offline', { userId, type: recordData.type, lastError });
    return { status: 'queued', attempts: MAX_RETRIES };
};

// --- Local queue ---
function readQueue(): QueuedRecord[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(QUEUE_KEY);
        return raw ? (JSON.parse(raw) as QueuedRecord[]) : [];
    } catch {
        return [];
    }
}

function writeQueue(items: QueuedRecord[]): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
    } catch (err) {
        // localStorage quota exceeded — drop oldest to make room.
        logger.error('queue write failed; trimming', { err });
        if (items.length > 1) writeQueue(items.slice(-Math.floor(items.length / 2)));
    }
}

function enqueueLocally(userId: string, recordData: HealthRecordData): void {
    const queue = readQueue();
    queue.push({ userId, recordData, enqueuedAtIso: new Date().toISOString(), retryCount: 0 });
    writeQueue(queue);
}

// --- Drainer: call this on app startup and whenever 'online' event fires ---
export async function flushOfflineQueue(): Promise<{ flushed: number; remaining: number }> {
    if (typeof window === 'undefined' || !navigator.onLine) {
        return { flushed: 0, remaining: readQueue().length };
    }

    const queue = readQueue();
    if (queue.length === 0) return { flushed: 0, remaining: 0 };

    const survivors: QueuedRecord[] = [];
    let flushed = 0;

    for (const item of queue) {
        try {
            await writeToFirestore(item.userId, item.recordData);
            flushed++;
        } catch (err) {
            if (!isRetryableFirestoreError(err) || item.retryCount >= 10) {
                // Permanent failure or too many attempts — drop and alert.
                logger.error('queue item dropped', { userId: item.userId, type: item.recordData.type, err });
                continue;
            }
            survivors.push({ ...item, retryCount: item.retryCount + 1 });
        }
    }

    writeQueue(survivors);
    if (flushed > 0) {
        logger.info('offline queue flushed', { flushed, remaining: survivors.length });
    }
    return { flushed, remaining: survivors.length };
}

// --- Auto-flush wiring (call once in your root client component) ---
export function initOfflineSync(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => {
        void flushOfflineQueue();
    });
    // Opportunistic flush on load.
    void flushOfflineQueue();
}
