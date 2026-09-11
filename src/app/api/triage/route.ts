import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { env } from '@/lib/env';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { buildRetrievalQuery, retrieveClinicalContext } from '@/lib/rag/retrieve';
import { assessVitals, maxRisk, type RiskLevel } from '@/lib/triage/vitals';
import { triageRequestSchema } from '@/lib/triage/schema';
import { buildUserPrompt, TRIAGE_DISCLAIMER } from '@/lib/triage/prompt';
import { generateTriageAssessment } from '@/lib/triage/generate';

const deterministicFloorLabel = (level: RiskLevel): string => level.toLowerCase();

/** Node runtime: the Supabase service client and crypto usage require it. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Below this top-similarity score the corpus has nothing relevant to say. */
const GROUNDING_SIMILARITY_FLOOR = 0.42;

export async function POST(request: Request): Promise<NextResponse> {
  const startedAt = Date.now();
  const supabase = getSupabaseAdmin();

  try {
    // ---- 1. Validate ------------------------------------------------------
    const input = triageRequestSchema.parse(await request.json());

    // ---- 2. Idempotency: an offline client may replay a queued submission --
    const { data: existing } = await supabase
      .from('triage_assessments')
      .select('*')
      .eq('client_request_id', input.clientRequestId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          assessmentId: existing.id,
          riskLevel: existing.final_risk_level,
          provisionalClinicalCue: existing.provisional_cue,
          ...(existing.ai_raw_response as Record<string, unknown>),
          deterministicFloor: existing.deterministic_floor,
          disclaimer: TRIAGE_DISCLAIMER,
          replayed: true,
        },
        { status: 200 },
      );
    }

    // ---- 3. Deterministic vitals engine (runs BEFORE the model) ------------
    const vitals = assessVitals(input.vitals, input.ageYears);

    // ---- 4. Retrieve grounding context ------------------------------------
    const query = buildRetrievalQuery({
      symptoms: input.symptoms,
      freeText: input.notes,
      ageYears: input.ageYears,
      sex: input.sex,
      vitalSummary: vitals.summary,
    });
    const chunks = await retrieveClinicalContext(query, {
      matchThreshold: 0.3,
      matchCount: 12,
    });
    const topScore = chunks[0]?.similarity ?? 0;
    const wellGrounded = topScore >= GROUNDING_SIMILARITY_FLOOR;

    // ---- 5. Generate, or degrade safely ------------------------------------
    // If retrieval found nothing usable we do NOT let the model improvise from
    // parametric memory: we return the deterministic assessment and route to a
    // human. Same on model failure — the vitals engine still stands.
    let ai: Awaited<ReturnType<typeof generateTriageAssessment>> | null = null;
    let degradedReason: string | null = wellGrounded
      ? null
      : 'No sufficiently similar clinical knowledge was retrieved for this presentation.';

    if (wellGrounded) {
      try {
        ai = await generateTriageAssessment(
          buildUserPrompt({ request: input, vitals, chunks }),
        );
      } catch (error) {
        degradedReason = `Generation unavailable: ${(error as Error).message}`;
      }
    }

    // ---- 6. Enforce the deterministic floor -------------------------------
    // The model may escalate. It may never de-escalate a measured red flag.
    const aiRisk = (ai?.riskLevel ?? 'Low') as RiskLevel;
    const finalRisk = maxRisk(aiRisk, vitals.deterministicFloor);

    const recommendedAction = vitals.mandatoryEscalation
      ? 'IMMEDIATE_REFERRAL'
      : ai?.recommendedAction ??
        (finalRisk === 'High' ? 'PRIORITY_MO_REVIEW_SAME_DAY' : 'ROUTINE_MO_REVIEW');

    const provisionalCue =
      ai?.provisionalClinicalCue ??
      `Automated screening could not produce a grounded cue for this presentation. ` +
        `Deterministic vital-sign screening indicates ${deterministicFloorLabel(vitals.deterministicFloor)} risk ` +
        `(${vitals.summary}). Medical Officer assessment required.`;

    const responseBody = {
      riskLevel: finalRisk,
      provisionalClinicalCue: provisionalCue,
      considerations: ai?.considerations ?? [],
      redFlags: [
        ...vitals.flags.map((f) => `${f.parameter} ${f.value}: ${f.finding}`),
        ...(ai?.redFlags ?? []),
      ],
      recommendedAction,
      requiresMedicalOfficerReview: true,
      deterministic: {
        floor: vitals.deterministicFloor,
        mandatoryEscalation: vitals.mandatoryEscalation,
        temperatureC: vitals.temperatureC,
      },
      grounding: {
        sufficient: Boolean(ai?.groundingSufficient) && wellGrounded,
        topSimilarity: Number(topScore.toFixed(4)),
        citations: chunks.map((chunk, index) => ({
          ref: `CTX-${index + 1}`,
          id: chunk.id,
          source: chunk.dataset_source,
          type: chunk.record_type,
          similarity: Number(chunk.similarity.toFixed(4)),
        })),
      },
      degradedReason,
      disclaimer: TRIAGE_DISCLAIMER,
    };

    // ---- 7. Audit ---------------------------------------------------------
    const { data: saved, error: auditError } = await supabase
      .from('triage_assessments')
      .insert({
        client_request_id: input.clientRequestId,
        patient_input: input,
        retrieved_chunk_ids: chunks.map((c) => c.id),
        retrieval_top_score: topScore,
        ai_risk_level: ai?.riskLevel ?? null,
        deterministic_floor: vitals.deterministicFloor,
        final_risk_level: finalRisk,
        provisional_cue: provisionalCue,
        ai_raw_response: responseBody,
        embedding_model: env.GEMINI_EMBEDDING_MODEL,
        generation_model: env.GEMINI_GENERATION_MODEL,
        latency_ms: Date.now() - startedAt,
      })
      .select('id')
      .single();

    // An audit-write failure must not silently swallow a Critical result.
    if (auditError) console.error('[triage] audit insert failed:', auditError.message);

    return NextResponse.json(
      { assessmentId: saved?.id ?? null, ...responseBody },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid triage payload', issues: error.flatten() },
        { status: 422 },
      );
    }
    console.error('[triage] unhandled error:', error);
    return NextResponse.json(
      {
        error: 'Triage service unavailable. Record the encounter and escalate manually.',
        requiresMedicalOfficerReview: true,
      },
      { status: 503 },
    );
  }
}
