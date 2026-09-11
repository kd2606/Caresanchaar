import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

let cached: SupabaseClient | null = null;

/**
 * Service-role client. Bypasses RLS — server-side only, never import from a
 * component that ships to the browser.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-application-name': 'caresanchaar-server' } },
  });
  return cached;
}
