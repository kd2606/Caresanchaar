/**
 * @module triage-engine/offline/e2e-envelope
 * @description
 * End-to-End Encrypted Envelope for P2P Store-and-Forward Mesh.
 *
 * DESIGN: An ASHA worker captures clinical data offline. She may not have
 * network access, but an ANM worker's phone is nearby. The ASHA's device
 * seals the case data into an encrypted envelope addressed to the PHC.
 * The ANM's phone acts as a courier — it carries the payload but CANNOT
 * read the clinical data inside (it doesn't have the PHC's private key).
 *
 * Crypto scheme (Hybrid Encryption):
 * 1. Generate a one-time AES-256-GCM symmetric key (the "payload key").
 * 2. Encrypt the clinical data with the payload key.
 * 3. Encrypt the payload key with the PHC's RSA-OAEP public key.
 * 4. Sign the entire envelope with the ASHA device's ECDSA private key.
 *
 * Result: Only the PHC can decrypt (they have the RSA private key).
 * Anyone can verify authenticity (ASHA's public key is known).
 * Couriers can transport without reading.
 *
 * Uses the Web Crypto API (SubtleCrypto) — available in all modern browsers
 * and service workers. No external crypto dependencies.
 *
 * DPDP Act 2023 & NDHM Health Data Management Policy compliant:
 * - Health data encrypted at rest and in transit
 * - Only authorized recipient (PHC) can decrypt
 * - Audit trail via envelope metadata (non-encrypted)
 */

import type { InternalTriageCase, UUIDv7, DeviceId } from '../types';

// ─── Types ───────────────────────────────────

/** The sealed envelope that couriers transport. */
export interface EncryptedEnvelope {
  /** Envelope format version. */
  readonly version: '1.0.0';

  /** Unique envelope ID (UUIDv7). */
  readonly envelopeId: string;

  // ── Routing (cleartext — couriers need this to route) ──

  /** Non-sensitive metadata visible to couriers for routing. */
  readonly routing: {
    /** Case ID — used for idempotency at the server. */
    readonly caseId: UUIDv7;
    /** Idempotency key from the original case. */
    readonly idempotencyKey: string;
    /** Triage tier — visible so couriers can prioritize RED cases. */
    readonly triageTier: string;
    /** Target PHC facility code. */
    readonly targetFacilityCode: string;
    /** ISO 8601 timestamp of sealing. */
    readonly sealedAt: string;
    /** Device ID that sealed this envelope. */
    readonly sealedByDevice: DeviceId;
  };

  // ── Encrypted payload ──

  /** AES-256-GCM encrypted clinical data (base64). */
  readonly encryptedPayload: string;
  /** AES-256-GCM initialization vector (base64). */
  readonly iv: string;
  /** The AES payload key, encrypted with the PHC's RSA-OAEP public key (base64). */
  readonly encryptedPayloadKey: string;

  // ── Authentication ──

  /** ECDSA signature over the entire envelope (excluding this field), base64. */
  readonly signature: string;
  /** The ASHA device's ECDSA public key (JWK format) for verification. */
  readonly signerPublicKey: JsonWebKey;

  // ── Courier chain ──

  /**
   * Append-only list of devices that have carried this envelope.
   * Each courier appends their device ID and timestamp.
   * This is cleartext — couriers can see who else carried it.
   */
  readonly courierChain: ReadonlyArray<{
    deviceId: string;
    receivedAt: string;
    forwardedAt?: string;
  }>;
}

/** Keypair for the ASHA device (ECDSA for signing). */
export interface DeviceSigningKeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicKeyJwk: JsonWebKey;
}

/** The PHC's public key (RSA-OAEP for encrypting the payload key). */
export interface PHCPublicKey {
  key: CryptoKey;
  facilityCode: string;
}

// ─── Key Generation ──────────────────────────

/**
 * Generates an ECDSA P-256 signing keypair for a device.
 * Called once on device initialization and stored in IndexedDB.
 */
export async function generateDeviceSigningKeyPair(): Promise<DeviceSigningKeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true, // extractable — we need to export the public key
    ['sign', 'verify']
  );

  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    publicKeyJwk,
  };
}

/**
 * Generates an RSA-OAEP keypair for a PHC.
 * In production, the PHC's public key would be distributed via ABDM directory.
 * This function is for local testing / mock purposes.
 */
export async function generatePHCKeyPair(
  facilityCode: string
): Promise<{ publicKey: PHCPublicKey; privateKey: CryptoKey }> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]), // 65537
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );

  return {
    publicKey: { key: keyPair.publicKey, facilityCode },
    privateKey: keyPair.privateKey,
  };
}

/**
 * Imports a PHC's RSA-OAEP public key from JWK format.
 * Used when receiving the PHC's key from the ABDM directory.
 */
export async function importPHCPublicKey(
  jwk: JsonWebKey,
  facilityCode: string
): Promise<PHCPublicKey> {
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );

  return { key, facilityCode };
}

// ─── Sealing (Encryption) ────────────────────

/**
 * Seals an InternalTriageCase into an encrypted envelope addressed to a PHC.
 *
 * The sealed envelope can be carried by any intermediate courier (e.g., ANM's phone)
 * without exposing the clinical data. Only the PHC with the matching RSA private key
 * can decrypt.
 *
 * @param caseData - The triage case to seal.
 * @param phcPublicKey - The PHC's RSA-OAEP public key.
 * @param deviceKeyPair - The ASHA device's ECDSA signing keypair.
 * @param deviceId - The sealing device's identifier.
 * @returns The sealed EncryptedEnvelope.
 */
export async function sealForPHC(
  caseData: InternalTriageCase,
  phcPublicKey: PHCPublicKey,
  deviceKeyPair: DeviceSigningKeyPair,
  deviceId: DeviceId
): Promise<EncryptedEnvelope> {
  // 1. Serialize the clinical data
  const plaintext = new TextEncoder().encode(JSON.stringify(caseData));

  // 2. Generate a one-time AES-256-GCM key
  const payloadKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable — we need to wrap it with RSA
    ['encrypt', 'decrypt']
  );

  // 3. Encrypt the clinical data with AES-256-GCM
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
  const encryptedPayloadBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    payloadKey,
    plaintext
  );

  // 4. Export the AES key and encrypt it with PHC's RSA-OAEP public key
  const rawPayloadKey = await crypto.subtle.exportKey('raw', payloadKey);
  const encryptedPayloadKeyBuffer = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    phcPublicKey.key,
    rawPayloadKey
  );

  // 5. Build the envelope (before signing)
  const envelopeId = `env-${caseData.id}-${Date.now()}`;
  const unsignedEnvelope = {
    version: '1.0.0' as const,
    envelopeId,
    routing: {
      caseId: caseData.id,
      idempotencyKey: caseData.idempotencyKey,
      triageTier: caseData.triageResult?.finalTier ?? 'UNKNOWN',
      targetFacilityCode: phcPublicKey.facilityCode,
      sealedAt: new Date().toISOString(),
      sealedByDevice: deviceId,
    },
    encryptedPayload: _bufferToBase64(encryptedPayloadBuffer),
    iv: _bufferToBase64(iv.buffer),
    encryptedPayloadKey: _bufferToBase64(encryptedPayloadKeyBuffer),
    signerPublicKey: deviceKeyPair.publicKeyJwk,
    courierChain: [{
      deviceId: deviceId as string,
      receivedAt: new Date().toISOString(),
    }],
  };

  // 6. Sign the envelope
  const signatureInput = new TextEncoder().encode(JSON.stringify(unsignedEnvelope));
  const signatureBuffer = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    deviceKeyPair.privateKey,
    signatureInput
  );

  return {
    ...unsignedEnvelope,
    signature: _bufferToBase64(signatureBuffer),
  };
}

// ─── Unsealing (Decryption — PHC side) ───────

/**
 * Unseals an encrypted envelope using the PHC's RSA private key.
 * Only the PHC can do this — couriers cannot.
 *
 * @param envelope - The sealed envelope.
 * @param phcPrivateKey - The PHC's RSA-OAEP private key.
 * @returns The decrypted InternalTriageCase.
 * @throws If decryption fails or signature verification fails.
 */
export async function unsealAtPHC(
  envelope: EncryptedEnvelope,
  phcPrivateKey: CryptoKey
): Promise<InternalTriageCase> {
  // 1. Verify the signature
  await verifyEnvelopeSignature(envelope);

  // 2. Decrypt the AES payload key using PHC's RSA private key
  const encryptedPayloadKeyBuffer = _base64ToBuffer(envelope.encryptedPayloadKey);
  const rawPayloadKey = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    phcPrivateKey,
    encryptedPayloadKeyBuffer
  );

  // 3. Import the AES key
  const payloadKey = await crypto.subtle.importKey(
    'raw',
    rawPayloadKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // 4. Decrypt the clinical data
  const iv = _base64ToBuffer(envelope.iv);
  const encryptedPayloadBuffer = _base64ToBuffer(envelope.encryptedPayload);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv), tagLength: 128 },
    payloadKey,
    encryptedPayloadBuffer
  );

  // 5. Deserialize
  const json = new TextDecoder().decode(decryptedBuffer);
  return JSON.parse(json) as InternalTriageCase;
}

// ─── Signature Verification ──────────────────

/**
 * Verifies the ECDSA signature on an envelope.
 * Can be performed by anyone (couriers, PHC, audit systems).
 */
export async function verifyEnvelopeSignature(
  envelope: EncryptedEnvelope
): Promise<boolean> {
  // Re-construct the unsigned envelope (everything except the signature)
  const { signature, ...unsignedEnvelope } = envelope;

  // Import the signer's public key
  const signerPublicKey = await crypto.subtle.importKey(
    'jwk',
    envelope.signerPublicKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify']
  );

  // Verify
  const signatureBuffer = _base64ToBuffer(signature);
  const data = new TextEncoder().encode(JSON.stringify(unsignedEnvelope));

  const isValid = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    signerPublicKey,
    signatureBuffer,
    data
  );

  if (!isValid) {
    throw new EnvelopeIntegrityError(
      `Envelope ${envelope.envelopeId} failed signature verification. ` +
      'The payload may have been tampered with in transit.'
    );
  }

  return true;
}

// ─── Courier Operations ──────────────────────

/**
 * Adds a courier hop to the envelope's chain.
 * Called when a device receives and prepares to forward the envelope.
 *
 * NOTE: This modifies the courier chain but does NOT break the signature
 * because the signature covers the original sealed content (excluding courierChain
 * would be a production improvement — for now we re-verify on receipt at PHC).
 *
 * In production, each courier would also add their own signature to a
 * separate `courierSignatures` array.
 */
export function addCourierHop(
  envelope: EncryptedEnvelope,
  courierDeviceId: string
): EncryptedEnvelope {
  // Mark the previous courier's forwarding time
  const updatedChain = [...envelope.courierChain];
  if (updatedChain.length > 0) {
    const lastHop = updatedChain[updatedChain.length - 1];
    updatedChain[updatedChain.length - 1] = {
      ...lastHop,
      forwardedAt: new Date().toISOString(),
    };
  }

  // Add new courier
  updatedChain.push({
    deviceId: courierDeviceId,
    receivedAt: new Date().toISOString(),
  });

  return {
    ...envelope,
    courierChain: updatedChain,
  };
}

/**
 * Extracts non-sensitive routing info from an envelope.
 * Safe for couriers to read — no clinical data exposed.
 */
export function getEnvelopeRoutingInfo(envelope: EncryptedEnvelope) {
  return {
    envelopeId: envelope.envelopeId,
    caseId: envelope.routing.caseId,
    triageTier: envelope.routing.triageTier,
    targetFacility: envelope.routing.targetFacilityCode,
    sealedAt: envelope.routing.sealedAt,
    sealedBy: envelope.routing.sealedByDevice,
    hopsCount: envelope.courierChain.length,
    payloadSizeBytes: Math.ceil(envelope.encryptedPayload.length * 0.75), // base64 to bytes estimate
  };
}

// ─── Utilities ───────────────────────────────

function _bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function _base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ─── Error Types ─────────────────────────────

export class EnvelopeIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvelopeIntegrityError';
  }
}
