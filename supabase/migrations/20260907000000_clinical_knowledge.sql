-- ============================================================================
-- CareSanchaar :: Clinical Knowledge Vector Store
-- ----------------------------------------------------------------------------
-- Dimension choice: 768.
--   pgvector's `vector` type supports up to 2,000 dimensions for HNSW/IVFFlat
--   indexes. gemini-embedding-2 / gemini-embedding-001 emit 3072 by default,
--   which CANNOT be indexed as `vector`. We truncate to 768 via the API's
--   outputDimensionality parameter (Matryoshka), which is index-safe and loses
--   ~0.2 MTEB points. If you later need 3072, migrate the column to
--   halfvec(3072) (indexable up to 4,096) and use halfvec_cosine_ops.
-- ============================================================================

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- Enumerated provenance. Keeping this as a CHECK (not an enum type) makes
-- adding datasets a one-line migration instead of an ALTER TYPE.
-- ---------------------------------------------------------------------------
create table if not exists public.clinical_knowledge (
  id               uuid primary key default gen_random_uuid(),

  -- Provenance. Every retrieved chunk is citable back to its dataset.
  dataset_source   text not null check (dataset_source in (
                     'columbia_dbmi_disease_symptom',
                     'uci_heart_disease_45',
                     'uci_chronic_kidney_disease_336',
                     'uci_diabetes_labeled'
                   )),

  -- Semantic shape of the chunk: drives prompt sectioning and filtering.
  record_type      text not null check (record_type in (
                     'disease_symptom_profile',
                     'cohort_overview',
                     'feature_risk_association'
                   )),

  content          text not null check (length(content) between 20 and 8000),
  metadata         jsonb not null default '{}'::jsonb,

  -- Idempotency key for re-runnable ingestion. Hash of (source|content).
  content_hash     text not null,

  embedding        extensions.vector(768) not null,
  embedding_model  text not null,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Re-running the ingest script must not duplicate rows.
create unique index if not exists clinical_knowledge_content_hash_key
  on public.clinical_knowledge (content_hash);

create index if not exists clinical_knowledge_source_idx
  on public.clinical_knowledge (dataset_source);

-- Cosine HNSW. m/ef_construction tuned for a small corpus (< 100k rows);
-- raise ef_construction to 128+ if you expand the corpus significantly.
create index if not exists clinical_knowledge_embedding_idx
  on public.clinical_knowledge
  using hnsw (embedding extensions.vector_cosine_ops)
  with (m = 16, ef_construction = 64);

alter table public.clinical_knowledge enable row level security;

-- The corpus is non-PHI reference knowledge. Authenticated clinical staff may
-- read it (useful for an MO-facing "why did it say that" panel). Writes are
-- service-role only; the service role bypasses RLS entirely.
drop policy if exists "clinical_knowledge_read_authenticated"
  on public.clinical_knowledge;
create policy "clinical_knowledge_read_authenticated"
  on public.clinical_knowledge for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Cosine similarity search.
--
-- ORDER BY uses the raw `<=>` operator so the HNSW index is actually used;
-- the threshold is applied as a filter on the derived similarity. Ordering by
-- `1 - (embedding <=> q)` DESC would defeat the index.
-- ---------------------------------------------------------------------------
create or replace function public.match_clinical_knowledge (
  query_embedding  extensions.vector(768),
  match_threshold  double precision default 0.30,
  match_count      integer default 10,
  filter_sources   text[] default null,
  filter_types     text[] default null
)
returns table (
  id             uuid,
  dataset_source text,
  record_type    text,
  content        text,
  metadata       jsonb,
  similarity     double precision
)
language sql
stable
parallel safe
security invoker
set search_path = public, extensions
as $$
  select
    ck.id,
    ck.dataset_source,
    ck.record_type,
    ck.content,
    ck.metadata,
    1 - (ck.embedding <=> query_embedding) as similarity
  from public.clinical_knowledge ck
  where (filter_sources is null or ck.dataset_source = any (filter_sources))
    and (filter_types   is null or ck.record_type    = any (filter_types))
    and 1 - (ck.embedding <=> query_embedding) >= match_threshold
  order by ck.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 50);

$$;

revoke all on function public.match_clinical_knowledge from public, anon;
grant execute on function public.match_clinical_knowledge
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Audit trail. Non-negotiable for a clinical screening tool: every AI output
-- must be reconstructable, and every MO override must be recorded.
--
-- client_request_id supports your offline-first sync queue: a PWA replaying a
-- queued triage after reconnect hits the unique index instead of creating a
-- duplicate assessment.
-- ---------------------------------------------------------------------------
create table if not exists public.triage_assessments (
  id                    uuid primary key default gen_random_uuid(),
  client_request_id     text not null,
  created_by            uuid references auth.users (id) on delete set null,

  patient_input         jsonb not null,   -- symptoms + vitals as received
  retrieved_chunk_ids   uuid[] not null default '{}',
  retrieval_top_score   double precision,

  ai_risk_level         text check (ai_risk_level in ('Low','Medium','High','Critical')),
  deterministic_floor   text check (deterministic_floor in ('Low','Medium','High','Critical')),
  final_risk_level      text not null check (final_risk_level in ('Low','Medium','High','Critical')),
  provisional_cue       text,
  ai_raw_response       jsonb,

  embedding_model       text not null,
  generation_model      text not null,
  latency_ms            integer,

  -- MO review loop
  reviewed_by           uuid references auth.users (id) on delete set null,
  reviewed_at           timestamptz,
  mo_agreed             boolean,
  mo_notes              text,

  created_at            timestamptz not null default now()
);

create unique index if not exists triage_assessments_client_request_id_key
  on public.triage_assessments (client_request_id);

create index if not exists triage_assessments_triage_queue_idx
  on public.triage_assessments (final_risk_level, created_at desc)
  where reviewed_at is null;

alter table public.triage_assessments enable row level security;
-- Deliberately no permissive policies here: write via service role only, and
-- add tenant/facility-scoped read policies once your MO role model exists.
