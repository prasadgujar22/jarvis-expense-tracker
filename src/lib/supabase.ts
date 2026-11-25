import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

function looksValid(u: string | undefined, k: string | undefined): boolean {
  if (!u || !k) return false;
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'https:' || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

/** True when both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are present and usable. */
export const supabaseConfigured = looksValid(url, key);

/** Null when the app is not configured; the UI shows a configuration screen instead of crashing. */
export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url!, key!, {
      auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}
