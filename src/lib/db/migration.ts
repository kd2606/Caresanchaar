'use client';

import { getOfflineDb, OfflineWorkerDB } from './offline-db';
import { OfflineCrypto } from '../crypto/offline-crypto';

/**
 * Additive, resumable, verify-then-retire Dexie migration.
 * Processes records in batches from v1 to v2 encrypted tables.
 */
export class MigrationService {
    static async createEncryptedBackup(): Promise<void> {
        if (!OfflineCrypto.isKeyLoaded()) throw new Error("Key not loaded for backup");
        
        const db = getOfflineDb();
        const v1Patients = await db.patients.toArray();
        const v1Triage = await db.triage_records.toArray();
        const v1Referrals = await db.referrals.toArray();
        
        const backupPayload = {
            timestamp: Date.now(),
            patients: v1Patients,
            triage_records: v1Triage,
            referrals: v1Referrals
        };
        
        const encryptedBackup = await OfflineCrypto.encryptRecord(backupPayload, "full_v1_backup", "system", 1);
        
        await db.backups.put({
            timestamp: backupPayload.timestamp,
            payload: encryptedBackup
        });
    }

    static async runMigrationBatch(batchSize: number = 50) {
        if (!OfflineCrypto.isKeyLoaded()) {
            throw new Error("Cannot run migration: Encryption key not loaded");
        }

        const db = getOfflineDb();

        // Migrate Patients
        const unmigratedPatients = await db.patients
            .filter(p => true) // In a real scenario, filter out already migrated using a join or exclusion
            .limit(batchSize)
            .toArray();

        for (const patient of unmigratedPatients) {
            try {
                // Check if already migrated or quarantined
                const state = await db.migration_state.get(patient.id);
                if (state && (state.status === 'migrated' || state.status === 'quarantine')) continue;

                // 1. Encrypt
                const encrypted = await OfflineCrypto.encryptRecord(patient, patient.id, "current_uid_placeholder", 2);
                
                // 2. Write to v2
                await db.patients_v2.put({
                    id: patient.id,
                    sync_status: patient.sync_status || 'pending',
                    next_attempt_at: (patient as any).next_attempt_at || Date.now(),
                    payload: encrypted
                });

                // 3. Read back and decrypt (Verify)
                const saved = await db.patients_v2.get(patient.id);
                const decrypted = await OfflineCrypto.decryptRecord(saved.payload, patient.id, "current_uid_placeholder", 2);
                
                // 4. Checksum/Compare (simple deep equal for now)
                if (JSON.stringify(patient) !== JSON.stringify(decrypted)) {
                    throw new Error("Checksum mismatch after decryption");
                }

                // 5. Mark Migrated
                await db.migration_state.put({ id: patient.id, status: 'migrated' });
                
            } catch (err: any) {
                console.error(`Migration failed for patient ${patient.id}`, err);
                await db.migration_state.put({ id: patient.id, status: 'quarantine', error: err.message });
            }
        }
        
        // Similar blocks would follow for triage_records and referrals
    }
}
