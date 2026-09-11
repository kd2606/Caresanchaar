// src/app/api/skin-scan/route.ts
// Production-hardened: Zod validation, 8MB payload cap, structured error codes,
// real analyzeSkinScan flow call, latency logging.
// Schema adapted to existing flow input/output — frontend unchanged.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { analyzeSkinScan } from '@/ai/flows/skin-scan';
import { callWithResilience, isCapacityExhausted } from '@/ai/resilience';
import { logger } from '@/lib/logger';
import { logAudit } from '@/lib/auditLogger';

// --- Constants ---
// 8 MB cap on the base64 string. Raw image ≈ 6 MB (base64 ~33% overhead).
// Aligns with Gemini 1.5 inline_data limits and serverless body caps.
const MAX_BASE64_BYTES = 8 * 1024 * 1024;

// --- Request schema (matches existing frontend contract) ---
const SkinScanRequestSchema = z.object({
  imageBase64: z
    .string()
    .min(100, 'Image payload is empty or too small to be valid.'),
  itchingLevel: z.string().min(1, 'Itching level is required.'),
  spreadRate: z.string().min(1, 'Spread rate is required.'),
  recentChanges: z.string().min(1, 'Recent changes is required.'),
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
    // 1. Parse body defensively — malformed JSON should never crash the route.
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
    const parsed = SkinScanRequestSchema.safeParse(body);
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

    const { imageBase64, itchingLevel, spreadRate, recentChanges } = parsed.data;

    // 3. Enforce payload size cap.
    const byteLength = Buffer.byteLength(imageBase64, 'utf8');

    if (byteLength > MAX_BASE64_BYTES) {
      logger.warn('skin-scan: payload rejected', { byteLength });
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
        () => analyzeSkinScan({
          imageBase64,
          itchingLevel,
          spreadRate,
          recentChanges,
        }),
        { maxAttempts: 2, label: 'skin-scan-flow', maxDelayMs: 2_000 }
      );
    } catch (err) {
      // Quota / rate-limit exhaustion → 503 with Retry-After.
      if (isCapacityExhausted(err)) {
        logger.warn('skin-scan: capacity exhausted', { err: (err as Error).message });
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
      logger.error('skin-scan: genkit flow threw', { err: (err as Error).message });
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
      logger.error('skin-scan: malformed flow output', { flowOutput });
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
    logger.info('skin-scan: success', { latencyMs, triagePriority: flowOutput.triagePriority });

    logAudit('/api/skin-scan', flowOutput.triagePriority, imageBase64);

    return NextResponse.json(flowOutput, { status: 200 });
  } catch (err) {
    logger.error('skin-scan: unhandled exception', { err: (err as Error).message });
    return NextResponse.json<ApiErrorResponse>(
      { success: false, errorCode: 'INTERNAL_ERROR', message: 'Unexpected server error.', retryable: true },
      { status: 500 }
    );
  }
}

// Increase the body parser ceiling so Next.js doesn't truncate before our validator runs.
export const runtime = 'nodejs';
export const maxDuration = 30;
