/**
 * @module triage-engine/types
 * @description
 * Master type definitions for the caresanchaar AI triage platform.
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. No free-text symptoms — all capture via ProtocolChecklistItem[] with coded danger signs.
 * 2. AI Safety — 3-stage gate (CaptureQC → OOD → Inference); AI may only escalate, never de-escalate.
 * 3. 2-Schema Split — InternalTriageCase is mutable system-of-record; FHIR is a pure projection.
 * 4. Identity — Local MR minted first; ABHA linkage is opportunistic.
 */

// ─────────────────────────────────────────────
// §1  Branded Types (Nominal Typing)
// ─────────────────────────────────────────────

/** Prevents accidental swapping of identifier types at the type level. */
type Brand<T, B extends string> = T & { readonly __brand: B };

/** Local Medical Record number — always minted at intake. */
export type MedicalRecordId = Brand<string, 'MedicalRecordId'>;

/** Ayushman Bharat Health Account — 14-digit, linked opportunistically post-intake. */
export type ABHAId = Brand<string, 'ABHAId'>;

/** Referral Case Number — assigned when a referral is created. */
export type ReferralCaseNumber = Brand<string, 'ReferralCaseNumber'>;

/** Admission Number — assigned at the receiving facility. */
export type AdmissionNumber = Brand<string, 'AdmissionNumber'>;

/** UUIDv7 primary key — time-ordered. */
export type UUIDv7 = Brand<string, 'UUIDv7'>;

/** Device identifier — fingerprint or installation UUID. */
export type DeviceId = Brand<string, 'DeviceId'>;

/** Actor identifier — user/system who performed an action. */
export type ActorId = Brand<string, 'ActorId'>;

// ─────────────────────────────────────────────
// §2  Hybrid Logical Clock
// ─────────────────────────────────────────────

/**
 * Hybrid Logical Clock for causality-preserving offline sync.
 * Combines wall-clock time with a logical counter to guarantee
 * a total ordering even when device clocks drift.
 */
export interface HybridLogicalClock {
  /** Unix epoch milliseconds — capped to wall clock. */
  readonly wallTime: number;
  /** Monotonic logical counter — increments on ties. */
  readonly logicalCounter: number;
  /** Originating device node ID. */
  readonly nodeId: DeviceId;
}

// ─────────────────────────────────────────────
// §3  Subject & Identifier Ladder
// ─────────────────────────────────────────────

/**
 * The identifier ladder for a patient subject.
 * `mr` is ALWAYS present (minted locally at intake).
 * All others are optional and linked progressively.
 */
export interface SubjectIdentifiers {
  /** Local Medical Record — always present, never null. */
  readonly mr: MedicalRecordId;
  /** ABHA ID — linked opportunistically, never blocks intake. */
  readonly abha?: ABHAId;
  /** Referral Case Number — assigned when referral is created. */
  readonly rcn?: ReferralCaseNumber;
  /** Admission Number — assigned at receiving facility. */
  readonly adn?: AdmissionNumber;
}

/** Demographic info captured at intake. */
export interface SubjectDemographics {
  readonly name: string;
  readonly ageYears?: number;
  /** Estimated age bucket when exact age is unknown. */
  readonly ageBucket?: 'neonate' | 'infant' | 'child' | 'adolescent' | 'adult' | 'elderly';
  readonly gender?: 'male' | 'female' | 'other' | 'unknown';
  readonly village?: string;
  readonly district?: string;
  readonly state?: string;
  readonly phoneNumber?: string;
}

export interface TriageCaseSubject {
  readonly identifiers: SubjectIdentifiers;
  readonly demographics: SubjectDemographics;
}

// ─────────────────────────────────────────────
// §4  Encounter Context
// ─────────────────────────────────────────────

/**
 * Encounter metadata capturing dual timestamps and HLC.
 * `deviceClaimedTime` may be inaccurate (user-set clock).
 * `serverReceivedTime` is authoritative but only set on sync.
 */
export interface EncounterContext {
  /** HLC at the moment of case creation on device. */
  readonly hlc: HybridLogicalClock;
  /** ISO 8601 timestamp claimed by the device at creation. */
  readonly deviceClaimedTime: string;
  /** ISO 8601 timestamp set by the server on first sync. Null while offline. */
  serverReceivedTime: string | null;
  /** Device that created this encounter. */
  readonly deviceId: DeviceId;
  /** GPS coordinates at intake, if available. */
  readonly geoLocation?: {
    readonly latitude: number;
    readonly longitude: number;
    readonly accuracyMeters?: number;
  };
  /** Facility code where intake occurred (e.g., PHC/Sub-Centre ID). */
  readonly facilityCode?: string;
}

// ─────────────────────────────────────────────
// §5  Protocol Checklist (Structured Intake)
// ─────────────────────────────────────────────

/**
 * A single coded danger-sign item from a clinical protocol.
 * NO free-text fields. The `code` is a standardised identifier
 * (SNOMED-CT preferred, custom code if no SNOMED mapping exists).
 */
export interface ProtocolChecklistItem {
  /** SNOMED-CT code or custom caresanchaar code (e.g., 'DV-DANGER-001'). */
  readonly code: string;
  /** Human-readable label (localised at display time). */
  readonly label: string;
  /** Protocol this item belongs to (e.g., 'IMNCI', 'ANC', 'NCD-HTN'). */
  readonly protocolId: string;
  /** Whether the danger sign is present. */
  present: boolean;
  /** Who captured this data point. */
  readonly capturedBy: ActorId;
  /** ISO 8601 timestamp of capture. */
  readonly capturedAt: string;
}

// ─────────────────────────────────────────────
// §6  Structured Vitals
// ─────────────────────────────────────────────

/** Source of a vital reading. */
export type VitalSource =
  | 'manual_entry'
  | 'ble_pulse_oximeter'
  | 'ble_bp_monitor'
  | 'ble_thermometer'
  | 'ai_estimate';

export interface VitalReading<T = number> {
  readonly value: T;
  readonly unit: string;
  readonly source: VitalSource;
  readonly capturedBy: ActorId;
  readonly capturedAt: string;
  /** Device model/ID for BLE sources. */
  readonly deviceModel?: string;
}

/**
 * Structured vitals — numeric, typed, source-tracked.
 * Every field is optional because not all vitals are available at every encounter.
 */
export interface StructuredVitals {
  spO2?: VitalReading;          // unit: '%'
  heartRate?: VitalReading;     // unit: 'bpm'
  temperature?: VitalReading;   // unit: '°C'
  respiratoryRate?: VitalReading; // unit: 'breaths/min'
  systolicBP?: VitalReading;    // unit: 'mmHg'
  diastolicBP?: VitalReading;   // unit: 'mmHg'
  bloodGlucose?: VitalReading;  // unit: 'mg/dL'
  weight?: VitalReading;        // unit: 'kg'
  muac?: VitalReading;          // Mid-Upper Arm Circumference, unit: 'cm'
}

// ─────────────────────────────────────────────
// §7  Triage Tier (Ordinal)
// ─────────────────────────────────────────────

/**
 * Triage severity tiers — ordered by severity.
 * GREEN < YELLOW < ORANGE < RED.
 * The AI "may only escalate" invariant is enforced by comparing ordinals.
 */
export enum TriageTier {
  GREEN  = 'GREEN',
  YELLOW = 'YELLOW',
  ORANGE = 'ORANGE',
  RED    = 'RED',
}

/** Numeric ordinal for comparison. Higher = more severe. */
export const TRIAGE_TIER_ORDINAL: Record<TriageTier, number> = {
  [TriageTier.GREEN]:  0,
  [TriageTier.YELLOW]: 1,
  [TriageTier.ORANGE]: 2,
  [TriageTier.RED]:    3,
} as const;

export interface TriageResult {
  /** Tier set by the deterministic rules engine (Step A). */
  readonly deterministicTier: TriageTier;
  /** Tier proposed by AI inference (Step B). May be null if AI was skipped. */
  readonly aiProposedTier: TriageTier | null;
  /** Final tier after enforcing "AI may only escalate" (Step C). */
  readonly finalTier: TriageTier;
  /** Rule IDs that fired in the deterministic engine. */
  readonly firedRuleIds: ReadonlyArray<string>;
  /** ISO 8601 timestamp of triage computation. */
  readonly computedAt: string;
}

// ─────────────────────────────────────────────
// §8  AI Screening Record (3-Stage Gate)
// ─────────────────────────────────────────────

/** Capture Quality Control — gate 1 of the AI pipeline. */
export interface CaptureQualityControl {
  /** Whether the capture passed quality thresholds. */
  readonly passed: boolean;
  /** Brightness score [0,1]. Below 0.2 typically fails. */
  readonly brightnessScore: number;
  /** Blur score [0,1]. Below 0.3 typically fails. */
  readonly blurScore: number;
  /** Completeness — are all required fields/inputs present? */
  readonly completeness: number;
  /** Human-readable rejection reason if failed. */
  readonly rejectionReason?: string;
}

/** A single member of the conformal prediction set. */
export interface ConformalSetMember {
  /** Predicted label / condition. */
  readonly label: string;
  /** SNOMED-CT code for this condition, if available. */
  readonly snomedCode?: string;
  /** Conformal p-value — higher means more plausible. */
  readonly pValue: number;
}

/** Out-of-Distribution check — gate 2 of the AI pipeline. */
export interface OODCheck {
  /** OOD score [0,1]. Higher means MORE out-of-distribution (less trustworthy). */
  readonly score: number;
  /** Threshold above which inference should be rejected. */
  readonly threshold: number;
  /** Whether the input was flagged as OOD. */
  readonly flagged: boolean;
}

/**
 * AI Screening Record — one per AI module invocation.
 * Enforces the 3-stage gate: CaptureQC → OOD → Inference.
 * If any gate fails, downstream fields are null.
 */
export interface AI_Screening_Record {
  /** Unique ID for this screening invocation. */
  readonly id: UUIDv7;
  /** AI module type (e.g., 'skin_scan', 'cough_analysis', 'vitals_ocr'). */
  readonly moduleType: string;
  /** Model version string (e.g., 'skin-v2.3.1'). */
  readonly modelVersion: string;

  // ── Gate 1: Capture QC ──
  readonly captureQc: CaptureQualityControl;

  // ── Gate 2: OOD Check ──
  /** Null if captureQc.passed === false (gate 1 blocked). */
  readonly oodCheck: OODCheck | null;

  // ── Gate 3: Inference ──
  /** Conformal prediction set. Null if OOD check failed or was flagged. */
  readonly conformalSet: ReadonlyArray<ConformalSetMember> | null;
  /** AI-proposed triage tier based on inference. Null if inference was skipped. */
  readonly proposedTier: TriageTier | null;

  /** Inference latency in milliseconds. */
  readonly inferenceLatencyMs: number | null;
  /** Reference to encrypted raw model output blob (for audit). */
  readonly rawModelOutputRef: string | null;
  /** ISO 8601 timestamp of this screening. */
  readonly performedAt: string;
}

// ─────────────────────────────────────────────
// §9  Referral State Machine
// ─────────────────────────────────────────────

/** Referral lifecycle states — strictly uni-directional. */
export enum ReferralStatus {
  DRAFT   = 'DRAFT',
  SENT    = 'SENT',
  ARRIVED = 'ARRIVED',
  CLOSED  = 'CLOSED',
}

/** A single state transition in the referral lifecycle. */
export interface ReferralTransition {
  readonly from: ReferralStatus;
  readonly to: ReferralStatus;
  readonly at: string;    // ISO 8601
  readonly by: ActorId;
  readonly note?: string;
}

/** Referral closure disposition. */
export type ReferralClosureReason =
  | 'treated_at_phc'
  | 'admitted'
  | 'referred_higher'
  | 'patient_refused'
  | 'patient_not_found'
  | 'resolved_at_home';

/**
 * Server-owned referral state machine.
 * Transitions: Draft → Sent → Arrived → Closed.
 * SLA tracking is built-in.
 */
export interface ReferralState {
  /** Current status in the lifecycle. */
  status: ReferralStatus;
  /** Target facility code (PHC/CHC/DH). */
  readonly targetFacilityCode: string;
  /** Target facility name (human-readable). */
  readonly targetFacilityName: string;
  /** ISO 8601 deadline for SLA compliance. */
  readonly slaDeadline: string;
  /** Whether the SLA has been breached. Server-computed. */
  slaBreached: boolean;
  /** Closure disposition. Only set when status === CLOSED. */
  closureReason?: ReferralClosureReason;
  /** Complete transition history — append-only. */
  readonly transitions: ReadonlyArray<ReferralTransition>;
}

// ─────────────────────────────────────────────
// §10  Per-Field Ownership
// ─────────────────────────────────────────────

/**
 * Tracks who wrote what and when, for conflict resolution.
 * Used for CvRDT-style last-writer-wins at the field level.
 */
export interface FieldOwnership {
  readonly fieldPath: string;
  readonly writtenBy: ActorId;
  readonly writtenAt: string; // ISO 8601
  readonly hlc: HybridLogicalClock;
}

// ─────────────────────────────────────────────
// §11  Media Attachment
// ─────────────────────────────────────────────

export interface MediaAttachment {
  /** Unique ID for this attachment. */
  readonly id: UUIDv7;
  /** MIME type (e.g., 'image/jpeg', 'audio/webm'). */
  readonly mimeType: string;
  /** Size in bytes. */
  readonly sizeBytes: number;
  /** SHA-256 hash of the full file — used for dedup and integrity. */
  readonly sha256: string;
  /** Upload status. */
  uploadStatus: 'pending' | 'uploading' | 'uploaded' | 'failed';
  /** Remote storage URI once uploaded. Null while pending. */
  remoteUri: string | null;
  /** Local IndexedDB blob key for offline access. */
  readonly localBlobKey: string;
}

// ─────────────────────────────────────────────
// §12  InternalTriageCase — The System of Record
// ─────────────────────────────────────────────

/** Sync status of this case with the server. */
export type SyncStatus = 'unsynced' | 'syncing' | 'synced' | 'conflict';

/**
 * The mutable, internal system-of-record for a triage case.
 * This is the ONLY source of truth. FHIR/ABDM conformance is achieved
 * via the pure `projectToFHIRBundle()` mapper — never stored directly.
 *
 * INVARIANTS:
 * - `id` is UUIDv7 (time-ordered).
 * - `subject.identifiers.mr` is ALWAYS present.
 * - `protocolChecklist` uses coded items, never free text.
 * - `triageResult.finalTier >= triageResult.deterministicTier` (AI may only escalate).
 */
export interface InternalTriageCase {
  /** UUIDv7 primary key — time-ordered, globally unique. */
  readonly id: UUIDv7;

  /** Schema version for forward/backward compatibility. Semver string. */
  readonly schemaVersion: '1.0.0';

  /** Patient subject with identifier ladder. */
  subject: TriageCaseSubject;

  /** Encounter context — HLC, timestamps, device, location. */
  readonly encounter: EncounterContext;

  /**
   * Offline duplicate detection.
   * If another device created a case for the same patient around the same time,
   * this field points to the candidate duplicate's ID for manual resolution.
   */
  candidateDuplicateOf: UUIDv7 | null;

  /** Protocol-driven structured checklist — coded danger signs. */
  protocolChecklist: ProtocolChecklistItem[];

  /** Structured numeric vitals. */
  vitals: StructuredVitals;

  /** AI screening records — one per module invocation. */
  aiScreenings: AI_Screening_Record[];

  /** Triage result — deterministic baseline + AI escalation. */
  triageResult: TriageResult | null;

  /** Referral state machine. Null if no referral needed. */
  referral: ReferralState | null;

  /** Media attachments (photos, audio). */
  attachments: MediaAttachment[];

  /** Per-field ownership for conflict resolution. */
  fieldOwnership: FieldOwnership[];

  /** Sync status with the server. */
  syncStatus: SyncStatus;

  /** Idempotency key for safe retries. */
  readonly idempotencyKey: string;

  /** ISO 8601 — last local modification time. */
  updatedAt: string;

  /** ISO 8601 — creation time. */
  readonly createdAt: string;
}
