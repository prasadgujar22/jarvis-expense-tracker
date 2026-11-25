import { createClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { AUTH_DIR, BASE_URL, SUPABASE_KEY, SUPABASE_URL, USERS, stateFile, tokenFile, type UserKey } from './support/env';
import { TABLES, retry, wipe } from './support/api';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Rows left per table after a wipe (should be none). */
async function leftovers(db: SupabaseClient, userId: string): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of [...TABLES, 'deleted_ids']) {
    const { count, error } = await retry('count ' + t, async () => {
      const r = await db.from(t).select('*', { count: 'exact', head: true }).eq('user_id', userId);
      if (r.error && r.error.code !== 'PGRST205') throw new Error(r.error.message);
      return r;
    });
    if (!error && count) out[t] = count;
  }
  return out;
}
import { DEFAULT_CATEGORIES } from '../src/data/categories';

/**
 * Signs each test user in once (sign-ins are rate limited), wipes their data through the API as that user
 * (RLS-allowed delete), and saves a Playwright storageState holding the Supabase session.
 * User B is left onboarded with only default categories, so every page shows its empty state.
 */
export default async function globalSetup() {
  mkdirSync(AUTH_DIR, { recursive: true });
  const origin = new URL(BASE_URL).origin;
  const tokens: Record<string, { accessToken: string; userId: string }> = {};
  for (const key of Object.keys(USERS) as UserKey[]) {
    const mem = new Map<string, string>();
    const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storage: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: (k) => void mem.delete(k) },
      },
    });
    const { data, error } = await retry('sign in ' + key, async () => {
      const res = await client.auth.signInWithPassword(USERS[key]);
      if (res.error && /fetch failed/i.test(res.error.message)) throw new Error(res.error.message);
      return res;
    });
    if (error || !data.session) throw new Error('Sign-in failed for test user ' + key + ': ' + (error?.message ?? 'no session'));
    const userId = data.user.id;
    await wipe(client, userId);
    // A request still in flight from a previous run can land after the wipe: verify, and wipe once more if needed.
    let left = await leftovers(client, userId);
    if (Object.keys(left).length) {
      await new Promise((r) => setTimeout(r, 3000));
      await wipe(client, userId);
      left = await leftovers(client, userId);
    }
    if (Object.keys(left).length) throw new Error('Could not empty test user ' + key + ': ' + JSON.stringify(left));
    if (key === 'B') {
      const { error: e1 } = await client.from('settings').upsert({ user_id: userId, name: 'QA Bee', currency: 'INR', theme: 'dark', onboarded: true });
      if (e1) throw new Error(e1.message);
      const { error: e2 } = await client.from('categories').upsert(DEFAULT_CATEGORIES.map((c) => ({ ...c, user_id: userId })));
      if (e2) throw new Error(e2.message);
    }
    tokens[key] = { accessToken: data.session.access_token, userId };
    const localStorage = [...mem.entries()].filter(([k]) => k.startsWith('sb-')).map(([name, value]) => ({ name, value }));
    writeFileSync(stateFile(key), JSON.stringify({ cookies: [], origins: [{ origin, localStorage }] }, null, 2));
  }
  writeFileSync(tokenFile, JSON.stringify(tokens));
}
