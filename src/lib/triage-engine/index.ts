/**
 * @module triage-engine
 * @description
 * Barrel export for the Triage Engine AI core domain module.
 *
 * Usage:
 *   import { InternalTriageCase, projectToFHIRBundle, computeTriageResult } from '@/lib/triage-engine';
 */

// ── Core Types ───────────────────────────────
export type {
  // Branded identifiers
  MedicalRecordId,
  ABHAId,
  ReferralCaseNumber,
  AdmissionNumber,
  UUIDv7,
  DeviceId,
  ActorId,

  // Subject
  SubjectIdentifiers,
  SubjectDemographics,
  TriageCaseSubject,

  // Encounter
  EncounterContext,
  HybridLogicalClock,

  // Protocol
  ProtocolChecklistItem,

  // Vitals
  VitalReading,
  StructuredVitals,

  // Triage
  TriageResult,

  // AI
  CaptureQualityControl,
  ConformalSetMember,
  OODCheck,
  AI_Screening_Record,

  // Referral
  ReferralTransition,
  ReferralState,

  // Ownership & Media
  FieldOwnership,
  MediaAttachment,

  // Case
  InternalTriageCase,
  SyncStatus,
} from './types';

export {
  TriageTier,
  TRIAGE_TIER_ORDINAL,
  ReferralStatus,
} from './types';

export type {
  VitalSource,
  ReferralClosureReason,
} from './types';

// ── HLC ──────────────────────────────────────
export {
  createHLC,
  tickHLC,
  receiveHLC,
  compareHLC,
  serializeHLC,
  deserializeHLC,
  HLCDriftError,
} from './hlc';

// ── UUIDv7 ───────────────────────────────────
export {
  generateUUIDv7,
  extractTimestamp,
  isValidUUIDv7,
} from './uuidv7';

// ── Triage Engine ────────────────────────────
export type { TriageRule, DeterministicRulesResult } from './triage-engine';
export {
  STANDARD_TRIAGE_RULES,
  runDeterministicRules,
  applyAIEscalation,
  computeTriageResult,
} from './triage-engine';

// ── FHIR Types ───────────────────────────────
export type { FHIR } from './fhir-types';

// ── FHIR Mapper ──────────────────────────────
export { projectToFHIRBundle } from './fhir-mapper';

// ── Protocol Definitions ─────────────────────
export type { ProtocolGroup, ProtocolItemTemplate } from './protocol-definitions';
export { PROTOCOL_GROUPS, createChecklistItem } from './protocol-definitions';
