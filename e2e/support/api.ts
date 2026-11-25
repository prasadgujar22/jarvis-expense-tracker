import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { SUPABASE_KEY, SUPABASE_URL, tokenFile, type UserKey } from './env';

export const TABLES = ['categories', 'accounts', 'transactions', 'budgets', 'recurring_rules', 'goals', 'settings'] as const;

interface Tokens {
  [k: string]: { accessToken: string; userId: string };
}
function tokens(): Tokens {
  return JSON.parse(readFileSync(tokenFile, 'utf8')) as Tokens;
}

/** A Supabase client acting as that test user (RLS applies), using the access token from global setup. */
export function apiAs(user: UserKey): { db: SupabaseClient; userId: string } {
  const t = tokens()[user];
  const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
    accessToken: async () => t.accessToken,
    auth: { persistSession: false },
    // The e2e host's link to Supabase occasionally stalls: give up after 15s and let retry() try again.
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15_000) }) },
  });
  return { db, userId: t.userId };
}

/** Retries transient network failures (the e2e host's connection to Supabase can blip). */
export async function retry<T>(label: string, fn: () => Promise<T>, attempts = 4): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (!/fetch failed|ECONNRESET|ETIMEDOUT|socket|network|aborted|timed? ?out/i.test(String((e as Error)?.message ?? e))) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error(label + ': ' + String((last as Error)?.message ?? last));
}

export async function wipe(db: SupabaseClient, userId: string) {
  // Tombstones (deleted_ids) exist once that migration is applied; ignore the table if it isn't there yet.
  const tomb = await db.from('deleted_ids').delete().eq('user_id', userId);
  if (tomb.error && tomb.error.code !== 'PGRST205') throw new Error('wipe deleted_ids: ' + tomb.error.message);
  for (const t of TABLES) {
    await retry('wipe ' + t, async () => {
      const { error } = await db.from(t).delete().eq('user_id', userId);
      if (error) throw new Error('wipe ' + t + ': ' + error.message);
    });
  }
}

export async function rows(user: UserKey, table: (typeof TABLES)[number]) {
  const { db } = apiAs(user);
  return retry('select ' + table, async () => {
    const { data, error } = await db.from(table).select('*');
    if (error) throw new Error(error.message);
    return data as Record<string, unknown>[];
  });
}
