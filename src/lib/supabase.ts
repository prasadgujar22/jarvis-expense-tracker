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

/**
 * Every Supabase request gets a deadline: a connection that stalls would otherwise hold the sync chain forever.
 * A timeout surfaces as a network error, so the sync layer retries it like being offline.
 */
const REQUEST_TIMEOUT_MS = 30_000;
const fetchWithTimeout: typeof fetch = (input, init) => {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const signal = init?.signal && typeof AbortSignal.any === 'function' ? AbortSignal.any([init.signal, timeout]) : (init?.signal ?? timeout);
  return fetch(input, { ...init, signal });
};

/** Null when the app is not configured; the UI shows a configuration screen instead of crashing. */
export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url!, key!, {
      auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
      global: { fetch: fetchWithTimeout },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}
