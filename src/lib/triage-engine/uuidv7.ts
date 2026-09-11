/**
 * @module triage-engine/uuidv7
 * @description
 * UUIDv7 generator per RFC 9562.
 *
 * UUIDv7 provides:
 * - Time-ordered UUIDs (ms-precision Unix epoch in the high bits)
 * - Database-friendly: B-tree inserts are always append-only
 * - Monotonic counter for sub-millisecond ordering within the same ms
 * - Globally unique with 62 bits of randomness per millisecond
 *
 * Pure TypeScript — no external dependencies.
 */

import type { UUIDv7 } from './types';

// ─── State for monotonic counter ───

/** Last timestamp we generated a UUID for. */
let _lastTimestamp = -1;

/** Monotonic counter within the same millisecond. */
let _counter = 0;

/**
 * Generates a new UUIDv7.
 *
 * Structure (128 bits):
 *   [48 bits: unix_ts_ms] [4 bits: version=0b0111] [12 bits: rand_a]
 *   [2 bits: variant=0b10] [62 bits: rand_b]
 *
 * When multiple UUIDs are generated within the same millisecond,
 * a monotonic counter is embedded in `rand_a` to preserve ordering.
 *
 * @returns A new UUIDv7 string in standard 8-4-4-4-12 hex format.
 */
export function generateUUIDv7(): UUIDv7 {
  const now = Date.now();

  if (now === _lastTimestamp) {
    _counter++;
    if (_counter > 0xfff) {
      // Extremely unlikely: >4096 UUIDs in 1ms. Spin-wait for next ms.
      // In practice this never happens on a single device.
      return _spinAndGenerate();
    }
  } else {
    _lastTimestamp = now;
    _counter = _cryptoRand12();
  }

  return _buildUUIDv7(now, _counter);
}

/**
 * Spin-waits until the next millisecond and generates.
 * Fallback for the astronomically unlikely >4096/ms case.
 */
function _spinAndGenerate(): UUIDv7 {
  let now: number;
  do {
    now = Date.now();
  } while (now === _lastTimestamp);

  _lastTimestamp = now;
  _counter = _cryptoRand12();
  return _buildUUIDv7(now, _counter);
}

/**
 * Builds the UUIDv7 string from timestamp and counter.
 */
function _buildUUIDv7(timestampMs: number, counter12: number): UUIDv7 {
  // 48-bit timestamp
  const tsHex = timestampMs.toString(16).padStart(12, '0');

  // version nibble = 7, then 12-bit counter
  const randA = (0x7000 | (counter12 & 0xfff)).toString(16).padStart(4, '0');

  // variant bits (10xx) + 62 random bits
  const randBytes = _cryptoRandomBytes(8);
  // Set variant to 0b10 in the first byte of rand_b
  randBytes[0] = (randBytes[0] & 0x3f) | 0x80;
  const randB = _bytesToHex(randBytes);

  // Format: 8-4-4-4-12
  const uuid =
    tsHex.slice(0, 8) + '-' +
    tsHex.slice(8, 12) + '-' +
    randA + '-' +
    randB.slice(0, 4) + '-' +
    randB.slice(4, 16);

  return uuid as UUIDv7;
}

/**
 * Generates a 12-bit random value for the initial counter.
 */
function _cryptoRand12(): number {
  const bytes = _cryptoRandomBytes(2);
  return ((bytes[0] << 8) | bytes[1]) & 0xfff;
}

/**
 * Generates cryptographically secure random bytes.
 * Uses `crypto.getRandomValues` (browser/edge) with Node.js fallback.
 */
function _cryptoRandomBytes(length: number): Uint8Array {
  const buf = new Uint8Array(length);

  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(buf);
  } else {
    // Node.js fallback (should not happen in browser/edge runtime)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require('crypto') as typeof import('crypto');
    const nodeBytes = nodeCrypto.randomBytes(length);
    buf.set(new Uint8Array(nodeBytes.buffer, nodeBytes.byteOffset, nodeBytes.byteLength));
  }

  return buf;
}

/**
 * Converts a Uint8Array to a lowercase hex string.
 */
function _bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Extracts the Unix epoch millisecond timestamp from a UUIDv7 string.
 * Useful for debugging and age-based queries.
 *
 * @param uuid - A valid UUIDv7 string.
 * @returns Unix epoch milliseconds embedded in the UUID.
 */
export function extractTimestamp(uuid: UUIDv7): number {
  const hex = uuid.replace(/-/g, '');
  return parseInt(hex.slice(0, 12), 16);
}

/**
 * Validates that a string is a well-formed UUIDv7.
 * Checks: format, version nibble (7), variant bits (10xx).
 */
export function isValidUUIDv7(candidate: string): candidate is UUIDv7 {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(candidate);
}
