import type { DeviceId, PatientId, ReferralId, TriageRecordId } from '@/lib/core/ids';

export type SyncStatus = 'synced' | 'pending';
export type RiskLevel = 'RED' | 'YELLOW' | 'GREEN';
export type ReferralStatus = 'CREATED' | 'ACCEPTED' | 'CLOSED';
export type ReferralUrgency = 'ROUTINE' | 'URGENT' | 'EMERGENCY';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

/** Epoch milliseconds (client clock). Never used as a security boundary. */
export type EpochMs = number;

export interface SyncMeta {
  sync_status: SyncStatus;
  sync_attempts: number;
  next_attempt_at: EpochMs;
  last_sync_error: string | null;
  updated_at: EpochMs;
  /** Monotonic local revision, incremented on every local mutation. */
  rev: number;
  device_id: DeviceId;
  /** Firebase Auth uid of the ASHA worker who created the row. */
  created_by: string;
}

export interface Vitals {
  readonly temperature_f?: number | undefined;
  readonly systolic_bp?: number | undefined;
  readonly diastolic_bp?: number | undefined;
  readonly pulse_bpm?: number | undefined;
  readonly spo2_percent?: number | undefined;
  readonly respiratory_rate?: number | undefined;
  readonly blood_glucose_mgdl?: number | undefined;
  readonly weight_kg?: number | undefined;
  readonly height_cm?: number | undefined;
  readonly muac_cm?: number | undefined;
}

export interface Patient extends SyncMeta {
  id: PatientId;
  name: string;
  /** 14-digit ABHA number or ABHA address; null when not yet linked. */
  abha_id: string | null;
  gender: Gender;
  /** ISO-8601 date only (YYYY-MM-DD). */
  dob: string | null;
  age_years?: number | null;
  phone: string | null;
  created_at: EpochMs;
}

export interface TriageRecord extends SyncMeta {
  id: TriageRecordId;
  patient_id: PatientId;
  symptoms: readonly string[];
  vitals: Vitals;
  risk_level: RiskLevel;
  recommended_action: string;
  timestamp: EpochMs;
}

export interface Referral extends SyncMeta {
  id: ReferralId;
  patient_id: PatientId;
  /** Facility identifier (HFR id preferred over free text). */
  target_facility: string;
  urgency: ReferralUrgency;
  status: ReferralStatus;
  timestamp: EpochMs;
  triage_record_id: TriageRecordId | null;
}

/** Append-only local audit trail. Required for ABDM-style traceability. */
export interface SyncJournalEntry {
  seq?: number;
  entity: SyncableEntity;
  entity_id: string;
  action: 'CREATE' | 'UPDATE' | 'SYNC_OK' | 'SYNC_FAIL';
  occurred_at: EpochMs;
  actor_uid: string;
  device_id: DeviceId;
  note: string | null;
}


export type ConsentPurpose = 'CARE_DELIVERY' | 'BREAK_GLASS' | 'RESEARCH';
export type ConsentScope = 'DISTRICT_LEVEL' | 'FACILITY_LEVEL' | 'WORKER_ONLY';
export type ConsentStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';

export interface ConsentRecord extends SyncMeta {
  id: string;
  patient_id: PatientId;
  purpose: ConsentPurpose;
  scope: ConsentScope;
  grantee: string; // ID of the facility, district, or worker
  validity_until: EpochMs;
  status: ConsentStatus;
  notice_version: string;
  timestamp: EpochMs;
  revoked_at?: EpochMs;
  revoked_by?: string;
}

export type SyncableEntity = 'patients' | 'triage_records' | 'referrals' | 'consents';


export type SyncableRecord = Patient | TriageRecord | Referral;

/** Fields that must never cross the wire — local bookkeeping only. */
export const LOCAL_ONLY_FIELDS = [
  'sync_status',
  'sync_attempts',
  'next_attempt_at',
  'last_sync_error',
] as const satisfies readonly (keyof SyncMeta)[];


export type ServiceCategory = 'CLINICAL' | 'DIAGNOSTIC' | 'MEDICINE' | 'CAPACITY';
export type ServiceAvailability = 'AVAILABLE' | 'LIMITED' | 'UNAVAILABLE';

export interface FacilityService {
  serviceId: string;
  serviceName: string;
  category: ServiceCategory;
  availabilityStatus: ServiceAvailability;
  operatingDays?: string;
  operatingHours?: string;
  lastUpdatedAt: EpochMs;
  updatedByUid?: string;
}

export interface Facility {
  id: string;
  name: string;
  districtId: string;
  type: string;
  status: string;
  operatingDays?: string;
  operatingHours?: string;
  address?: string;
  contact?: string;
  services?: FacilityService[];
  schemaVersion: number;
}

