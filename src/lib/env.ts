import { z } from 'zod';

/**
 * Fail-fast server environment validation.
 *
 * Importing this module from any client component will (correctly) break the
 * build: SUPABASE_SERVICE_ROLE_KEY bypasses RLS and must never reach a browser.
 */
const schema = z.object({
  GEMINI_API_KEY: z.string().min(10),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

  // gemini-embedding-2 is current; gemini-embedding-001 is supported to 2028.
  // text-embedding-004 was shut down 2026-01-14 and is rejected here.
  GEMINI_EMBEDDING_MODEL: z
    .enum(['gemini-embedding-2', 'gemini-embedding-001'])
    .default('gemini-embedding-2'),

  GEMINI_GENERATION_MODEL: z.string().default('gemini-3.8-flash'),
});

let _env: z.infer<typeof schema> | null = null;

function getEnv() {
  if (!_env) {
    _env = schema.parse({
      GEMINI_API_KEY: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY,
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      GEMINI_EMBEDDING_MODEL: process.env.GEMINI_EMBEDDING_MODEL,
      GEMINI_GENERATION_MODEL: process.env.GEMINI_GENERATION_MODEL,
    });
  }
  return _env;
}

export const env = new Proxy({} as z.infer<typeof schema>, {
  get(_, prop: string) {
    return getEnv()[prop as keyof z.infer<typeof schema>];
  },
});

export type DatasetSource =
  | 'columbia_dbmi_disease_symptom'
  | 'uci_heart_disease_45'
  | 'uci_chronic_kidney_disease_336'
  | 'uci_diabetes_labeled';

export type RecordType =
  | 'disease_symptom_profile'
  | 'cohort_overview'
  | 'feature_risk_association';
