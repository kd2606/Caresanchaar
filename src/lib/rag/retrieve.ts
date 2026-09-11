import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { embedQuery } from '@/lib/ai/embeddings';
import type { DatasetSource, RecordType } from '@/lib/env';

export interface RetrievedChunk {
  id: string;
  dataset_source: DatasetSource;
  record_type: RecordType;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

export interface RetrieveOptions {
  matchThreshold?: number;
  matchCount?: number;
  filterSources?: DatasetSource[] | null;
  filterTypes?: RecordType[] | null;
}

/**
 * Human-readable retrieval query built from structured patient state.
 *
 * Symptom vocabulary drives most of the retrieval signal (Columbia DBMI is
 * symptom-indexed), so symptoms lead and vitals are appended as qualifiers.
 */
export function buildRetrievalQuery(input: {
  symptoms: string[];
  freeText?: string;
  ageYears?: number;
  sex?: string;
  vitalSummary?: string;
}): string {
  const parts = [
    `Presenting symptoms: ${input.symptoms.join(', ')}.`,
    input.freeText ? `Clinician notes: ${input.freeText}` : '',
    input.ageYears != null ? `Age ${input.ageYears} years.` : '',
    input.sex ? `Sex: ${input.sex}.` : '',
    input.vitalSummary ? `Vitals: ${input.vitalSummary}` : '',
  ];
  return parts.filter(Boolean).join(' ').slice(0, 4_000);
}

/**
 * Retrieve grounding context. Two-stage: over-fetch by similarity, then apply
 * per-source caps so one dataset cannot monopolise the context window.
 */
export async function retrieveClinicalContext(
  query: string,
  options: RetrieveOptions = {},
): Promise<RetrievedChunk[]> {
  const {
    matchThreshold = 0.30,
    matchCount = 12,
    filterSources = null,
    filterTypes = null,
  } = options;

  const queryEmbedding = await embedQuery(query);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.rpc('match_clinical_knowledge', {
    query_embedding: queryEmbedding,
    match_threshold: matchThreshold,
    match_count: matchCount,
    filter_sources: filterSources,
    filter_types: filterTypes,
  });

  if (error) throw new Error(`Vector search failed: ${error.message}`);

  const chunks = (data ?? []) as RetrievedChunk[];

  // Diversity cap: max 5 chunks per dataset_source.
  const perSource = new Map<string, number>();
  return chunks.filter((chunk) => {
    const count = perSource.get(chunk.dataset_source) ?? 0;
    if (count >= 5) return false;
    perSource.set(chunk.dataset_source, count + 1);
    return true;
  });
}

/** Render retrieved chunks as a citable context block for the prompt. */
export function formatContextBlock(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return '(no matching clinical knowledge retrieved)';
  return chunks
    .map(
      (chunk, index) =>
        `[CTX-${index + 1}] source=${chunk.dataset_source} type=${chunk.record_type} ` +
        `similarity=${chunk.similarity.toFixed(3)}\n${chunk.content}`,
    )
    .join('\n\n');
}
