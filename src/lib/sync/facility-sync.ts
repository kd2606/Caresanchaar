import { getOfflineDb, isIndexedDbAvailable } from '@/lib/db/offline-db';

import { getFirebaseAuth } from '@/lib/firebase/client';

export async function syncFacilityCatalog(): Promise<void> {
    if (!isIndexedDbAvailable()) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    const user = getFirebaseAuth().currentUser;
    if (!user) throw new Error("Authentication required to sync facility catalog");



    const token = await user.getIdToken();
    const res = await fetch('/api/facility/list', {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
        throw new Error("Failed to fetch facility catalog from server");
    }

    const data = await res.json();
    const facilities = data.facilities || [];
    
    const db = getOfflineDb();
    const now = Date.now();

    await db.transaction('rw', db.facility_catalog_v2, async () => {
        for (const fac of facilities) {
            const payload = {
                id: fac.id,
                name: fac.name,
                districtId: fac.districtId,
                type: fac.type,
                status: fac.status,
                services: fac.services,
                schemaVersion: fac.schemaVersion || 1,
                localSyncedAt: now
            };


            await db.facility_catalog_v2.put({

                id: fac.id,
                districtId: fac.districtId,
                localSyncedAt: now,
                payload: payload
            });
        }
    });
}

export async function getOfflineFacilities(districtId: string): Promise<any[]> {
    if (!isIndexedDbAvailable()) return [];
    
    const user = getFirebaseAuth().currentUser;
    if (!user) return [];



    const db = getOfflineDb();
    const records = await db.facility_catalog_v2.where('districtId').equals(districtId).toArray();
    
    const decrypted = [];
    for (const record of records) {
        try {
            const fac = record.payload;
            decrypted.push(fac);
        } catch (e) {
            console.error("Failed to decrypt facility", record.id, e);
        }
    }
    
    return decrypted;
}

export async function queueOfflineAssignment(referralId: string, facilityId: string): Promise<void> {
    if (!isIndexedDbAvailable()) throw new Error("IndexedDB unavailable");
    const db = getOfflineDb();
    await db.offline_assignments.put({
        id: crypto.randomUUID(),
        referralId,
        facilityId,
        status: 'pending',
        timestamp: Date.now()
    });
}

export async function pushOfflineAssignments(): Promise<void> {
    if (!isIndexedDbAvailable()) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    const user = getFirebaseAuth().currentUser;
    if (!user) return;

    const db = getOfflineDb();
    const pending = await db.offline_assignments.where('status').equals('pending').toArray();
    
    if (pending.length === 0) return;

    const token = await user.getIdToken();

    for (const assignment of pending) {
        try {
            const res = await fetch('/api/referral/assign-facility', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    referralId: assignment.referralId,
                    facilityId: assignment.facilityId
                })
            });

            if (res.ok) {
                await db.offline_assignments.update(assignment.id, { status: 'synced', syncedAt: Date.now() });
            } else if (res.status === 404 || res.status === 403 || res.status === 400) {
                // Permanent failure, mark as failed so it doesn't block forever
                await db.offline_assignments.update(assignment.id, { status: 'failed', error: await res.text() });
            }
        } catch (e) {
            // Network error, leave as pending
            console.error("Failed to push assignment", e);
        }
    }
}
