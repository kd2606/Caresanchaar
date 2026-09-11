/**
 * @module triage-engine/hlc
 * @description
 * Hybrid Logical Clock (HLC) implementation for causality-preserving
 * offline-first sync. Based on the Kulkarni et al. HLC paper.
 *
 * An HLC combines:
 * - Wall-clock time (for human-readable ordering)
 * - Logical counter (for sub-millisecond causality)
 * - Node ID (for tie-breaking across devices)
 *
 * This guarantees a total ordering of events even when:
 * - Device clocks drift significantly
 * - Multiple devices are offline simultaneously
 * - Events happen within the same millisecond
 */

import type { HybridLogicalClock, DeviceId } from './types';

/**
 * Maximum allowed wall-clock drift in milliseconds.
 * If a received HLC is more than this far in the future,
 * we reject it to prevent clock poisoning attacks.
 */
const MAX_DRIFT_MS = 60_000; // 60 seconds

/**
 * Creates a new HLC from the current wall clock.
 *
 * @param nodeId - The unique identifier for this device/node.
 * @returns A fresh HLC anchored to `Date.now()`.
 */
export function createHLC(nodeId: DeviceId): HybridLogicalClock {
  return {
    wallTime: Date.now(),
    logicalCounter: 0,
    nodeId,
  };
}

/**
 * Ticks the HLC on a local event (e.g., creating a new record).
 * Ensures monotonicity: the returned HLC is always >= the input.
 *
 * Algorithm:
 * - If wall clock has advanced past the HLC's wallTime, reset counter.
 * - Otherwise, increment the logical counter.
 *
 * @param current - The current HLC state on this node.
 * @returns A new HLC that is causally after `current`.
 */
export function tickHLC(current: HybridLogicalClock): HybridLogicalClock {
  const now = Date.now();

  if (now > current.wallTime) {
    return {
      wallTime: now,
      logicalCounter: 0,
      nodeId: current.nodeId,
    };
  }

  // Wall clock hasn't advanced — increment logical counter.
  return {
    wallTime: current.wallTime,
    logicalCounter: current.logicalCounter + 1,
    nodeId: current.nodeId,
  };
}

/**
 * Merges a local HLC with a remote HLC received during sync.
 * Implements the HLC receive algorithm to maintain causality.
 *
 * @param local - This node's current HLC.
 * @param remote - The HLC received from a remote node.
 * @returns A new HLC that is causally after both `local` and `remote`.
 * @throws If the remote HLC is too far in the future (clock drift protection).
 */
export function receiveHLC(
  local: HybridLogicalClock,
  remote: HybridLogicalClock
): HybridLogicalClock {
  const now = Date.now();

  // Guard against clock poisoning — reject excessively future HLCs.
  if (remote.wallTime - now > MAX_DRIFT_MS) {
    throw new HLCDriftError(
      `Remote HLC wall time is ${remote.wallTime - now}ms in the future ` +
      `(max allowed: ${MAX_DRIFT_MS}ms). Possible clock drift or poisoning.`
    );
  }

  const maxWall = Math.max(now, local.wallTime, remote.wallTime);

  if (maxWall === now && now > local.wallTime && now > remote.wallTime) {
    // Wall clock is strictly ahead of both — reset counter.
    return { wallTime: now, logicalCounter: 0, nodeId: local.nodeId };
  }

  if (local.wallTime === remote.wallTime) {
    // Same wall time — take max counter + 1.
    return {
      wallTime: local.wallTime,
      logicalCounter: Math.max(local.logicalCounter, remote.logicalCounter) + 1,
      nodeId: local.nodeId,
    };
  }

  if (local.wallTime > remote.wallTime) {
    // Local is ahead — increment local counter.
    return {
      wallTime: local.wallTime,
      logicalCounter: local.logicalCounter + 1,
      nodeId: local.nodeId,
    };
  }

  // Remote is ahead — adopt remote wall time, increment remote counter.
  return {
    wallTime: remote.wallTime,
    logicalCounter: remote.logicalCounter + 1,
    nodeId: local.nodeId,
  };
}

/**
 * Compares two HLCs for total ordering.
 *
 * Order: wallTime → logicalCounter → nodeId (lexicographic tiebreak).
 *
 * @returns Negative if `a < b`, positive if `a > b`, 0 if equal.
 */
export function compareHLC(a: HybridLogicalClock, b: HybridLogicalClock): number {
  if (a.wallTime !== b.wallTime) {
    return a.wallTime - b.wallTime;
  }
  if (a.logicalCounter !== b.logicalCounter) {
    return a.logicalCounter - b.logicalCounter;
  }
  // Lexicographic tie-break on node ID for determinism.
  return a.nodeId < b.nodeId ? -1 : a.nodeId > b.nodeId ? 1 : 0;
}

/**
 * Serializes an HLC to a sortable string representation.
 * Format: `{wallTime}:{logicalCounter}:{nodeId}`
 * Zero-padded for lexicographic sorting.
 */
export function serializeHLC(hlc: HybridLogicalClock): string {
  const wall = hlc.wallTime.toString().padStart(15, '0');
  const counter = hlc.logicalCounter.toString().padStart(5, '0');
  return `${wall}:${counter}:${hlc.nodeId}`;
}

/**
 * Deserializes a string back into an HLC.
 *
 * @throws If the string format is invalid.
 */
export function deserializeHLC(serialized: string): HybridLogicalClock {
  const parts = serialized.split(':');
  if (parts.length < 3) {
    throw new Error(`Invalid HLC string: "${serialized}". Expected format: wallTime:counter:nodeId`);
  }

  const wallTime = parseInt(parts[0], 10);
  const logicalCounter = parseInt(parts[1], 10);
  // Node ID may contain colons (e.g., UUIDs with custom format), so rejoin the rest.
  const nodeId = parts.slice(2).join(':') as DeviceId;

  if (isNaN(wallTime) || isNaN(logicalCounter)) {
    throw new Error(`Invalid HLC string: "${serialized}". Non-numeric wallTime or counter.`);
  }

  return { wallTime, logicalCounter, nodeId };
}

/**
 * Custom error for HLC drift detection.
 */
export class HLCDriftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HLCDriftError';
  }
}
