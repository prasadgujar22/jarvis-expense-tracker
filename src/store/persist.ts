import type { DataState, Settings } from './types';
import { DEFAULT_SETTINGS, validAccount, validBudget, validCategory, validGoal, validList, validRecurring, validSettings, validTransaction } from './validate';

export type SliceKey = keyof DataState;
export const SLICES: SliceKey[] = ['categories', 'accounts', 'transactions', 'budgets', 'recurring', 'goals'];

const VALIDATORS: { [K in SliceKey]: (v: unknown) => DataState[K][number] | null } = {
  categories: validCategory,
  accounts: validAccount,
  transactions: validTransaction,
  budgets: validBudget,
  recurring: validRecurring,
  goals: validGoal,
};

export function validSlice<K extends SliceKey>(slice: K, v: unknown): DataState[K] | null {
  return validList(v, VALIDATORS[slice] as (x: unknown) => DataState[K][number] | null) as DataState[K] | null;
}

export function readJSON(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? undefined : (JSON.parse(raw) as unknown);
  } catch {
    return undefined;
  }
}

/** Returns false when the browser refused the write (quota exceeded, storage disabled). */
export function writeJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function parseRaw(raw: string | null): unknown {
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

export function removeKeysWithPrefix(prefix: string): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    /* storage unavailable */
  }
}

/** Device-level theme preference, used before sign-in and for the pre-paint script in index.html. */
export const DEVICE_THEME_KEY = 'kosh:theme';

// ---------------------------------------------------------------------------------------------
// v2: per-user cache  kosh:v2:<userId>:<slice|settings|queue|meta>
// ---------------------------------------------------------------------------------------------
export const v2Prefix = (userId: string) => 'kosh:v2:' + userId + ':';
export const v2Key = (userId: string, name: SliceKey | 'settings' | 'queue' | 'meta' | 'rejected') => v2Prefix(userId) + name;

export interface CachedState {
  data: DataState;
  settings: Settings;
}

export function loadUserCache(userId: string): CachedState | null {
  const meta = readJSON(v2Key(userId, 'meta'));
  if (typeof meta !== 'object' || meta === null || (meta as { cached?: unknown }).cached !== true) return null;
  const data = {} as DataState;
  for (const s of SLICES) (data as Record<SliceKey, unknown>)[s] = validSlice(s, readJSON(v2Key(userId, s))) ?? [];
  return { data, settings: validSettings(readJSON(v2Key(userId, 'settings')) ?? DEFAULT_SETTINGS) };
}

export function saveUserCacheMeta(userId: string): boolean {
  return writeJSON(v2Key(userId, 'meta'), { cached: true, schema: 2, savedAt: new Date().toISOString() });
}

export function clearUserCache(userId: string): void {
  removeKeysWithPrefix(v2Prefix(userId));
}

// ---------------------------------------------------------------------------------------------
// v1: legacy single-device data (before accounts). Only read to offer a one-time import.
// ---------------------------------------------------------------------------------------------
export const V1_PREFIX = 'kosh:v1:';
const V1 = (name: string) => V1_PREFIX + name;

export interface LegacyData {
  data: DataState;
  settings: Settings;
  counts: { transactions: number; accounts: number; budgets: number; recurring: number; goals: number };
  /** Items from the old build's built-in demo data that were left out. */
  demoSkipped: number;
}

// The pre-account build seeded every new device with demo data under fixed ids (real items use random ids).
const DEMO_ACCOUNTS = new Set(['acc_cash', 'acc_hdfc', 'acc_icici', 'acc_gpay']);
const DEMO_RULES = new Set(['rec_salary', 'rec_rent', 'rec_sip', 'rec_netflix', 'rec_spotify', 'rec_prime', 'rec_jio', 'rec_electricity', 'rec_airtel', 'rec_gym']);
const DEMO_BUDGETS = new Set(['bud_overall', 'bud_food', 'bud_groceries', 'bud_transport', 'bud_shopping', 'bud_entertainment', 'bud_bills']);
const DEMO_GOALS = new Set(['goal_emergency', 'goal_japan', 'goal_macbook']);
const DEMO_NAME = 'Aarav';

function isDemoTransaction(t: { id: string; recurringId: string | null }): boolean {
  if (t.id.startsWith('seed_')) return true;
  const m = /^rec:([^:]+):/.exec(t.id);
  return !!m && DEMO_RULES.has(m[1]);
}

/** Remove the demo items; keep a demo account only if the user's own transactions or rules use it. */
export function stripDemoData(data: DataState): { data: DataState; skipped: number } {
  const transactions = data.transactions.filter((t) => !isDemoTransaction(t));
  const recurring = data.recurring.filter((r) => !DEMO_RULES.has(r.id));
  const used = new Set<string>();
  for (const t of transactions) {
    used.add(t.accountId);
    if (t.toAccountId) used.add(t.toAccountId);
  }
  for (const r of recurring) used.add(r.accountId);
  const accounts = data.accounts.filter((a) => !DEMO_ACCOUNTS.has(a.id) || used.has(a.id));
  const budgets = data.budgets.filter((b) => !DEMO_BUDGETS.has(b.id));
  const goals = data.goals.filter((g) => !DEMO_GOALS.has(g.id));
  const skipped =
    data.transactions.length - transactions.length + data.recurring.length - recurring.length + data.accounts.length - accounts.length +
    data.budgets.length - budgets.length + data.goals.length - goals.length;
  return { data: { categories: data.categories, accounts, transactions, budgets, recurring, goals }, skipped };
}

export function hasLegacyData(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) if (localStorage.key(i)?.startsWith(V1_PREFIX)) return true;
  } catch {
    /* storage unavailable */
  }
  return false;
}

/** Reads kosh:v1:* (validated). Returns null when there is nothing worth importing. */
export function loadLegacyData(): LegacyData | null {
  if (!hasLegacyData()) return null;
  const raw = {} as DataState;
  for (const s of SLICES) (raw as Record<SliceKey, unknown>)[s] = validSlice(s, readJSON(V1(s))) ?? [];
  const { data, skipped } = stripDemoData(raw);
  const settings = validSettings(readJSON(V1('settings')) ?? DEFAULT_SETTINGS);
  if (settings.name === DEMO_NAME) settings.name = '';
  const counts = {
    transactions: data.transactions.length, accounts: data.accounts.length, budgets: data.budgets.length,
    recurring: data.recurring.length, goals: data.goals.length,
  };
  // Categories alone (the defaults every install had) are not worth an import prompt.
  const anything = counts.transactions + counts.accounts + counts.budgets + counts.recurring + counts.goals > 0;
  return anything ? { data, settings, counts, demoSkipped: skipped } : null;
}

export function clearLegacyData(): void {
  removeKeysWithPrefix(V1_PREFIX);
}
