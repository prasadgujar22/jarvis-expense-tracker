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
  });
  return { db, userId: t.userId };
}

export async function wipe(db: SupabaseClient, userId: string) {
  for (const t of TABLES) {
    const { error } = await db.from(t).delete().eq('user_id', userId);
    if (error) throw new Error('wipe ' + t + ': ' + error.message);
  }
}

export async function rows(user: UserKey, table: (typeof TABLES)[number]) {
  const { db } = apiAs(user);
  const { data, error } = await db.from(table).select('*');
  if (error) throw new Error(error.message);
  return data as Record<string, unknown>[];
}
