import { ai, FALLBACK_MODELS, PRIMARY_MODEL } from "@/ai/genkit";
import type { GenerateOptions } from "genkit";

const RETRYABLE_MARKERS = [
    "404",
    "not found",
    "429",
    "402",
    "rate limit",
    "too many requests",
    "quota",
    "throttle",
    "payment required",
    "more credits",
    "temporarily rate-limited",
    "capacity",
    "overloaded",
    "model not found",
    "invalid model",
    "no endpoints",
    "unavailable",
];

const isRetryableError = (error: unknown): boolean => {
    if (!error || typeof error !== "object") return false;

    const e = error as { status?: number; message?: string; code?: number };
    const retryableCodes = [404, 429, 402, 503, 500];

    if (retryableCodes.includes(e.status ?? 0)) return true;
    if (retryableCodes.includes(e.code ?? 0)) return true;

    const message = (e.message || String(error) || "").toLowerCase();
    return RETRYABLE_MARKERS.some((marker) => message.includes(marker));
};

/**
 * Race a promise against a hard timeout.
 * Resolves or rejects based on whichever finishes first.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new Error(`[Timeout] ${label} exceeded ${ms}ms`)),
            ms
        );
        promise
            .then((v) => { clearTimeout(timer); resolve(v); })
            .catch((e) => { clearTimeout(timer); reject(e); });
    });
}

// ── Per-model timeout: 15 seconds max per attempt ──
const MODEL_TIMEOUT_MS = 15_000;

// ── Full fallback chain (text-only features) ──
export async function generateWithModelFallback(
    request: GenerateOptions
) {
    const firstModel = request.model || PRIMARY_MODEL;

    // Only try primary + first 2 fallbacks to stay within Vercel's 60s limit
    const modelsToTry = [firstModel, ...FALLBACK_MODELS]
        .filter((model, index, list) => list.indexOf(model) === index)
        .slice(0, 4);

    let lastError: unknown;

    for (let i = 0; i < modelsToTry.length; i++) {
        const model = modelsToTry[i];
        try {
            const result = await withTimeout(
                ai.generate({ ...request, model }),
                MODEL_TIMEOUT_MS,
                model
            );

            return result;
        } catch (error) {
            lastError = error;

            // Small delay before trying next model
            if (i < modelsToTry.length - 1 && isRetryableError(error)) {
                await new Promise((r) => setTimeout(r, 500));
            }
        }
    }

    throw lastError || new Error("All AI models are currently busy. Please try again in a moment.");
}

// ── Gemini-only (for image/audio features — OpenRouter free tier has no vision) ──
export async function generateWithGeminiOnly(
    request: GenerateOptions
) {
    const geminiModels = [
        "googleai/gemini-2.5-flash",
    ];

    let lastError: unknown;

    for (let i = 0; i < geminiModels.length; i++) {
        const model = geminiModels[i];
        try {
            const result = await withTimeout(
                ai.generate({ ...request, model }),
                25_000, // Vision gets more time since image processing is slower
                model
            );

            return result;
        } catch (error) {
            lastError = error;

            if (i < geminiModels.length - 1) {
                await new Promise((r) => setTimeout(r, 1000));
            }
        }
    }

    throw lastError || new Error("Image analysis is temporarily unavailable. Please try again in a moment.");
}
