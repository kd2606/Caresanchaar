/**
 * CareSanchaar knowledge-base ingestion.
 *
 *   pnpm tsx src/scripts/ingest-data.ts                    # ingest everything
 *   pnpm tsx src/scripts/ingest-data.ts --only heart,ckd   # subset
 *   pnpm tsx src/scripts/ingest-data.ts --dry-run          # transform only
 *   pnpm tsx src/scripts/ingest-data.ts --truncate         # rebuild corpus
 *
 * Idempotent: rows are upserted on content_hash, so re-running after a
 * transformer change updates in place rather than duplicating. Records whose
 * content is unchanged are skipped WITHOUT re-embedding, so incremental runs
 * are cheap.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'csv-parse/sync';

import { env } from '@/lib/env';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { embedDocuments } from '@/lib/ai/embeddings';
import {
  TABULAR_CONFIGS,
  transformColumbiaDiseaseSymptom,
  transformLabeledTable,
  type CsvRow,
  type KnowledgeDoc,
} from './datasets/transformers';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const COLUMBIA_FILE = 'disease-symptom-columbia.csv';

/** Gemini embedding batch size. Keep modest to stay inside per-request limits. */
const EMBED_BATCH = 32;
/** Supabase insert batch size. */
const UPSERT_BATCH = 100;

interface Args {
  only: string[] | null;
  dryRun: boolean;
  truncate: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const onlyRaw = argv.find((a) => a.startsWith('--only='))?.split('=')[1];
  return {
    only: onlyRaw ? onlyRaw.split(',').map((s) => s.trim().toLowerCase()) : null,
    dryRun: argv.includes('--dry-run'),
    truncate: argv.includes('--truncate'),
  };
}

async function readCsv(fileName: string): Promise<CsvRow[]> {
  const filePath = path.join(DATA_DIR, fileName);
  let text: string;
  try {
    text = await readFile(filePath, 'utf8');
  } catch {
    throw new Error(`Missing data file: ${filePath}`);
  }
  return parse(text, {
    columns: (header: string[]) => header.map((h) => h.trim()),
    skip_empty_lines: true,
    relax_column_count: true, // UCI redistributions have ragged trailing commas
    relax_quotes: true,
    bom: true,
    trim: true,
  }) as CsvRow[];
}

const hashDoc = (doc: KnowledgeDoc): string =>
  createHash('sha256').update(`${doc.datasetSource}|${doc.content}`).digest('hex');

/** Which dataset keys the --only flag understands. */
function datasetKey(source: string): string {
  if (source.includes('columbia')) return 'columbia';
  if (source.includes('heart')) return 'heart';
  if (source.includes('kidney')) return 'ckd';
  return 'diabetes';
}

async function collectDocuments(args: Args): Promise<KnowledgeDoc[]> {
  const docs: KnowledgeDoc[] = [];
  const wanted = (key: string) => !args.only || args.only.includes(key);

  if (wanted('columbia')) {
    try {
      const rows = await readCsv(COLUMBIA_FILE);
      const produced = transformColumbiaDiseaseSymptom(rows);
      console.log(`  columbia : ${rows.length} rows -> ${produced.length} documents`);
      docs.push(...produced);
    } catch (error) {
      console.warn(`  columbia : SKIPPED (${(error as Error).message})`);
    }
  }

  for (const config of TABULAR_CONFIGS) {
    const key = datasetKey(config.datasetSource);
    if (!wanted(key)) continue;
    try {
      const rows = await readCsv(config.file);
      const produced = transformLabeledTable(config, rows);
      console.log(`  ${key.padEnd(9)}: ${rows.length} rows -> ${produced.length} documents`);
      docs.push(...produced);
    } catch (error) {
      console.warn(`  ${key.padEnd(9)}: SKIPPED (${(error as Error).message})`);
    }
  }

  return docs;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const startedAt = Date.now();

  console.log('CareSanchaar :: clinical knowledge ingestion');
  console.log(`  embedding model : ${env.GEMINI_EMBEDDING_MODEL}`);
  console.log(`  data directory  : ${DATA_DIR}\n`);

  console.log('Transforming datasets:');
  const docs = await collectDocuments(args);
  console.log(`\nTotal documents produced: ${docs.length}`);

  if (docs.length === 0) {
    console.error('Nothing to ingest. Check that your CSVs are present in /data.');
    process.exit(1);
  }

  if (args.dryRun) {
    console.log('\n--dry-run: sample document\n');
    console.log(docs[0].content);
    console.log(`\n(no API calls made, no rows written)`);
    return;
  }

  const supabase = getSupabaseAdmin();

  if (args.truncate) {
    console.log('\n--truncate: clearing clinical_knowledge...');
    const { error } = await supabase
      .from('clinical_knowledge')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw new Error(`Truncate failed: ${error.message}`);
  }

  // ---- Skip documents already embedded with the current model --------------
  const hashed = docs.map((doc) => ({ doc, hash: hashDoc(doc) }));
  const { data: existing, error: existingError } = await supabase
    .from('clinical_knowledge')
    .select('content_hash, embedding_model');
  if (existingError) throw new Error(`Failed to read existing hashes: ${existingError.message}`);

  const upToDate = new Set(
    (existing ?? [])
      .filter((row) => row.embedding_model === env.GEMINI_EMBEDDING_MODEL)
      .map((row) => row.content_hash as string),
  );
  const pending = hashed.filter((item) => !upToDate.has(item.hash));

  console.log(`\nAlready current: ${hashed.length - pending.length}`);
  console.log(`To embed       : ${pending.length}`);
  if (pending.length === 0) {
    console.log('Knowledge base is up to date.');
    return;
  }

  // ---- Embed + upsert in batches ------------------------------------------
  let written = 0;
  const buffer: Array<Record<string, unknown>> = [];

  const flush = async () => {
    if (buffer.length === 0) return;
    const { error } = await supabase
      .from('clinical_knowledge')
      .upsert(buffer, { onConflict: 'content_hash' });
    if (error) throw new Error(`Upsert failed: ${error.message}`);
    written += buffer.length;
    buffer.length = 0;
    console.log(`  written ${written}/${pending.length}`);
  };

  for (let i = 0; i < pending.length; i += EMBED_BATCH) {
    const slice = pending.slice(i, i + EMBED_BATCH);
    const vectors = await embedDocuments(
      slice.map(({ doc }) => ({ title: doc.title, content: doc.content })),
      'document',
    );
    await new Promise(resolve => setTimeout(resolve, 22000));

    slice.forEach(({ doc, hash }, index) => {
      buffer.push({
        dataset_source: doc.datasetSource,
        record_type: doc.recordType,
        content: doc.content,
        metadata: { ...doc.metadata, title: doc.title },
        content_hash: hash,
        embedding: vectors[index],
        embedding_model: env.GEMINI_EMBEDDING_MODEL,
        updated_at: new Date().toISOString(),
      });
    });

    if (buffer.length >= UPSERT_BATCH) await flush();
  }
  await flush();

  console.log(`\nDone. ${written} documents ingested in ${((Date.now() - startedAt) / 1000).toFixed(1)}s.`);
}

main().catch((error) => {
  console.error('\nIngestion failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
