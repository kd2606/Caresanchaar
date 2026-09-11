import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { analyzeCardioCheck } from '@/ai/flows/cardio-check';
import { callWithResilience, isCapacityExhausted } from '@/ai/resilience';
import { logger } from '@/lib/logger';
import { logAudit } from '@/lib/auditLogger';

const CardioCheckRequestSchema = z.object({
  age: z.union([z.number(), z.string()]).transform(val => Number(val)).pipe(z.number().min(0).max(120, 'Invalid age')),
  gender: z.string().max(50),
  bmi: z.union([z.number(), z.string()]).transform(val => Number(val)).pipe(z.number().min(10).max(100)).optional(),
  restingHR: z.union([z.number(), z.string()]).transform(val => Number(val)).pipe(z.number().min(30).max(300)).optional(),
  chestPainType: z.string().max(100),
  exerciseAngina: z.string().max(100),
  bloodSugar: z.string().max(100),
  smokerTarget: z.string().max(100),
});

export interface ApiErrorResponse {
  success: false;
  errorCode:
    | 'INVALID_PAYLOAD'
    | 'AI_FLOW_FAILED'
    | 'AI_OUTPUT_INVALID'
    | 'AI_CAPACITY_EXHAUSTED'
    | 'INTERNAL_ERROR';
  message: string;
  retryable: boolean;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const startedAt = Date.now();

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json<ApiErrorResponse>(
        { success: false, errorCode: 'INVALID_PAYLOAD', message: 'Request body is not valid JSON.', retryable: false },
        { status: 400 }
      );
    }

    const parsed = CardioCheckRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json<ApiErrorResponse>(
        {
          success: false,
          errorCode: 'INVALID_PAYLOAD',
          message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          retryable: false,
        },
        { status: 400 }
      );
    }

    const inputData = parsed.data;

    // Hardcoded Red Flag Override 
    // Do not rely solely on LLM to classify critical textbook emergencies
    if (inputData.chestPainType === "Typical Angina") {
        logger.info("Cardio Check: Red Flag Override Triggered - Typical Angina");
        return NextResponse.json({
            triagePriority: "High Priority",
            wellnessScore: 10,
            overallAssessment: "Your reported symptoms match critical emergency criteria. Stop all activities. This system cannot diagnose, but your symptoms indicate a severe potential risk that requires immediate emergency clinical evaluation.",
            precautions: [
                "Stop what you are doing and sit or lie down immediately.",
                "If you are alone, call out for help or contact emergency services immediately.",
                "Do not drive yourself to the hospital."
            ],
            recommendations: [
                "Contact emergency medical services (e.g., 108/911).",
                "Unlock your door to allow emergency responders to enter."
            ],
            seekEmergency: true,
            disclaimer: "This is an AI wellness triage tool. However, your symptoms require IMMEDIATE EMERGENCY RESPONDER evaluation. Do not delay."
        });
    }

    let flowOutput;
    try {
      flowOutput = await callWithResilience(
        () => analyzeCardioCheck(inputData),
        { maxAttempts: 3, label: 'cardio-check-flow', maxDelayMs: 2_000 }
      );
    } catch (err) {
      if (isCapacityExhausted(err)) {
        logger.warn('cardio-check: capacity exhausted', { err: (err as Error).message });
        return NextResponse.json(
          {
            error: 'AI_CAPACITY_EXHAUSTED',
            retryable: true,
            retryAfterSeconds: 30,
            userMessage: 'High demand right now. For urgent symptoms please contact emergency services.',
          },
          { status: 503, headers: { 'Retry-After': '30' } }
        );
      }

      logger.error('cardio-check: genkit flow threw', { err: (err as Error).message });
      return NextResponse.json<ApiErrorResponse>(
        {
          success: false,
          errorCode: 'AI_FLOW_FAILED',
          message: 'The AI analysis service is temporarily unavailable. Please retry shortly.',
          retryable: true,
        },
        { status: 502 }
      );
    }

    if (!flowOutput || !flowOutput.triagePriority) {
      logger.error('cardio-check: malformed flow output', { flowOutput });
      return NextResponse.json<ApiErrorResponse>(
        {
          success: false,
          errorCode: 'AI_OUTPUT_INVALID',
          message: 'AI returned an unexpected response shape. Incident logged.',
          retryable: true,
        },
        { status: 502 }
      );
    }

    const latencyMs = Date.now() - startedAt;
    logger.info('cardio-check: success', { latencyMs, triagePriority: flowOutput.triagePriority });

    logAudit('/api/cardio-check', flowOutput.triagePriority, JSON.stringify(inputData));

    return NextResponse.json(flowOutput, { status: 200 });
  } catch (err) {
    logger.error('cardio-check: unhandled exception', { err: (err as Error).message });
    return NextResponse.json<ApiErrorResponse>(
      { success: false, errorCode: 'INTERNAL_ERROR', message: 'Unexpected server error.', retryable: true },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const maxDuration = 30;
