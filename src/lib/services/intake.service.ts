'use client';

import { z } from 'zod';

import {
  getDeviceId,
  newPatientId,
  newReferralId,
  newTriageRecordId,
  type PatientId,
  type ReferralId,
  type TriageRecordId,
} from '@/lib/core/ids';
import {
  appError,
  describeUnknown,
  err,
  ok,
  type AppError,
  type Result,
} from '@/lib/core/result';
import { appendJournal, getOfflineDb, isIndexedDbAvailable, storageUnavailableError } from '@/lib/db/offline-db';
import type { Patient, Referral, SyncMeta, TriageRecord, Vitals } from '@/lib/db/types';
import { getFirebaseAuth } from '@/lib/firebase/client';
import {
  patientIntakeSchema,
  referralIntakeSchema,
  triageIntakeSchema,
  type PatientIntakeInput,
  type ReferralIntakeInput,
  type TriageIntakeInput,
} from '@/lib/validation/schemas';
import { syncEngine } from '@/lib/sync/sync-engine';

export interface IntakeReceipt {
  readonly patient_id: PatientId;
  readonly triage_record_id: TriageRecordId;
  readonly referral_id: ReferralId | null;
  readonly patient_was_existing: boolean;
  readonly persisted_at: number;
  readonly sync_requested: boolean;
}

export interface SaveIntakeOptions {
  /** Explicit referral. RED triage auto-generates one when omitted. */
  readonly referral?: ReferralIntakeInput | undefined;
  /** Fallback facility for auto-generated RED referrals. */
  readonly defaultFacility?: string | undefined;
  /** Set false to queue without attempting an immediate push. */
  readonly triggerSync?: boolean | undefined;
  /** Captured consent block */
  readonly consent?: {
    purpose: 'CARE_DELIVERY' | 'BREAK_GLASS' | 'RESEARCH';
    scope: 'DISTRICT_LEVEL' | 'FACILITY_LEVEL' | 'WORKER_ONLY';
    grantee: string;
    notice_version: string;
  };

}

function freshSyncMeta(uid: string, at: number): SyncMeta {
  return {
    sync_status: 'pending',
    sync_attempts: 0,
    next_attempt_at: 0,
    last_sync_error: null,
    updated_at: at,
    rev: 1,
    device_id: getDeviceId(),
    created_by: uid,
  };
}

function flattenZodError(error: z.ZodError): AppError {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_root';
    fieldErrors[key] ??= issue.message;
  }
  return appError('VALIDATION_FAILED', 'Intake data failed validation.', {
    details: fieldErrors,
  });
}

/**
 * Durably persists a combined patient + triage intake to IndexedDB as
 * 'pending', then opportunistically requests a sync.
 *
 * Local-first and atomic: the write is committed before any network work is
 * considered, and the sync request is deliberately not awaited.
 */
export async function saveIntakeOffline(
  patientData: PatientIntakeInput,
  triageData: TriageIntakeInput,
  options: SaveIntakeOptions = {},
): Promise<Result<IntakeReceipt>> {
  if (!isIndexedDbAvailable()) return err(storageUnavailableError());

  // Zero-Trust: identity is required to *write*, not just to sync. Rows without
  // a verified owner can never satisfy server rules, so refuse them up front.
  const user = getFirebaseAuth().currentUser;
  if (user === null) {
    return err(
      appError('UNAUTHENTICATED', 'An authenticated ASHA worker session is required for intake.'),
    );
  }

  const parsedPatient = patientIntakeSchema.safeParse(patientData);
  if (!parsedPatient.success) return err(flattenZodError(parsedPatient.error));

  const parsedTriage = triageIntakeSchema.safeParse(triageData);
  if (!parsedTriage.success) return err(flattenZodError(parsedTriage.error));

  let parsedReferral: z.output<typeof referralIntakeSchema> | null = null;
  if (options.referral !== undefined) {
    const result = referralIntakeSchema.safeParse(options.referral);
    if (!result.success) return err(flattenZodError(result.error));
    parsedReferral = result.data;
  }

  const db = getOfflineDb();
  const uid = user.uid;
  const now = Date.now();

  const patientInput = parsedPatient.data;
  const triageInput = parsedTriage.data;

  // Auto-escalate RED triage into a referral so a critical case can never sit
  // in the queue without one.
  const effectiveReferral: z.output<typeof referralIntakeSchema> | null =
    parsedReferral ??
    (triageInput.risk_level === 'RED'
      ? {
          target_facility: options.defaultFacility ?? 'PENDING_ASSIGNMENT',
          urgency: 'EMERGENCY',
        }
      : null);

  try {
    const receipt = await db.transaction(
      'rw',
      [db.patients, db.triage_records, db.referrals, db.consents, db.sync_journal],
      async (): Promise<Omit<IntakeReceipt, 'sync_requested'>> => {
        // Reuse an existing local patient when ABHA matches — repeat visits in
        // one village must not fan out into duplicate records.
        let patientId: PatientId;
        let wasExisting = false;

        if (patientInput.abha_id !== null) {
          const existing = await db.patients
            .where('abha_id')
            .equals(patientInput.abha_id)
            .first();
          if (existing !== undefined) {
            patientId = existing.id;
            wasExisting = true;
            await db.patients.update(patientId, {
              name: patientInput.name,
              gender: patientInput.gender,
              dob: patientInput.dob || null,
              age_years: patientInput.age_years || null,
              phone: patientInput.phone,
              sync_status: 'pending',
              next_attempt_at: 0,
              sync_attempts: 0,
              last_sync_error: null,
              updated_at: now,
              rev: existing.rev + 1,
            });
          } else {
            patientId = newPatientId();
          }
        } else {
          patientId = newPatientId();
        }

        if (!wasExisting) {
          const patient: Patient = {
            id: patientId,
            name: patientInput.name,
            abha_id: patientInput.abha_id,
            gender: patientInput.gender,
            dob: patientInput.dob || null,
              age_years: patientInput.age_years || null,
            phone: patientInput.phone,
            created_at: now,
            ...freshSyncMeta(uid, now),
          };
          await db.patients.add(patient);
          await appendJournal(db, {
            entity: 'patients',
            entity_id: patientId,
            action: 'CREATE',
            occurred_at: now,
            actor_uid: uid,
            device_id: getDeviceId(),
            note: null,
          });
        }

        const triageId = newTriageRecordId();
        const triage: TriageRecord = {
          id: triageId,
          patient_id: patientId,
          symptoms: triageInput.symptoms,
          vitals: triageInput.vitals as Vitals,
          risk_level: triageInput.risk_level,
          recommended_action: triageInput.recommended_action,
          timestamp: now,
          ...freshSyncMeta(uid, now),
        };
        await db.triage_records.add(triage);
        await appendJournal(db, {
          entity: 'triage_records',
          entity_id: triageId,
          action: 'CREATE',
          occurred_at: now,
          actor_uid: uid,
          device_id: getDeviceId(),
          note: `risk=${triageInput.risk_level}`,
        });

        
          let referralId: ReferralId | null = null;
          if (effectiveReferral !== null) {
            referralId = newReferralId();
            const referral: Referral = {
              id: referralId,
              patient_id: patientId,
              target_facility: effectiveReferral.target_facility,
              urgency: effectiveReferral.urgency,
              status: 'CREATED',
              timestamp: now,
              triage_record_id: triageId,
              ...freshSyncMeta(uid, now),
            };
            await db.referrals.add(referral);
            await appendJournal(db, {
              entity: 'referrals',
              entity_id: referralId,
              action: 'CREATE',
              occurred_at: now,
              actor_uid: uid,
              device_id: getDeviceId(),
              note: `target=${effectiveReferral.target_facility}`,
            });
          }
  
          if (options.consent) {
            const consentId = 'con_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
            const consentRec = {
              id: consentId,
              patient_id: patientId,
              purpose: options.consent.purpose,
              scope: options.consent.scope,
              grantee: options.consent.grantee,
              validity_until: now + 365 * 24 * 60 * 60 * 1000,
              status: 'ACTIVE',
              notice_version: options.consent.notice_version,
              timestamp: now,
              ...freshSyncMeta(uid, now)
            };
            await db.consents.add(consentRec);
            await appendJournal(db, {
              entity: 'consents',
              entity_id: consentId,
              action: 'CREATE',
              occurred_at: now,
              actor_uid: uid,
              device_id: getDeviceId(),
              note: null,
            });
          }

          return {
          patient_id: patientId,
          triage_record_id: triageId,
          referral_id: referralId,
          patient_was_existing: wasExisting,
          persisted_at: now,
        };
      },
    );

    // Data is durable. Network work is fire-and-forget from here.
    const shouldSync =
      (options.triggerSync ?? true) &&
      typeof navigator !== 'undefined' &&
      navigator.onLine;

    if (shouldSync) {
      void syncEngine.requestSync('post-intake').catch(() => {
        /* Failures are already recorded on the rows themselves. */
      });
    }

    return ok({ ...receipt, sync_requested: shouldSync });
  } catch (error) {
    return err(
      appError('STORAGE_FAILED', 'Failed to persist intake to local storage.', {
        cause: describeUnknown(error),
      }),
    );
  }
}
