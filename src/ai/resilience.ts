// src/ai/resilience.ts
// 4-Layer Resilience wrapper for AI flow calls.
// Layer 1: Decorrelated jitter backoff
// Layer 2: Retryable error classification (rate-limit, quota, transient)
// Layer 3: Structured logging per attempt
// Layer 4: Caller-facing error typing for route-level 503 decisions

import { logger } from '@/lib/logger';

// --- Retryable error classification ---
// Aligns with the markers in generate-with-fallback.ts but operates at the
// route/flow boundary (one layer above the model-fallback chain).

const RATE_LIMIT_MARKERS = [
  '429',
  'rate limit',
  'too many requests',
  'quota',
  'throttle',
  'resource exhausted',
  'resource_exhausted',
  'capacity',
  'overloaded',
  'temporarily rate-limited',
  'payment required',
  '402',
  'more credits',
];

const TRANSIENT_MARKERS = [
  '503',
  '500',
  'unavailable',
  'deadline exceeded',
  'internal',
  'timeout',
  'econnreset',
  'econnrefused',
  'socket hang up',
];

export class AICapacityExhaustedError extends Error {
  public readonly retryable = true;
  constructor(
    message: string,
    public readonly label: string,
    public readonly attempts: number,
    public readonly lastError: unknown,
  ) {
    super(message);
    this.name = 'AICapacityExhaustedError';
  }
}

function classifyError(err: unknown): 'rate_limit' | 'transient' | 'fatal' {
  if (!err || typeof err !== 'object') return 'fatal';

  const e = err as { status?: number; code?: number | string; message?: string };
  const status = e.status ?? 0;
  const code = typeof e.code === 'number' ? e.code : 0;
  const message = (e.message || String(err) || '').toLowerCase();

  // Check rate-limit / quota first — these are the ones we surface as 503.
  if (status === 429 || status === 402 || code === 429) return 'rate_limit';
  if (RATE_LIMIT_MARKERS.some((m) => message.includes(m))) return 'rate_limit';

  // Transient server errors — worth retrying but not quota-specific.
  if ([500, 502, 503, 504].includes(status)) return 'transient';
  if (TRANSIENT_MARKERS.some((m) => message.includes(m))) return 'transient';

  return 'fatal';
}

function isRetryable(err: unknown): boolean {
  const classification = classifyError(err);
  return classification === 'rate_limit' || classification === 'transient';
}

// --- Decorrelated jitter backoff ---
// Base delay doubles each attempt, then adds up to 30% random jitter.
function computeBackoff(attempt: number, baseMs = 500, maxMs = 8_000): number {
  const exp = Math.min(maxMs, baseMs * 2 ** attempt);
  const jitter = Math.random() * exp * 0.3;
  return Math.floor(exp + jitter);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// --- Public API ---

export interface ResilienceOptions {
  /** Max number of attempts (including the first call). Default: 3. */
  maxAttempts?: number;
  /** Human-readable label for logging. */
  label: string;
  /** Base delay in ms for the first retry. Default: 500. */
  baseDelayMs?: number;
  /** Maximum delay cap in ms. Default: 8000. */
  maxDelayMs?: number;
}

/**
 * Wraps an async AI call with retry + decorrelated jitter backoff.
 *
 * - Retries on rate-limit and transient errors up to `maxAttempts`.
 * - Non-retryable (fatal) errors are re-thrown immediately.
 * - If all attempts exhaust on rate-limit errors, throws `AICapacityExhaustedError`
 *   so the route can return a structured 503.
 */
export async function callWithResilience<T>(
  fn: () => Promise<T>,
  opts: ResilienceOptions,
): Promise<T> {
  const { maxAttempts = 3, label, baseDelayMs = 500, maxDelayMs = 8_000 } = opts;

  let lastError: unknown;
  let lastClassification: 'rate_limit' | 'transient' | 'fatal' = 'fatal';

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await fn();
      if (attempt > 0) {
        logger.info(`${label}: succeeded after ${attempt + 1} attempts`);
      }
      return result;
    } catch (err) {
      lastError = err;
      lastClassification = classifyError(err);
      const errMsg = (err as Error)?.message?.substring(0, 150) ?? String(err);

      if (!isRetryable(err)) {
        // Fatal — no point retrying.
        logger.error(`${label}: fatal error on attempt ${attempt + 1}`, {
          classification: lastClassification,
          err: errMsg,
        });
        throw err;
      }

      // Retryable — log and backoff.
      const delay = computeBackoff(attempt, baseDelayMs, maxDelayMs);
      logger.warn(`${label}: attempt ${attempt + 1}/${maxAttempts} failed (${lastClassification})`, {
        err: errMsg,
        nextRetryMs: attempt < maxAttempts - 1 ? delay : null,
      });

      if (attempt < maxAttempts - 1) {
        await sleep(delay);
      }
    }
  }

  // All attempts exhausted.
  if (lastClassification === 'rate_limit') {
    throw new AICapacityExhaustedError(
      `${label}: all ${maxAttempts} attempts exhausted due to rate limiting / quota.`,
      label,
      maxAttempts,
      lastError,
    );
  }

  // Transient exhaustion — re-throw the last error.
  throw lastError;
}

/**
 * Type guard: checks if an error is an AICapacityExhaustedError.
 * Use in route catch blocks to decide on 503 response.
 */
export function isCapacityExhausted(err: unknown): err is AICapacityExhaustedError {
  return err instanceof AICapacityExhaustedError;
}
