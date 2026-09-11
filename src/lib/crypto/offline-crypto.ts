'use client';


function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string): any {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes as any;
}

export interface EncryptedEnvelope {
    v: number;
    alg: string;
    keyId: string;
    iv: string; // base64
    ct: string; // base64 ciphertext
    aad: string; // base64 AAD
}

export interface WrappedKeyMaterial {
    keyId: string;
    wrappedKey: string; // base64
    salt: string; // base64 PBKDF2 salt
    iv: string; // base64 wrapping IV
}

// In-memory key reference (non-extractable)
let activeDek: CryptoKey | null = null;
let activeKeyId: string | null = null;

export class OfflineCrypto {
    
    // Derive a Key Encryption Key (KEK) from a PIN using PBKDF2
    private static async deriveKEK(pin: string, salt: Uint8Array): Promise<CryptoKey> {
        const enc = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
            "raw",
            enc.encode(pin),
            "PBKDF2",
            false,
            ["deriveKey"]
        );
        return window.crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: salt as BufferSource,
                iterations: 100000,
                hash: "SHA-256"
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["wrapKey", "unwrapKey"]
        );
    }

    /**
     * Set up a new DEK, wrap it with a PIN, and store the non-extractable version in memory.
     * Returns the WrappedKeyMaterial to be stored in Dexie `key_material` table.
     */
    static async setupKeyWithPIN(pin: string): Promise<WrappedKeyMaterial> {
        // 1. Generate DEK as extractable (required for wrapKey)
        const dekExtractable = await window.crypto.subtle.generateKey(
            { name: "AES-GCM", length: 256 },
            true, 
            ["encrypt", "decrypt"]
        );
        const keyId = crypto.randomUUID();

        // 2. Derive KEK from PIN
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const kek = await this.deriveKEK(pin, salt);

        // 3. Wrap DEK
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const wrappedKeyBuffer = await window.crypto.subtle.wrapKey(
            "raw",
            dekExtractable,
            kek,
            { name: "AES-GCM", iv: iv }
        );

        // 4. Unwrap immediately as NON-EXTRACTABLE to hold in memory
        const dekNonExtractable = await window.crypto.subtle.unwrapKey(
            "raw",
            wrappedKeyBuffer,
            kek,
            { name: "AES-GCM", iv: iv },
            { name: "AES-GCM" },
            false, // NOW non-extractable
            ["encrypt", "decrypt"]
        );

        activeDek = dekNonExtractable;
        activeKeyId = keyId;

        // Return material to save to DB
        return {
            keyId,
            wrappedKey: arrayBufferToBase64(wrappedKeyBuffer),
            salt: arrayBufferToBase64(salt),
            iv: arrayBufferToBase64(iv)
        };
    }

    /**
     * Unlock a previously wrapped key using the PIN.
     */
    static async unlockKeyWithPIN(pin: string, material: WrappedKeyMaterial): Promise<void> {
        const salt = base64ToArrayBuffer(material.salt);
        const iv = base64ToArrayBuffer(material.iv);
        const wrappedKeyBuffer = base64ToArrayBuffer(material.wrappedKey);

        const kek = await this.deriveKEK(pin, salt);

        try {
            const dekNonExtractable = await window.crypto.subtle.unwrapKey(
                "raw",
                wrappedKeyBuffer,
                kek,
                { name: "AES-GCM", iv: iv },
                { name: "AES-GCM" },
                false, // non-extractable
                ["encrypt", "decrypt"]
            );
            
            activeDek = dekNonExtractable;
            activeKeyId = material.keyId;
        } catch (e) {
            throw new Error("Invalid PIN or corrupted key material");
        }
    }

    static clearKey() {
        activeDek = null;
        activeKeyId = null;
    }

    static isKeyLoaded(): boolean {
        return activeDek !== null;
    }

    static async encryptRecord(payload: any, recordId: string, ownerUid: string, schemaVersion: number): Promise<EncryptedEnvelope> {
        if (!activeDek || !activeKeyId) throw new Error("Encryption key not loaded");

        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encodedPayload = new TextEncoder().encode(JSON.stringify(payload));
        
        const aadData = JSON.stringify({ recordId, ownerUid, schemaVersion });
        const aad = new TextEncoder().encode(aadData);

        const ciphertext = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv, additionalData: aad },
            activeDek,
            encodedPayload
        );

        return {
            v: 1,
            alg: "A256GCM",
            keyId: activeKeyId,
            iv: arrayBufferToBase64(iv),
            ct: arrayBufferToBase64(ciphertext),
            aad: arrayBufferToBase64(aad)
        };
    }

    static async decryptRecord(envelope: EncryptedEnvelope, recordId: string, ownerUid: string, schemaVersion: number): Promise<any> {
        if (!activeDek) throw new Error("Decryption key not loaded");
        if (envelope.keyId !== activeKeyId) throw new Error("Key ID mismatch");

        const iv = base64ToArrayBuffer(envelope.iv);
        const ct = base64ToArrayBuffer(envelope.ct);
        
        const aadData = JSON.stringify({ recordId, ownerUid, schemaVersion });
        const aad = new TextEncoder().encode(aadData);
        
        // Verify AAD matches what is in the envelope
        if (envelope.aad !== arrayBufferToBase64(aad)) {
            throw new Error("AAD mismatch or tampered envelope metadata");
        }

        const decryptedBytes = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv, additionalData: aad },
            activeDek,
            ct
        );

        const decryptedStr = new TextDecoder().decode(decryptedBytes);
        return JSON.parse(decryptedStr);
    }
}
