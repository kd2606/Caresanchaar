import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { analyzeCough } from '@/ai/flows/cough-analysis';
import { callWithResilience, isCapacityExhausted } from '@/ai/resilience';
import { logger } from '@/lib/logger';
import { logAudit } from '@/lib/auditLogger';

const MAX_BASE64_BYTES = 8 * 1024 * 1024;

const CoughAnalysisRequestSchema = z.object({
  audioBase64: z.string().min(100, 'Audio payload is empty or too small to be valid.'),
  duration: z.string().min(1, 'Duration is required.'),
  fever: z.string().min(1, 'Fever is required.'),
  breathingDifficulty: z.string().min(1, 'Breathing difficulty is required.'),
});

export interface ApiErrorResponse {
  success: false;
  errorCode:
    | 'PAYLOAD_TOO_LARGE'
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

    const parsed = CoughAnalysisRequestSchema.safeParse(body);
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

    const { audioBase64, duration, fever, breathingDifficulty } = parsed.data;

    const byteLength = Buffer.byteLength(audioBase64, 'utf8');

    if (byteLength > MAX_BASE64_BYTES) {
      logger.warn('cough-analysis: payload rejected', { byteLength });
      return NextResponse.json<ApiErrorResponse>(
        {
          success: false,
          errorCode: 'PAYLOAD_TOO_LARGE',
          message: `Audio exceeds ${MAX_BASE64_BYTES / 1024 / 1024} MB limit. Please record a shorter clip.`,
          retryable: false,
        },
        { status: 413 }
      );
    }

    let flowOutput;
    try {
      flowOutput = await callWithResilience(
        () => analyzeCough({
          audioBase64,
          duration,
          fever,
          breathingDifficulty,
        }),
        { maxAttempts: 3, label: 'cough-analysis-flow', maxDelayMs: 2_000 }
      );
    } catch (err) {
      if (isCapacityExhausted(err)) {
        logger.warn('cough-analysis: capacity exhausted', { err: (err as Error).message });
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

      logger.error('cough-analysis: genkit flow threw', { err: (err as Error).message });
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

    if (!flowOutput || !flowOutput.triagePriority || !flowOutput.coughType) {
      logger.error('cough-analysis: malformed flow output', { flowOutput });
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
    logger.info('cough-analysis: success', { latencyMs, triagePriority: flowOutput.triagePriority });

    logAudit('/api/cough-analysis', flowOutput.triagePriority, audioBase64);

    return NextResponse.json(flowOutput, { status: 200 });
  } catch (err) {
    logger.error('cough-analysis: unhandled exception', { err: (err as Error).message });
    return NextResponse.json<ApiErrorResponse>(
      { success: false, errorCode: 'INTERNAL_ERROR', message: 'Unexpected server error.', retryable: true },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const maxDuration = 30;
