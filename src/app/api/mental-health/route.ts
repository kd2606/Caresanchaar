import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { analyzeMentalHealth } from '@/ai/flows/mental-health';
import { callWithResilience, isCapacityExhausted } from '@/ai/resilience';
import { logger } from '@/lib/logger';

const MentalHealthRequestSchema = z.object({
  answers: z.array(
    z.object({
      question: z.string().max(500, 'Question text too long.'),
      answer: z.number().min(0).max(10, 'Answer must be between 0 and 10.'),
    })
  ).max(50, 'Too many answers.'),
  voiceMetrics: z.object({
    wpm: z.number().min(0).max(500),
    tension: z.string().max(100),
  }),
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

    const parsed = MentalHealthRequestSchema.safeParse(body);
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

    const { answers, voiceMetrics } = parsed.data;

    let flowOutput;
    try {
      flowOutput = await callWithResilience(
        () => analyzeMentalHealth({
          answers,
          voiceMetrics,
        }),
        { maxAttempts: 3, label: 'mental-health-flow', maxDelayMs: 2_000 }
      );
    } catch (err) {
      if (isCapacityExhausted(err)) {
        logger.warn('mental-health: capacity exhausted', { err: (err as Error).message });
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

      logger.error('mental-health: genkit flow threw', { err: (err as Error).message });
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

    if (!flowOutput || typeof flowOutput.wellnessScore !== 'number') {
      logger.error('mental-health: malformed flow output', { flowOutput });
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
    logger.info('mental-health: success', { latencyMs });

    return NextResponse.json(flowOutput, { status: 200 });
  } catch (err) {
    logger.error('mental-health: unhandled exception', { err: (err as Error).message });
    return NextResponse.json<ApiErrorResponse>(
      { success: false, errorCode: 'INTERNAL_ERROR', message: 'Unexpected server error.', retryable: true },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const maxDuration = 30;
