import type { DataState, Settings } from './types';
import { DEFAULT_SETTINGS, validAccount, validBudget, validCategory, validGoal, validList, validRecurring, validSettings, validTransaction } from './validate';
import { DEFAULT_CATEGORIES } from '../data/categories';

export const PREFIX = 'kosh:v1:';
export const KEYS = {
  meta: PREFIX + 'meta',
  settings: PREFIX + 'settings',
  categories: PREFIX + 'categories',
  accounts: PREFIX + 'accounts',
  transactions: PREFIX + 'transactions',
  budgets: PREFIX + 'budgets',
  recurring: PREFIX + 'recurring',
  goals: PREFIX + 'goals',
} as const;

type SliceKey = keyof DataState;
export const SLICES: SliceKey[] = ['categories', 'accounts', 'transactions', 'budgets', 'recurring', 'goals'];

function readJSON(key: string): unknown {
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

function parseRaw(raw: string | null): unknown {
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

export type RemoteChange =
  | { kind: 'settings'; value: Settings }
  | { kind: 'slice'; slice: SliceKey; value: DataState[SliceKey] };

/** Validate a value another tab wrote, for a storage 'storage' event. Returns null if the key isn't ours or the value is unusable. */
export function parseRemote(key: string | null, raw: string | null): RemoteChange | null {
  if (!key || !key.startsWith(PREFIX)) return null;
  const v = parseRaw(raw);
  if (v === undefined) return null;
  if (key === KEYS.settings) return { kind: 'settings', value: validSettings(v) };
  switch (key) {
    case KEYS.categories: {
      const list = validList(v, validCategory);
      return list && list.length > 0 ? { kind: 'slice', slice: 'categories', value: list } : null;
    }
    case KEYS.accounts: {
      const list = validList(v, validAccount);
      return list ? { kind: 'slice', slice: 'accounts', value: list } : null;
    }
    case KEYS.transactions: {
      const list = validList(v, validTransaction);
      return list ? { kind: 'slice', slice: 'transactions', value: list } : null;
    }
    case KEYS.budgets: {
      const list = validList(v, validBudget);
      return list ? { kind: 'slice', slice: 'budgets', value: list } : null;
    }
    case KEYS.recurring: {
      const list = validList(v, validRecurring);
      return list ? { kind: 'slice', slice: 'recurring', value: list } : null;
    }
    case KEYS.goals: {
      const list = validList(v, validGoal);
      return list ? { kind: 'slice', slice: 'goals', value: list } : null;
    }
    default:
      return null;
  }
}

export interface Loaded {
  initialized: boolean;
  data: DataState;
  settings: Settings;
}

export function loadAll(): Loaded {
  const meta = readJSON(KEYS.meta);
  const initialized = typeof meta === 'object' && meta !== null && (meta as { initialized?: unknown }).initialized === true;
  const settings = validSettings(readJSON(KEYS.settings) ?? DEFAULT_SETTINGS);
  const categories = validList(readJSON(KEYS.categories), validCategory);
  const data: DataState = {
    categories: categories && categories.length > 0 ? categories : DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    accounts: validList(readJSON(KEYS.accounts), validAccount) ?? [],
    transactions: validList(readJSON(KEYS.transactions), validTransaction) ?? [],
    budgets: validList(readJSON(KEYS.budgets), validBudget) ?? [],
    recurring: validList(readJSON(KEYS.recurring), validRecurring) ?? [],
    goals: validList(readJSON(KEYS.goals), validGoal) ?? [],
  };
  return { initialized, data, settings };
}

export function saveMeta(): boolean {
  return writeJSON(KEYS.meta, { initialized: true, schema: 1, updatedAt: new Date().toISOString() });
}
