import { GoogleGenAI } from '@google/genai';
import { env } from '@/lib/env';

/** Must match `vector(768)` in the migration. */
export const EMBEDDING_DIMENSIONS = 768;

/** Conservative char budget: 8,192-token cap on embedding-2, ~2,048 on 001. */
const MAX_CHARS = env.GEMINI_EMBEDDING_MODEL === 'gemini-embedding-001' ? 6_000 : 24_000;

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

export type EmbedIntent = 'document' | 'query';

/**
 * Asymmetric retrieval requires query and document embeddings to be produced
 * with matching task conditioning, otherwise recall degrades badly.
 *
 *   gemini-embedding-2   -> task conditioning via text prefixes
 *   gemini-embedding-001 -> task conditioning via the taskType enum
 */
function applyTaskFormat(text: string, intent: EmbedIntent, title?: string): string {
  if (env.GEMINI_EMBEDDING_MODEL !== 'gemini-embedding-2') return text;
  return intent === 'query'
    ? `task: search result | query: ${text}`
    : `title: ${title?.trim() || 'none'} | text: ${text}`;
}

function taskTypeFor(intent: EmbedIntent): string | undefined {
  if (env.GEMINI_EMBEDDING_MODEL !== 'gemini-embedding-001') return undefined;
  return intent === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT';
}

/**
 * gemini-embedding-001 does NOT auto-normalize truncated (non-3072) vectors.
 * Cosine distance in pgvector is magnitude-insensitive, but normalizing keeps
 * the stored vectors consistent and makes inner-product swaps safe later.
 * gemini-embedding-2 auto-normalizes, so this is a no-op there.
 */
function l2Normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((acc, x) => acc + x * x, 0));
  return norm === 0 ? v : v.map((x) => x / norm);
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const retryable = /429|5\d\d|RESOURCE_EXHAUSTED|UNAVAILABLE|DEADLINE|ECONN|fetch failed/i.test(message);
      if (!retryable || i === attempts - 1) throw error;
      // Exponential backoff with jitter to avoid thundering-herd on 429s.
      const delay = Math.min(2 ** i * 800, 20_000) + Math.random() * 400;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

export interface EmbeddableDoc {
  /** Short human-readable title; improves asymmetric retrieval quality. */
  title?: string;
  content: string;
}

/**
 * Batch-embed documents.
 *
 * Each input is wrapped in its own Content object. This is deliberate: passing
 * bare strings in `contents` to gemini-embedding-2 produces a single AGGREGATED
 * embedding across all parts, silently collapsing your batch into one vector.
 * Separate Content objects guarantee one embedding per input.
 */
export async function embedDocuments(
  docs: EmbeddableDoc[],
  intent: EmbedIntent = 'document',
): Promise<number[][]> {
  if (docs.length === 0) return [];

  const contents = docs.map((doc) => ({
    parts: [
      { text: applyTaskFormat(doc.content.slice(0, MAX_CHARS), intent, doc.title) },
    ],
  }));

  const taskType = taskTypeFor(intent);

  const response = await withRetry(() =>
    ai.models.embedContent({
      model: env.GEMINI_EMBEDDING_MODEL,
      contents,
      config: {
        outputDimensionality: EMBEDDING_DIMENSIONS,
        ...(taskType ? { taskType } : {}),
      },
    }),
  );

  const embeddings = response.embeddings ?? [];
  if (embeddings.length !== docs.length) {
    throw new Error(
      `Embedding count mismatch: expected ${docs.length}, received ${embeddings.length}. ` +
        `The batch may have been aggregated into a single vector.`,
    );
  }

  return embeddings.map((item, index) => {
    const values = item.values;
    if (!values || values.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Bad embedding at index ${index}: got ${values?.length ?? 0} dims, expected ${EMBEDDING_DIMENSIONS}.`,
      );
    }
    return l2Normalize(values);
  });
}

/** Convenience wrapper for the single-query path used by the triage route. */
export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await embedDocuments([{ content: text }], 'query');
  return vector;
}
