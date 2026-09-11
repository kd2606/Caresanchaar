/**
 * @module triage-engine/protocol-definitions
 * @description
 * Standard protocol checklist definitions for ASHA worker intake.
 * These map directly to ProtocolChecklistItem codes.
 *
 * Based on: IMNCI, WHO Emergency Triage, NCD Screening protocols.
 * Each item has a code, label, and protocol grouping.
 */

import type { ProtocolChecklistItem, ActorId } from './types';

// ─── Protocol Group Definitions ──────────────

export interface ProtocolGroup {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly icon: string; // Lucide icon name
  readonly items: ReadonlyArray<ProtocolItemTemplate>;
}

export interface ProtocolItemTemplate {
  readonly code: string;
  readonly label: string;
  readonly labelHi?: string; // Hindi translation
  readonly severity: 'red' | 'orange' | 'yellow';
}

/**
 * Creates a ProtocolChecklistItem from a template.
 */
export function createChecklistItem(
  template: ProtocolItemTemplate,
  protocolId: string,
  capturedBy: ActorId
): ProtocolChecklistItem {
  return {
    code: template.code,
    label: template.label,
    protocolId,
    present: false,
    capturedBy,
    capturedAt: new Date().toISOString(),
  };
}

// ─── Standard Protocols ──────────────────────

export const PROTOCOL_GROUPS: ReadonlyArray<ProtocolGroup> = [
  {
    id: 'EMERGENCY',
    name: 'Emergency Danger Signs',
    description: 'Immediate life-threatening conditions requiring emergency referral',
    icon: 'AlertTriangle',
    items: [
      { code: 'DV-DANGER-UNCONSCIOUS',         label: 'Unconscious / Unresponsive',       labelHi: 'बेहोश / अनुत्तरदायी',        severity: 'red' },
      { code: 'DV-DANGER-CONVULSING',           label: 'Currently Convulsing',             labelHi: 'वर्तमान में ऐंठन',            severity: 'red' },
      { code: 'DV-DANGER-SEVERE-BLEEDING',      label: 'Severe / Uncontrollable Bleeding', labelHi: 'गंभीर / अनियंत्रित रक्तस्राव', severity: 'red' },
      { code: 'DV-DANGER-CHEST-PAIN',           label: 'Acute Chest Pain',                 labelHi: 'तीव्र सीने में दर्द',          severity: 'red' },
      { code: 'DV-DANGER-SUDDEN-WEAKNESS',      label: 'Sudden Weakness / Paralysis',      labelHi: 'अचानक कमज़ोरी / लकवा',        severity: 'red' },
      { code: 'DV-DANGER-SEVERE-BREATHING',     label: 'Severe Difficulty Breathing',      labelHi: 'सांस लेने में गंभीर कठिनाई',    severity: 'red' },
    ],
  },
  {
    id: 'IMNCI',
    name: 'IMNCI Danger Signs (Child)',
    description: 'Integrated Management of Neonatal and Childhood Illness',
    icon: 'Baby',
    items: [
      { code: 'DV-DANGER-NOT-DRINKING',           label: 'Unable to Drink / Breastfeed',      labelHi: 'पीने / स्तनपान में असमर्थ',       severity: 'orange' },
      { code: 'DV-DANGER-PERSISTENT-VOMITING',     label: 'Persistent Vomiting',               labelHi: 'लगातार उल्टी',                   severity: 'orange' },
      { code: 'DV-DANGER-LETHARGY',                label: 'Abnormally Sleepy / Lethargic',     labelHi: 'असामान्य रूप से सुस्त',           severity: 'orange' },
      { code: 'DV-DANGER-BULGING-FONTANELLE',      label: 'Bulging Fontanelle (Infant)',        labelHi: 'उभरा हुआ तालु (शिशु)',            severity: 'orange' },
      { code: 'DV-DANGER-DIARRHEA-DEHYDRATION',   label: 'Diarrhea with Dehydration Signs',   labelHi: 'निर्जलीकरण के साथ दस्त',           severity: 'yellow' },
      { code: 'DV-DANGER-FEVER-5DAYS',             label: 'Fever for ≥ 5 Days',                labelHi: '≥ 5 दिनों से बुखार',               severity: 'yellow' },
    ],
  },
  {
    id: 'MATERNAL',
    name: 'Maternal Danger Signs',
    description: 'Antenatal / postnatal danger signs for pregnant and postpartum women',
    icon: 'HeartPulse',
    items: [
      { code: 'DV-DANGER-VAGINAL-BLEEDING',     label: 'Heavy Vaginal Bleeding',          labelHi: 'भारी योनि रक्तस्राव',          severity: 'red' },
      { code: 'DV-DANGER-SEVERE-HEADACHE',      label: 'Severe Headache with Blurred Vision', labelHi: 'धुंधली दृष्टि के साथ तीव्र सिरदर्द', severity: 'red' },
      { code: 'DV-DANGER-SWELLING-FACE',        label: 'Swelling of Face / Hands',        labelHi: 'चेहरे / हाथों में सूजन',         severity: 'orange' },
      { code: 'DV-DANGER-REDUCED-FETAL-MOVE',   label: 'Reduced Fetal Movements',         labelHi: 'भ्रूण की गतिविधि में कमी',       severity: 'orange' },
      { code: 'DV-DANGER-FEVER-PREGNANCY',      label: 'High Fever During Pregnancy',     labelHi: 'गर्भावस्था में तेज़ बुखार',       severity: 'yellow' },
      { code: 'DV-DANGER-PAINFUL-URINATION',    label: 'Painful / Burning Urination',     labelHi: 'पेशाब में दर्द / जलन',           severity: 'yellow' },
    ],
  },
  {
    id: 'NCD',
    name: 'NCD Screening Signs',
    description: 'Non-communicable disease risk indicators',
    icon: 'Activity',
    items: [
      { code: 'DV-NCD-KNOWN-DIABETIC',          label: 'Known Diabetic (on medication)',   labelHi: 'ज्ञात मधुमेह (दवा पर)',          severity: 'yellow' },
      { code: 'DV-NCD-KNOWN-HYPERTENSIVE',      label: 'Known Hypertensive (on medication)', labelHi: 'ज्ञात उच्च रक्तचाप (दवा पर)',  severity: 'yellow' },
      { code: 'DV-NCD-RECURRENT-COUGH',         label: 'Persistent Cough > 2 Weeks',      labelHi: '> 2 सप्ताह से लगातार खांसी',     severity: 'yellow' },
      { code: 'DV-NCD-WEIGHT-LOSS',             label: 'Unexplained Weight Loss',         labelHi: 'अस्पष्ट वजन घटना',              severity: 'yellow' },
      { code: 'DV-NCD-LUMP',                    label: 'New Lump / Swelling',             labelHi: 'नई गांठ / सूजन',                 severity: 'yellow' },
    ],
  },
] as const;
