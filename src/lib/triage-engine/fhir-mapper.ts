/**
 * @module triage-engine/fhir-mapper
 * @description
 * Pure, deterministic mapper that projects an InternalTriageCase
 * into an ABDM-conformant FHIR DocumentBundle.
 *
 * ARCHITECTURAL INVARIANT #3 (2-Schema Split):
 * This function is the ONLY bridge between the internal mutable schema
 * and the external FHIR world. It is:
 * - Pure: No side effects, no network calls, no mutations.
 * - Deterministic: Same input → same output, always.
 * - Projective: Never writes back to InternalTriageCase.
 *
 * The output conforms to ABDM's:
 * - OPConsultation profile (Composition)
 * - DiagnosticReport profile
 *
 * Reference: https://nrces.in/ndhm/fhir/r4/StructureDefinition-OPConsultRecord.html
 */

import type { InternalTriageCase, TriageTier } from './types';
import type { FHIR } from './fhir-types';

// ─── ABDM Code Systems ──────────────────────

const LOINC = 'http://loinc.org';
const SNOMED = 'http://snomed.info/sct';
const ABDM_PROFILE_OP_CONSULT = 'https://nrces.in/ndhm/fhir/r4/StructureDefinition/OPConsultRecord';
const ABDM_PROFILE_DIAGNOSTIC = 'https://nrces.in/ndhm/fhir/r4/StructureDefinition/DiagnosticReportLab';
const ABDM_ID_SYSTEM_MR = 'urn:caresanchaar:mr';
const ABDM_ID_SYSTEM_ABHA = 'https://healthid.ndhm.gov.in';

// ─── Vital Code Mappings ─────────────────────

interface VitalMapping {
  readonly loincCode: string;
  readonly display: string;
  readonly unit: string;
  readonly ucumCode: string;
}

const VITAL_LOINC_MAP: Record<string, VitalMapping> = {
  spO2:            { loincCode: '2708-6',  display: 'Oxygen saturation',     unit: '%',            ucumCode: '%' },
  heartRate:       { loincCode: '8867-4',  display: 'Heart rate',            unit: 'beats/minute', ucumCode: '/min' },
  temperature:     { loincCode: '8310-5',  display: 'Body temperature',      unit: '°C',           ucumCode: 'Cel' },
  respiratoryRate: { loincCode: '9279-1',  display: 'Respiratory rate',      unit: 'breaths/min',  ucumCode: '/min' },
  systolicBP:      { loincCode: '8480-6',  display: 'Systolic blood pressure', unit: 'mmHg',       ucumCode: 'mm[Hg]' },
  diastolicBP:     { loincCode: '8462-4',  display: 'Diastolic blood pressure', unit: 'mmHg',      ucumCode: 'mm[Hg]' },
  bloodGlucose:    { loincCode: '2339-0',  display: 'Glucose [Mass/volume] in Blood', unit: 'mg/dL', ucumCode: 'mg/dL' },
  weight:          { loincCode: '29463-7', display: 'Body weight',           unit: 'kg',           ucumCode: 'kg' },
  muac:            { loincCode: '56072-2', display: 'Mid upper arm circumference', unit: 'cm',     ucumCode: 'cm' },
} as const;

// ─── Triage Tier → FHIR Mapping ──────────────

const TRIAGE_TIER_SNOMED: Record<TriageTier, { code: string; display: string }> = {
  GREEN:  { code: '1285119007', display: 'Standard triage category (finding)' },
  YELLOW: { code: '1285118004', display: 'Urgent triage category (finding)' },
  ORANGE: { code: '1285117009', display: 'Very urgent triage category (finding)' },
  RED:    { code: '1285116000', display: 'Immediate triage category (finding)' },
};

// ─── Internal helpers ────────────────────────

let _resourceCounter = 0;

function _resetCounter(): void {
  _resourceCounter = 0;
}

function _nextResourceId(prefix: string): string {
  return `${prefix}-${++_resourceCounter}`;
}

function _makeFullUrl(resourceId: string): string {
  return `urn:uuid:${resourceId}`;
}

// ─── Patient Mapping ─────────────────────────

function _mapPatient(triageCase: InternalTriageCase): FHIR.Patient {
  const { identifiers, demographics } = triageCase.subject;

  const fhirIdentifiers: FHIR.Identifier[] = [
    {
      system: ABDM_ID_SYSTEM_MR,
      value: identifiers.mr,
      type: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'MR', display: 'Medical record number' }],
      },
      use: 'usual',
    },
  ];

  if (identifiers.abha) {
    fhirIdentifiers.push({
      system: ABDM_ID_SYSTEM_ABHA,
      value: identifiers.abha,
      type: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'MR', display: 'ABHA Number' }],
      },
      use: 'official',
    });
  }

  const patient: FHIR.Patient = {
    resourceType: 'Patient',
    id: _nextResourceId('patient'),
    identifier: fhirIdentifiers,
    name: [{ text: demographics.name, use: 'official' }],
  };

  if (demographics.gender) {
    patient.gender = demographics.gender;
  }

  if (demographics.phoneNumber) {
    patient.telecom = [{ system: 'phone', value: demographics.phoneNumber, use: 'mobile' }];
  }

  if (demographics.village || demographics.district || demographics.state) {
    patient.address = [{
      use: 'home',
      text: [demographics.village, demographics.district, demographics.state].filter(Boolean).join(', '),
      city: demographics.village,
      district: demographics.district,
      state: demographics.state,
      country: 'IN',
    }];
  }

  return patient;
}

// ─── Encounter Mapping ───────────────────────

function _mapEncounter(
  triageCase: InternalTriageCase,
  patientRef: string
): FHIR.EncounterResource {
  const encounter: FHIR.EncounterResource = {
    resourceType: 'Encounter',
    id: _nextResourceId('encounter'),
    status: 'finished',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'AMB',
      display: 'ambulatory',
    },
    subject: { reference: patientRef },
    period: {
      start: triageCase.encounter.deviceClaimedTime,
    },
  };

  if (triageCase.encounter.facilityCode) {
    encounter.serviceProvider = {
      display: triageCase.encounter.facilityCode,
    };
  }

  return encounter;
}

// ─── Vitals → Observations ───────────────────

function _mapVitals(
  triageCase: InternalTriageCase,
  patientRef: string
): FHIR.Observation[] {
  const observations: FHIR.Observation[] = [];
  const vitals = triageCase.vitals;

  for (const [key, mapping] of Object.entries(VITAL_LOINC_MAP)) {
    const vitalKey = key as keyof typeof triageCase.vitals;
    const reading = vitals[vitalKey];
    if (!reading) continue;

    observations.push({
      resourceType: 'Observation',
      id: _nextResourceId('obs'),
      status: 'final',
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'vital-signs',
          display: 'Vital Signs',
        }],
      }],
      code: {
        coding: [{ system: LOINC, code: mapping.loincCode, display: mapping.display }],
        text: mapping.display,
      },
      subject: { reference: patientRef },
      effectiveDateTime: reading.capturedAt,
      valueQuantity: {
        value: reading.value,
        unit: mapping.unit,
        system: 'http://unitsofmeasure.org',
        code: mapping.ucumCode,
      },
    });
  }

  return observations;
}

// ─── Triage → Observation ────────────────────

function _mapTriageObservation(
  triageCase: InternalTriageCase,
  patientRef: string
): FHIR.Observation | null {
  if (!triageCase.triageResult) return null;

  const { finalTier, firedRuleIds, computedAt } = triageCase.triageResult;
  const tierInfo = TRIAGE_TIER_SNOMED[finalTier];

  return {
    resourceType: 'Observation',
    id: _nextResourceId('obs-triage'),
    status: 'final',
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
        code: 'exam',
        display: 'Exam',
      }],
    }],
    code: {
      coding: [{ system: SNOMED, code: '225390008', display: 'Triage' }],
      text: 'Triage Assessment',
    },
    subject: { reference: patientRef },
    effectiveDateTime: computedAt,
    valueCodeableConcept: {
      coding: [{ system: SNOMED, code: tierInfo.code, display: tierInfo.display }],
      text: `Triage: ${finalTier}`,
    },
    interpretation: [{
      text: `Fired rules: ${firedRuleIds.join(', ') || 'none'}`,
    }],
  };
}

// ─── AI Screenings → DiagnosticReports ───────

function _mapAIScreenings(
  triageCase: InternalTriageCase,
  patientRef: string
): FHIR.DiagnosticReport[] {
  return triageCase.aiScreenings
    .filter((screening) => screening.conformalSet !== null && screening.conformalSet.length > 0)
    .map((screening) => {
      const conclusionParts: string[] = [];

      if (screening.conformalSet) {
        for (const member of screening.conformalSet) {
          conclusionParts.push(`${member.label} (p=${member.pValue.toFixed(3)})`);
        }
      }

      const conclusionCodes: FHIR.CodeableConcept[] = (screening.conformalSet ?? [])
        .filter((m) => m.snomedCode)
        .map((m) => ({
          coding: [{ system: SNOMED, code: m.snomedCode!, display: m.label }],
          text: m.label,
        }));

      return {
        resourceType: 'DiagnosticReport' as const,
        id: _nextResourceId('diag-report'),
        meta: {
          profile: [ABDM_PROFILE_DIAGNOSTIC],
        },
        status: 'final' as const,
        category: [{
          coding: [{ system: LOINC, code: '75321-0', display: 'Clinical finding' }],
        }],
        code: {
          coding: [{ system: LOINC, code: '75321-0', display: 'Clinical finding' }],
          text: `AI Screening: ${screening.moduleType}`,
        },
        subject: { reference: patientRef },
        effectiveDateTime: screening.performedAt,
        issued: screening.performedAt,
        conclusion: `AI Module: ${screening.moduleType} (v${screening.modelVersion}). ` +
          `Conformal set: ${conclusionParts.join('; ')}. ` +
          `OOD score: ${screening.oodCheck?.score.toFixed(3) ?? 'N/A'}.`,
        conclusionCode: conclusionCodes.length > 0 ? conclusionCodes : undefined,
      };
    });
}

// ─── Referral → ServiceRequest ───────────────

function _mapReferral(
  triageCase: InternalTriageCase,
  patientRef: string
): FHIR.ServiceRequest | null {
  if (!triageCase.referral) return null;

  const referral = triageCase.referral;

  const statusMap: Record<string, FHIR.ServiceRequest['status']> = {
    DRAFT: 'draft',
    SENT: 'active',
    ARRIVED: 'active',
    CLOSED: 'completed',
  };

  const priorityMap: Record<string, FHIR.ServiceRequest['priority']> = {
    GREEN: 'routine',
    YELLOW: 'urgent',
    ORANGE: 'asap',
    RED: 'stat',
  };

  return {
    resourceType: 'ServiceRequest',
    id: _nextResourceId('service-request'),
    status: statusMap[referral.status] ?? 'unknown',
    intent: 'order',
    priority: triageCase.triageResult
      ? priorityMap[triageCase.triageResult.finalTier]
      : 'routine',
    code: {
      coding: [{ system: SNOMED, code: '3457005', display: 'Patient referral' }],
      text: `Referral to ${referral.targetFacilityName}`,
    },
    subject: { reference: patientRef },
    performer: [{ display: referral.targetFacilityName }],
    note: referral.transitions.map((t) => ({
      text: `${t.from} → ${t.to} at ${t.at} by ${t.by}${t.note ? ': ' + t.note : ''}`,
    })),
  };
}

// ─── Composition (OPConsultation) ────────────

function _buildComposition(
  patientRef: string,
  encounterRef: string,
  vitalRefs: string[],
  triageRef: string | null,
  diagnosticRefs: string[],
  referralRef: string | null,
  triageCase: InternalTriageCase
): FHIR.Composition {
  const sections: FHIR.CompositionSection[] = [];

  // Vitals section
  if (vitalRefs.length > 0) {
    sections.push({
      title: 'Vital Signs',
      code: {
        coding: [{ system: LOINC, code: '8716-3', display: 'Vital signs' }],
      },
      entry: vitalRefs.map((ref) => ({ reference: ref })),
    });
  }

  // Triage section
  if (triageRef) {
    sections.push({
      title: 'Triage Assessment',
      code: {
        coding: [{ system: SNOMED, code: '225390008', display: 'Triage' }],
      },
      entry: [{ reference: triageRef }],
    });
  }

  // AI Diagnostic Reports section
  if (diagnosticRefs.length > 0) {
    sections.push({
      title: 'AI Screening Results',
      code: {
        coding: [{ system: LOINC, code: '30954-2', display: 'Relevant diagnostic tests/laboratory data' }],
      },
      entry: diagnosticRefs.map((ref) => ({ reference: ref })),
    });
  }

  // Referral section
  if (referralRef) {
    sections.push({
      title: 'Referral',
      code: {
        coding: [{ system: SNOMED, code: '3457005', display: 'Patient referral' }],
      },
      entry: [{ reference: referralRef }],
    });
  }

  // Protocol checklist section (as narrative — checklist items are not individual FHIR resources)
  if (triageCase.protocolChecklist.length > 0) {
    const presentSigns = triageCase.protocolChecklist.filter((item) => item.present);
    const absentSigns = triageCase.protocolChecklist.filter((item) => !item.present);

    let div = '<div xmlns="http://www.w3.org/1999/xhtml">';
    div += '<h3>Protocol Checklist</h3>';

    if (presentSigns.length > 0) {
      div += '<p><strong>Present Danger Signs:</strong></p><ul>';
      for (const sign of presentSigns) {
        div += `<li>[${sign.code}] ${sign.label}</li>`;
      }
      div += '</ul>';
    }

    if (absentSigns.length > 0) {
      div += '<p><strong>Absent/Not Observed:</strong></p><ul>';
      for (const sign of absentSigns) {
        div += `<li>[${sign.code}] ${sign.label}</li>`;
      }
      div += '</ul>';
    }

    div += '</div>';

    sections.push({
      title: 'Clinical Assessment - Protocol Checklist',
      code: {
        coding: [{ system: LOINC, code: '51848-0', display: 'Evaluation note' }],
      },
      text: { status: 'generated', div },
    });
  }

  return {
    resourceType: 'Composition',
    id: _nextResourceId('composition'),
    meta: {
      profile: [ABDM_PROFILE_OP_CONSULT],
    },
    status: 'final',
    type: {
      coding: [{
        system: SNOMED,
        code: '371530004',
        display: 'Clinical consultation report',
      }],
      text: 'OP Consultation Record',
    },
    subject: { reference: patientRef },
    encounter: { reference: encounterRef },
    date: triageCase.encounter.deviceClaimedTime,
    author: [{ display: 'caresanchaar AI Triage System' }],
    title: 'caresanchaar AI — OP Consultation Record',
    section: sections,
  };
}

// ─── Main Mapper ─────────────────────────────

/**
 * Projects an InternalTriageCase into an ABDM-conformant FHIR DocumentBundle.
 *
 * This is the ONLY function that bridges the internal schema to the external
 * FHIR world. It is:
 * - **Pure**: No side effects, no network calls, no mutations to the input.
 * - **Deterministic**: Same input → same output (given same internal counter state).
 * - **Projective**: Read-only access to InternalTriageCase; never writes back.
 *
 * Output conforms to:
 * - ABDM OPConsultation profile (Composition)
 * - ABDM DiagnosticReport profile
 *
 * @param triageCase - The mutable internal system-of-record.
 * @returns An ABDM-conformant FHIR DocumentBundle.
 */
export function projectToFHIRBundle(triageCase: InternalTriageCase): FHIR.DocumentBundle {
  // Reset counter for deterministic IDs within this bundle.
  _resetCounter();

  const entries: FHIR.BundleEntry[] = [];

  // 1. Patient
  const patient = _mapPatient(triageCase);
  const patientRef = _makeFullUrl(patient.id!);
  entries.push({ fullUrl: patientRef, resource: patient });

  // 2. Encounter
  const encounter = _mapEncounter(triageCase, patientRef);
  const encounterRef = _makeFullUrl(encounter.id!);
  entries.push({ fullUrl: encounterRef, resource: encounter });

  // 3. Vital Observations
  const vitalObs = _mapVitals(triageCase, patientRef);
  const vitalRefs: string[] = [];
  for (const obs of vitalObs) {
    const ref = _makeFullUrl(obs.id!);
    vitalRefs.push(ref);
    entries.push({ fullUrl: ref, resource: obs });
  }

  // 4. Triage Observation
  const triageObs = _mapTriageObservation(triageCase, patientRef);
  let triageRef: string | null = null;
  if (triageObs) {
    triageRef = _makeFullUrl(triageObs.id!);
    entries.push({ fullUrl: triageRef, resource: triageObs });
  }

  // 5. AI Diagnostic Reports
  const diagnosticReports = _mapAIScreenings(triageCase, patientRef);
  const diagnosticRefs: string[] = [];
  for (const report of diagnosticReports) {
    const ref = _makeFullUrl(report.id!);
    diagnosticRefs.push(ref);
    entries.push({ fullUrl: ref, resource: report });
  }

  // 6. Referral ServiceRequest
  const referral = _mapReferral(triageCase, patientRef);
  let referralRef: string | null = null;
  if (referral) {
    referralRef = _makeFullUrl(referral.id!);
    entries.push({ fullUrl: referralRef, resource: referral });
  }

  // 7. Composition (OPConsultation — must be first entry in a Document Bundle)
  const composition = _buildComposition(
    patientRef,
    encounterRef,
    vitalRefs,
    triageRef,
    diagnosticRefs,
    referralRef,
    triageCase
  );
  const compositionRef = _makeFullUrl(composition.id!);

  // Document Bundle spec requires Composition as the first entry.
  entries.unshift({ fullUrl: compositionRef, resource: composition });

  // 8. Assemble the Bundle
  const bundle: FHIR.DocumentBundle = {
    resourceType: 'Bundle',
    id: `bundle-${triageCase.id}`,
    type: 'document',
    timestamp: triageCase.encounter.serverReceivedTime ?? triageCase.encounter.deviceClaimedTime,
    identifier: {
      system: 'urn:caresanchaar:bundle',
      value: triageCase.id,
    },
    entry: entries,
  };

  return bundle;
}
