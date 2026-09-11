/**
 * @module triage-engine/fhir-types
 * @description
 * Minimal FHIR R4 type subset for ABDM conformance.
 *
 * We only define the resources needed for:
 * - OPConsultation profile (Composition)
 * - DiagnosticReport profile
 * - DocumentBundle (the wrapper)
 *
 * These types are intentionally minimal — we are NOT reimplementing
 * the full FHIR R4 spec (800+ resources). We define only what
 * `projectToFHIRBundle()` needs to produce valid ABDM-conformant output.
 *
 * Reference: https://nrces.in/ndhm/fhir/r4/StructureDefinition-OPConsultRecord.html
 */

export namespace FHIR {
  // ─── Primitives ────────────────────────────

  /** FHIR resource types we support. */
  export type ResourceType =
    | 'Bundle'
    | 'Composition'
    | 'Patient'
    | 'Practitioner'
    | 'Organization'
    | 'Encounter'
    | 'Observation'
    | 'DiagnosticReport'
    | 'ServiceRequest'
    | 'DocumentReference';

  /** FHIR coding — a code in a code system. */
  export interface Coding {
    system?: string;
    code: string;
    display?: string;
    version?: string;
  }

  /** FHIR CodeableConcept — one or more codings + optional text. */
  export interface CodeableConcept {
    coding?: Coding[];
    text?: string;
  }

  /** FHIR Reference — a reference to another resource. */
  export interface Reference {
    reference?: string;
    type?: ResourceType | string;
    display?: string;
    identifier?: Identifier;
  }

  /** FHIR Identifier — an identifier for a resource. */
  export interface Identifier {
    system?: string;
    value: string;
    type?: CodeableConcept;
    use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
  }

  /** FHIR Period — a time range. */
  export interface Period {
    start?: string; // ISO 8601
    end?: string;   // ISO 8601
  }

  /** FHIR HumanName. */
  export interface HumanName {
    use?: 'usual' | 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden';
    text?: string;
    family?: string;
    given?: string[];
  }

  /** FHIR Narrative — human-readable summary. */
  export interface Narrative {
    status: 'generated' | 'extensions' | 'additional' | 'empty';
    div: string; // XHTML
  }

  /** FHIR Quantity. */
  export interface Quantity {
    value?: number;
    unit?: string;
    system?: string;
    code?: string;
  }

  // ─── Meta ──────────────────────────────────

  export interface Meta {
    versionId?: string;
    lastUpdated?: string;
    profile?: string[];
    security?: Coding[];
    tag?: Coding[];
  }

  // ─── Base Resource ─────────────────────────

  export interface Resource {
    resourceType: ResourceType | string;
    id?: string;
    meta?: Meta;
  }

  // ─── Patient ───────────────────────────────

  export interface Patient extends Resource {
    resourceType: 'Patient';
    identifier?: Identifier[];
    name?: HumanName[];
    gender?: 'male' | 'female' | 'other' | 'unknown';
    birthDate?: string;
    telecom?: Array<{
      system?: 'phone' | 'email';
      value?: string;
      use?: 'home' | 'work' | 'temp' | 'mobile';
    }>;
    address?: Array<{
      use?: 'home' | 'work' | 'temp';
      text?: string;
      city?: string;
      district?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    }>;
  }

  // ─── Observation ───────────────────────────

  export interface Observation extends Resource {
    resourceType: 'Observation';
    status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled';
    category?: CodeableConcept[];
    code: CodeableConcept;
    subject?: Reference;
    effectiveDateTime?: string;
    valueQuantity?: Quantity;
    valueCodeableConcept?: CodeableConcept;
    valueString?: string;
    interpretation?: CodeableConcept[];
    component?: Array<{
      code: CodeableConcept;
      valueQuantity?: Quantity;
    }>;
  }

  // ─── Composition (OPConsultation) ──────────

  export interface CompositionSection {
    title: string;
    code?: CodeableConcept;
    text?: Narrative;
    entry?: Reference[];
  }

  export interface Composition extends Resource {
    resourceType: 'Composition';
    status: 'preliminary' | 'final' | 'amended' | 'entered-in-error';
    type: CodeableConcept;
    subject: Reference;
    date: string;
    author: Reference[];
    title: string;
    section?: CompositionSection[];
    encounter?: Reference;
  }

  // ─── DiagnosticReport ──────────────────────

  export interface DiagnosticReport extends Resource {
    resourceType: 'DiagnosticReport';
    status: 'registered' | 'partial' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'appended' | 'cancelled';
    category?: CodeableConcept[];
    code: CodeableConcept;
    subject?: Reference;
    effectiveDateTime?: string;
    issued?: string;
    result?: Reference[];
    conclusion?: string;
    conclusionCode?: CodeableConcept[];
  }

  // ─── ServiceRequest (Referral) ─────────────

  export interface ServiceRequest extends Resource {
    resourceType: 'ServiceRequest';
    status: 'draft' | 'active' | 'on-hold' | 'revoked' | 'completed' | 'entered-in-error' | 'unknown';
    intent: 'proposal' | 'plan' | 'directive' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order' | 'option';
    priority?: 'routine' | 'urgent' | 'asap' | 'stat';
    code?: CodeableConcept;
    subject: Reference;
    requester?: Reference;
    performer?: Reference[];
    reasonCode?: CodeableConcept[];
    reasonReference?: Reference[];
    note?: Array<{ text: string }>;
    occurrencePeriod?: Period;
  }

  // ─── Encounter ─────────────────────────────

  export interface EncounterResource extends Resource {
    resourceType: 'Encounter';
    status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled';
    class: Coding;
    type?: CodeableConcept[];
    subject?: Reference;
    period?: Period;
    serviceProvider?: Reference;
    location?: Array<{
      location: Reference;
      status?: 'planned' | 'active' | 'reserved' | 'completed';
    }>;
  }

  // ─── Bundle Entry ──────────────────────────

  export interface BundleEntry {
    fullUrl?: string;
    resource: Resource;
  }

  // ─── DocumentBundle ────────────────────────

  /**
   * FHIR Document Bundle — the top-level ABDM-conformant output.
   * This is what `projectToFHIRBundle()` produces.
   */
  export interface DocumentBundle extends Resource {
    resourceType: 'Bundle';
    type: 'document';
    timestamp: string;
    identifier?: Identifier;
    entry: BundleEntry[];
  }
}
