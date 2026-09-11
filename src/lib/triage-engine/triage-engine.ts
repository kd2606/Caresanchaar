/**
 * @module triage-engine/triage-engine
 * @description
 * Safety-critical triage engine implementing the 3-step process:
 *   Step A: Deterministic rules engine (vitals + checklist → baseline tier)
 *   Step B: AI inference (external — this module receives the result)
 *   Step C: "AI May Only Escalate" enforcement
 *
 * INVARIANT: The final tier is ALWAYS >= the deterministic baseline.
 * AI can push GREEN→YELLOW or YELLOW→RED, but NEVER RED→GREEN.
 *
 * All functions are pure — no side effects, no network, no state.
 */

import {
  TriageTier,
  TRIAGE_TIER_ORDINAL,
  type StructuredVitals,
  type ProtocolChecklistItem,
  type TriageResult,
} from './types';

// ─────────────────────────────────────────────
// §1  Deterministic Triage Rules
// ─────────────────────────────────────────────

/**
 * A single deterministic triage rule.
 * If the predicate returns true, the rule "fires" and produces its `tier`.
 */
export interface TriageRule {
  /** Unique rule identifier (e.g., 'RULE-SPO2-CRITICAL'). */
  readonly id: string;
  /** Human-readable description. */
  readonly description: string;
  /** The tier this rule assigns when it fires. */
  readonly tier: TriageTier;
  /** Predicate — evaluated against current vitals and checklist. */
  readonly predicate: (
    vitals: StructuredVitals,
    checklist: ReadonlyArray<ProtocolChecklistItem>
  ) => boolean;
}

/**
 * Check if a specific danger sign code is present in the checklist.
 */
function hasDangerSign(
  checklist: ReadonlyArray<ProtocolChecklistItem>,
  code: string
): boolean {
  return checklist.some((item) => item.code === code && item.present);
}

/**
 * Standard deterministic triage rules.
 * Based on IMNCI, WHO emergency triage, and NCD screening protocols.
 * Rules are evaluated in order — ALL matching rules fire, and the
 * highest tier among them becomes the baseline.
 *
 * These are intentionally conservative (err on the side of escalation).
 */
export const STANDARD_TRIAGE_RULES: ReadonlyArray<TriageRule> = [
  // ── RED (Emergency) ──────────────────────────

  {
    id: 'RULE-SPO2-CRITICAL',
    description: 'SpO2 below 90% indicates severe hypoxia',
    tier: TriageTier.RED,
    predicate: (vitals) =>
      vitals.spO2 !== undefined && vitals.spO2.value < 90,
  },
  {
    id: 'RULE-RR-SEVERE',
    description: 'Respiratory rate > 40 in adult indicates respiratory distress',
    tier: TriageTier.RED,
    predicate: (vitals) =>
      vitals.respiratoryRate !== undefined && vitals.respiratoryRate.value > 40,
  },
  {
    id: 'RULE-HR-CRITICAL-HIGH',
    description: 'Heart rate > 150 bpm indicates critical tachycardia',
    tier: TriageTier.RED,
    predicate: (vitals) =>
      vitals.heartRate !== undefined && vitals.heartRate.value > 150,
  },
  {
    id: 'RULE-HR-CRITICAL-LOW',
    description: 'Heart rate < 40 bpm indicates critical bradycardia',
    tier: TriageTier.RED,
    predicate: (vitals) =>
      vitals.heartRate !== undefined && vitals.heartRate.value < 40,
  },
  {
    id: 'RULE-TEMP-HYPERTHERMIA',
    description: 'Temperature >= 40.5°C indicates dangerous hyperthermia',
    tier: TriageTier.RED,
    predicate: (vitals) =>
      vitals.temperature !== undefined && vitals.temperature.value >= 40.5,
  },
  {
    id: 'RULE-BP-HYPERTENSIVE-CRISIS',
    description: 'Systolic BP >= 180 mmHg indicates hypertensive crisis',
    tier: TriageTier.RED,
    predicate: (vitals) =>
      vitals.systolicBP !== undefined && vitals.systolicBP.value >= 180,
  },
  {
    id: 'RULE-BP-HYPOTENSION-SEVERE',
    description: 'Systolic BP < 70 mmHg indicates severe hypotension/shock',
    tier: TriageTier.RED,
    predicate: (vitals) =>
      vitals.systolicBP !== undefined && vitals.systolicBP.value < 70,
  },
  {
    id: 'RULE-DANGER-UNCONSCIOUS',
    description: 'Patient is unconscious or unresponsive',
    tier: TriageTier.RED,
    predicate: (_vitals, checklist) =>
      hasDangerSign(checklist, 'DV-DANGER-UNCONSCIOUS'),
  },
  {
    id: 'RULE-DANGER-CONVULSING',
    description: 'Patient is currently convulsing',
    tier: TriageTier.RED,
    predicate: (_vitals, checklist) =>
      hasDangerSign(checklist, 'DV-DANGER-CONVULSING'),
  },
  {
    id: 'RULE-DANGER-SEVERE-BLEEDING',
    description: 'Severe or uncontrollable bleeding',
    tier: TriageTier.RED,
    predicate: (_vitals, checklist) =>
      hasDangerSign(checklist, 'DV-DANGER-SEVERE-BLEEDING'),
  },
  {
    id: 'RULE-DANGER-CHEST-PAIN',
    description: 'Acute chest pain — possible cardiac event',
    tier: TriageTier.RED,
    predicate: (_vitals, checklist) =>
      hasDangerSign(checklist, 'DV-DANGER-CHEST-PAIN'),
  },
  {
    id: 'RULE-DANGER-SUDDEN-WEAKNESS',
    description: 'Sudden onset weakness/paralysis — possible stroke',
    tier: TriageTier.RED,
    predicate: (_vitals, checklist) =>
      hasDangerSign(checklist, 'DV-DANGER-SUDDEN-WEAKNESS'),
  },

  // ── ORANGE (Urgent) ──────────────────────────

  {
    id: 'RULE-SPO2-LOW',
    description: 'SpO2 90-93% indicates significant hypoxia',
    tier: TriageTier.ORANGE,
    predicate: (vitals) =>
      vitals.spO2 !== undefined &&
      vitals.spO2.value >= 90 &&
      vitals.spO2.value <= 93,
  },
  {
    id: 'RULE-TEMP-HIGH-FEVER',
    description: 'Temperature 39.5-40.4°C indicates high fever',
    tier: TriageTier.ORANGE,
    predicate: (vitals) =>
      vitals.temperature !== undefined &&
      vitals.temperature.value >= 39.5 &&
      vitals.temperature.value < 40.5,
  },
  {
    id: 'RULE-BP-HYPERTENSION-SEVERE',
    description: 'Systolic BP 160-179 mmHg indicates severe hypertension',
    tier: TriageTier.ORANGE,
    predicate: (vitals) =>
      vitals.systolicBP !== undefined &&
      vitals.systolicBP.value >= 160 &&
      vitals.systolicBP.value < 180,
  },
  {
    id: 'RULE-HR-TACHYCARDIA',
    description: 'Heart rate 120-150 bpm indicates significant tachycardia',
    tier: TriageTier.ORANGE,
    predicate: (vitals) =>
      vitals.heartRate !== undefined &&
      vitals.heartRate.value >= 120 &&
      vitals.heartRate.value <= 150,
  },
  {
    id: 'RULE-GLUCOSE-HYPO-SEVERE',
    description: 'Blood glucose < 54 mg/dL indicates severe hypoglycemia',
    tier: TriageTier.ORANGE,
    predicate: (vitals) =>
      vitals.bloodGlucose !== undefined && vitals.bloodGlucose.value < 54,
  },
  {
    id: 'RULE-GLUCOSE-HYPER-SEVERE',
    description: 'Blood glucose > 400 mg/dL indicates severe hyperglycemia',
    tier: TriageTier.ORANGE,
    predicate: (vitals) =>
      vitals.bloodGlucose !== undefined && vitals.bloodGlucose.value > 400,
  },
  {
    id: 'RULE-DANGER-NOT-DRINKING',
    description: 'Child unable to drink or breastfeed (IMNCI danger sign)',
    tier: TriageTier.ORANGE,
    predicate: (_vitals, checklist) =>
      hasDangerSign(checklist, 'DV-DANGER-NOT-DRINKING'),
  },
  {
    id: 'RULE-DANGER-PERSISTENT-VOMITING',
    description: 'Persistent vomiting — unable to retain fluids',
    tier: TriageTier.ORANGE,
    predicate: (_vitals, checklist) =>
      hasDangerSign(checklist, 'DV-DANGER-PERSISTENT-VOMITING'),
  },

  // ── YELLOW (Semi-Urgent) ─────────────────────

  {
    id: 'RULE-TEMP-MODERATE-FEVER',
    description: 'Temperature 38.5-39.4°C indicates moderate fever',
    tier: TriageTier.YELLOW,
    predicate: (vitals) =>
      vitals.temperature !== undefined &&
      vitals.temperature.value >= 38.5 &&
      vitals.temperature.value < 39.5,
  },
  {
    id: 'RULE-SPO2-BORDERLINE',
    description: 'SpO2 94-95% is borderline low',
    tier: TriageTier.YELLOW,
    predicate: (vitals) =>
      vitals.spO2 !== undefined &&
      vitals.spO2.value >= 94 &&
      vitals.spO2.value <= 95,
  },
  {
    id: 'RULE-BP-HYPERTENSION-MOD',
    description: 'Systolic BP 140-159 mmHg indicates moderate hypertension',
    tier: TriageTier.YELLOW,
    predicate: (vitals) =>
      vitals.systolicBP !== undefined &&
      vitals.systolicBP.value >= 140 &&
      vitals.systolicBP.value < 160,
  },
  {
    id: 'RULE-GLUCOSE-HYPO-MODERATE',
    description: 'Blood glucose 54-69 mg/dL indicates moderate hypoglycemia',
    tier: TriageTier.YELLOW,
    predicate: (vitals) =>
      vitals.bloodGlucose !== undefined &&
      vitals.bloodGlucose.value >= 54 &&
      vitals.bloodGlucose.value <= 69,
  },
  {
    id: 'RULE-MUAC-MALNUTRITION',
    description: 'MUAC < 12.5 cm indicates acute malnutrition (child)',
    tier: TriageTier.YELLOW,
    predicate: (vitals) =>
      vitals.muac !== undefined && vitals.muac.value < 12.5,
  },
  {
    id: 'RULE-DANGER-DIARRHEA-DEHYDRATION',
    description: 'Diarrhea with signs of dehydration',
    tier: TriageTier.YELLOW,
    predicate: (_vitals, checklist) =>
      hasDangerSign(checklist, 'DV-DANGER-DIARRHEA-DEHYDRATION'),
  },

  // ── GREEN (Non-Urgent) ───────────────────────
  // GREEN is the default when no rules fire. No explicit GREEN rules needed.
];

// ─────────────────────────────────────────────
// §2  Deterministic Rules Engine (Step A)
// ─────────────────────────────────────────────

/**
 * Result of the deterministic rules engine pass.
 */
export interface DeterministicRulesResult {
  /** The highest tier among all fired rules (GREEN if none fired). */
  readonly tier: TriageTier;
  /** IDs of all rules that fired. */
  readonly firedRuleIds: ReadonlyArray<string>;
}

/**
 * Step A: Runs all deterministic triage rules against the provided
 * vitals and checklist. Returns the highest tier among all fired rules.
 *
 * If no rules fire, the baseline is GREEN.
 *
 * @param vitals - Structured numeric vitals.
 * @param checklist - Protocol-driven danger sign checklist.
 * @param rules - Rule set to evaluate (defaults to STANDARD_TRIAGE_RULES).
 * @returns The deterministic baseline tier and list of fired rule IDs.
 */
export function runDeterministicRules(
  vitals: StructuredVitals,
  checklist: ReadonlyArray<ProtocolChecklistItem>,
  rules: ReadonlyArray<TriageRule> = STANDARD_TRIAGE_RULES
): DeterministicRulesResult {
  let highestTier = TriageTier.GREEN;
  const firedRuleIds: string[] = [];

  for (const rule of rules) {
    try {
      if (rule.predicate(vitals, checklist)) {
        firedRuleIds.push(rule.id);
        if (TRIAGE_TIER_ORDINAL[rule.tier] > TRIAGE_TIER_ORDINAL[highestTier]) {
          highestTier = rule.tier;
        }
      }
    } catch {
      // A rule predicate should never throw, but if it does,
      // we log and skip — never crash the triage engine.
      console.error(`[TriageEngine] Rule "${rule.id}" threw during evaluation. Skipping.`);
    }
  }

  return { tier: highestTier, firedRuleIds };
}

// ─────────────────────────────────────────────
// §3  AI Escalation Enforcement (Step C)
// ─────────────────────────────────────────────

/**
 * Step C: Applies the "AI May Only Escalate" invariant.
 *
 * Given a deterministic baseline tier and an AI-proposed tier,
 * returns `max(baseline, aiTier)`. AI can NEVER de-escalate.
 *
 * @param baselineTier - The tier from the deterministic rules engine (Step A).
 * @param aiProposedTier - The tier proposed by AI inference (Step B). Null if AI was skipped.
 * @returns The final triage tier — guaranteed >= baselineTier.
 */
export function applyAIEscalation(
  baselineTier: TriageTier,
  aiProposedTier: TriageTier | null
): TriageTier {
  if (aiProposedTier === null) {
    return baselineTier;
  }

  const baselineOrdinal = TRIAGE_TIER_ORDINAL[baselineTier];
  const aiOrdinal = TRIAGE_TIER_ORDINAL[aiProposedTier];

  // INVARIANT: Final tier is always >= baseline. AI may only escalate.
  return aiOrdinal > baselineOrdinal ? aiProposedTier : baselineTier;
}

// ─────────────────────────────────────────────
// §4  Full Triage Pipeline
// ─────────────────────────────────────────────

/**
 * Executes the full triage pipeline: Step A → (Step B external) → Step C.
 *
 * @param vitals - Structured vitals from intake.
 * @param checklist - Protocol-driven danger sign checklist.
 * @param aiProposedTier - AI-proposed tier from Step B (null if AI was skipped).
 * @param rules - Rule set (defaults to standard rules).
 * @returns Complete TriageResult with deterministic, AI, and final tiers.
 */
export function computeTriageResult(
  vitals: StructuredVitals,
  checklist: ReadonlyArray<ProtocolChecklistItem>,
  aiProposedTier: TriageTier | null,
  rules: ReadonlyArray<TriageRule> = STANDARD_TRIAGE_RULES
): TriageResult {
  // Step A: Deterministic rules.
  const { tier: deterministicTier, firedRuleIds } = runDeterministicRules(
    vitals,
    checklist,
    rules
  );

  // Step C: Enforce "AI may only escalate".
  const finalTier = applyAIEscalation(deterministicTier, aiProposedTier);

  return {
    deterministicTier,
    aiProposedTier,
    finalTier,
    firedRuleIds,
    computedAt: new Date().toISOString(),
  };
}
