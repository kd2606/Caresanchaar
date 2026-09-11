import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { analyzeVisionScan } from '@/ai/flows/vision-scan';
import { callWithResilience, isCapacityExhausted } from '@/ai/resilience';
import { logger } from '@/lib/logger';
import { logAudit } from '@/lib/auditLogger';

// --- Constants ---
const MAX_BASE64_BYTES = 8 * 1024 * 1024;

// --- Request schema (matches existing frontend contract) ---
const VisionScanRequestSchema = z.object({
  imageBase64: z
    .string()
    .min(100, 'Image payload is empty or too small to be valid.'),
  screenTime: z.string().min(1, 'Screen time is required.'),
  sleepHours: z.string().min(1, 'Sleep hours is required.'),
  stressLevel: z.string().min(1, 'Stress level is required.'),
});

// --- Structured error response ---
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
    // 1. Parse body defensively
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json<ApiErrorResponse>(
        { success: false, errorCode: 'INVALID_PAYLOAD', message: 'Request body is not valid JSON.', retryable: false },
        { status: 400 }
      );
    }

    // 2. Validate schema.
    const parsed = VisionScanRequestSchema.safeParse(body);
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

    const { imageBase64, screenTime, sleepHours, stressLevel } = parsed.data;

    // 3. Enforce payload size cap.
    const byteLength = Buffer.byteLength(imageBase64, 'utf8');

    if (byteLength > MAX_BASE64_BYTES) {
      logger.warn('vision-scan: payload rejected', { byteLength });
      return NextResponse.json<ApiErrorResponse>(
        {
          success: false,
          errorCode: 'PAYLOAD_TOO_LARGE',
          message: `Image exceeds ${MAX_BASE64_BYTES / 1024 / 1024} MB limit. Please compress before uploading.`,
          retryable: false,
        },
        { status: 413 }
      );
    }

    // 4. Invoke the real Genkit flow with resilience wrapper (retry + backoff).
    let flowOutput;
    try {
      flowOutput = await callWithResilience(
        () => analyzeVisionScan({
          imageBase64,
          screenTime,
          sleepHours,
          stressLevel,
        }),
        { maxAttempts: 3, label: 'vision-scan-flow', maxDelayMs: 2_000 }
      );
    } catch (err) {
      // Quota / rate-limit exhaustion → 503 with Retry-After.
      if (isCapacityExhausted(err)) {
        logger.warn('vision-scan: capacity exhausted', { err: (err as Error).message });
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

      // Other AI failures.
      logger.error('vision-scan: genkit flow threw', { err: (err as Error).message });
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

    // 5. Validate the flow output before trusting it (defense against schema drift).
    if (
      !flowOutput ||
      !flowOutput.triagePriority ||
      !flowOutput.simpleExplanation
    ) {
      logger.error('vision-scan: malformed flow output', { flowOutput });
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

    // 6. Return the flow output directly — matches existing frontend expectations.
    const latencyMs = Date.now() - startedAt;
    logger.info('vision-scan: success', { latencyMs, triagePriority: flowOutput.triagePriority });

    logAudit('/api/vision-scan', flowOutput.triagePriority, imageBase64);

    return NextResponse.json(flowOutput, { status: 200 });
  } catch (err) {
    logger.error('vision-scan: unhandled exception', { err: (err as Error).message });
    return NextResponse.json<ApiErrorResponse>(
      { success: false, errorCode: 'INTERNAL_ERROR', message: 'Unexpected server error.', retryable: true },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const maxDuration = 30;
