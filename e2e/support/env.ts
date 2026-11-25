import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Reads VITE_SUPABASE_* from the environment or .env.local (never commits secrets; .env* is gitignored). */
function fromDotenv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of ['.env.local', '.env']) {
    const p = resolve(process.cwd(), f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in out)) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  return out;
}
const dot = fromDotenv();
const need = (k: string) => {
  const v = process.env[k] ?? dot[k];
  if (!v) throw new Error('Missing ' + k + ' (load /workspace/expense-tracker-brief/e2e.env or set it in the environment)');
  return v;
};

export const SUPABASE_URL = need('VITE_SUPABASE_URL');
export const SUPABASE_KEY = need('VITE_SUPABASE_ANON_KEY');
export const USERS = {
  A: { email: need('E2E_USER_A_EMAIL'), password: need('E2E_USER_A_PASSWORD') },
  B: { email: need('E2E_USER_B_EMAIL'), password: need('E2E_USER_B_PASSWORD') },
} as const;
export type UserKey = keyof typeof USERS;
export const AUTH_DIR = resolve(process.cwd(), 'e2e/.auth');
export const stateFile = (u: UserKey) => resolve(AUTH_DIR, u + '.json');
export const tokenFile = resolve(AUTH_DIR, 'tokens.json');
export const BASE_URL = process.env.BASE_URL || 'http://localhost:4317';
