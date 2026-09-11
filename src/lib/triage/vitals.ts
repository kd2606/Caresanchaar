/**
 * Deterministic vital-sign safety net.
 *
 * ---------------------------------------------------------------------------
 * CLINICAL GOVERNANCE NOTICE
 *
 * The thresholds below are ADULT defaults in the spirit of common early-warning
 * scores (e.g. NEWS2-style single-parameter triggers). They are NOT validated
 * for this deployment, and they are WRONG for children, neonates, and pregnancy,
 * where normal ranges differ substantially. They must be reviewed, adjusted and
 * signed off by your clinical governance lead before any field use, and they
 * should live in configuration you can revise without a code deploy.
 * ---------------------------------------------------------------------------
 *
 * Why this exists: an LLM must never be the only thing standing between a
 * hypoxic patient and escalation. This module computes a floor that the model
 * can raise but can never lower.
 */

export const RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

const SEVERITY: Record<RiskLevel, number> = { Low: 0, Medium: 1, High: 2, Critical: 3 };

export function maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  return SEVERITY[a] >= SEVERITY[b] ? a : b;
}

export interface Vitals {
  /** Body temperature in FAHRENHEIT, as captured in the field. */
  temperatureF?: number;
  systolicBp?: number;
  diastolicBp?: number;
  /** SpO2, percent. */
  oxygenSaturation?: number;
  heartRate?: number;
  respiratoryRate?: number;
  /** Random capillary blood glucose, mg/dL. */
  bloodGlucose?: number;
}

export interface VitalFlag {
  parameter: string;
  value: number;
  finding: string;
  severity: RiskLevel;
}

export interface VitalsAssessment {
  flags: VitalFlag[];
  /** Risk level the AI output cannot go below. */
  deterministicFloor: RiskLevel;
  /** True when immediate escalation is mandated regardless of AI output. */
  mandatoryEscalation: boolean;
  /** Compact string for prompt injection + retrieval query. */
  summary: string;
  temperatureC?: number;
}

export const fahrenheitToCelsius = (f: number): number =>
  Math.round(((f - 32) * 5) / 9 * 10) / 10;

/** Plausibility gates — reject transcription errors rather than triage them. */
export const VITAL_RANGES = {
  temperatureF: [86, 113],
  systolicBp: [50, 260],
  diastolicBp: [20, 180],
  oxygenSaturation: [50, 100],
  heartRate: [25, 220],
  respiratoryRate: [4, 70],
  bloodGlucose: [20, 800],
} as const satisfies Record<keyof Vitals, readonly [number, number]>;

export function assessVitals(vitals: Vitals, ageYears?: number): VitalsAssessment {
  const flags: VitalFlag[] = [];
  const push = (parameter: string, value: number, finding: string, severity: RiskLevel) =>
    flags.push({ parameter, value, finding, severity });

  const { temperatureF: tF, systolicBp: sbp, oxygenSaturation: spo2 } = vitals;
  const { heartRate: hr, respiratoryRate: rr, bloodGlucose: glucose } = vitals;

  if (spo2 != null) {
    if (spo2 < 90) push('SpO2', spo2, 'Severe hypoxaemia', 'Critical');
    else if (spo2 < 94) push('SpO2', spo2, 'Hypoxaemia', 'High');
    else if (spo2 < 96) push('SpO2', spo2, 'Borderline oxygenation', 'Medium');
  }

  if (sbp != null) {
    if (sbp < 90) push('Systolic BP', sbp, 'Hypotension — possible shock', 'Critical');
    else if (sbp < 100) push('Systolic BP', sbp, 'Low systolic pressure', 'High');
    else if (sbp >= 180) push('Systolic BP', sbp, 'Severe hypertension', 'High');
    else if (sbp >= 140) push('Systolic BP', sbp, 'Elevated systolic pressure', 'Medium');
  }

  if (vitals.diastolicBp != null && vitals.diastolicBp >= 120) {
    push('Diastolic BP', vitals.diastolicBp, 'Severe diastolic hypertension', 'High');
  }

  if (tF != null) {
    if (tF >= 104) push('Temperature', tF, 'Hyperpyrexia', 'Critical');
    else if (tF < 95) push('Temperature', tF, 'Hypothermia', 'Critical');
    else if (tF >= 100.4) push('Temperature', tF, 'Fever', 'Medium');
  }

  if (rr != null) {
    if (rr >= 30 || rr < 9) push('Respiratory rate', rr, 'Severe respiratory derangement', 'Critical');
    else if (rr >= 25) push('Respiratory rate', rr, 'Tachypnoea', 'High');
    else if (rr >= 21) push('Respiratory rate', rr, 'Mild tachypnoea', 'Medium');
  }

  if (hr != null) {
    if (hr >= 131 || hr < 41) push('Heart rate', hr, 'Severe rate abnormality', 'High');
    else if (hr >= 111 || hr < 51) push('Heart rate', hr, 'Rate abnormality', 'Medium');
  }

  if (glucose != null) {
    if (glucose < 54) push('Blood glucose', glucose, 'Severe hypoglycaemia', 'Critical');
    else if (glucose < 70) push('Blood glucose', glucose, 'Hypoglycaemia', 'High');
    else if (glucose >= 300) push('Blood glucose', glucose, 'Marked hyperglycaemia', 'High');
    else if (glucose >= 200) push('Blood glucose', glucose, 'Hyperglycaemia', 'Medium');
  }

  // Composite trigger: fever + tachypnoea + tachycardia is a sepsis-screen
  // pattern that no single parameter above would catch.
  if (tF != null && tF >= 100.4 && rr != null && rr >= 22 && hr != null && hr >= 100) {
    push('Composite', tF, 'Fever with tachypnoea and tachycardia — screen for sepsis', 'High');
  }

  // Age-extreme amplification: physiological reserve is lower at both extremes.
  const ageAmplified =
    ageYears != null && (ageYears < 5 || ageYears >= 65) && flags.length > 0;
  if (ageAmplified) {
    push('Age', ageYears!, 'Age extreme reduces physiological reserve', 'Medium');
  }

  const deterministicFloor = flags.reduce<RiskLevel>(
    (acc, flag) => maxRisk(acc, flag.severity),
    'Low',
  );

  const summary =
    [
      tF != null ? `Temp ${tF}°F (${fahrenheitToCelsius(tF)}°C)` : null,
      sbp != null ? `BP ${sbp}/${vitals.diastolicBp ?? '?'} mmHg` : null,
      spo2 != null ? `SpO2 ${spo2}%` : null,
      hr != null ? `HR ${hr}/min` : null,
      rr != null ? `RR ${rr}/min` : null,
      glucose != null ? `Glucose ${glucose} mg/dL` : null,
    ]
      .filter(Boolean)
      .join('; ') || 'no vitals recorded';

  return {
    flags,
    deterministicFloor,
    mandatoryEscalation: deterministicFloor === 'Critical',
    summary,
    temperatureC: tF != null ? fahrenheitToCelsius(tF) : undefined,
  };
}
