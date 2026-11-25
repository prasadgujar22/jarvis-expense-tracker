import type { Account, Backup, Budget, Category, DataState, Goal, GoalContribution, RecurringRule, Settings, Transaction } from './types';
import { isISODate } from '../lib/dates';
import { isCurrency } from '../lib/money';
import { FREQUENCIES, type Frequency } from '../lib/recurring';

type Rec = Record<string, unknown>;
const isObj = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const int = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);
const oneOf = <T extends string>(v: unknown, opts: readonly T[]): T | null => (typeof v === 'string' && (opts as readonly string[]).includes(v) ? (v as T) : null);
const nullableStr = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const color = (v: unknown, fb = '#64748b') => (typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : fb);

export function validCategory(v: unknown): Category | null {
  if (!isObj(v)) return null;
  const kind = oneOf(v.kind, ['expense', 'income'] as const);
  const id = str(v.id);
  const name = str(v.name).trim();
  if (!id || !name || !kind) return null;
  return { id, name, kind, icon: str(v.icon, 'tag'), color: color(v.color) };
}

export function validAccount(v: unknown): Account | null {
  if (!isObj(v)) return null;
  const type = oneOf(v.type, ['cash', 'bank', 'card', 'wallet'] as const);
  const id = str(v.id);
  const name = str(v.name).trim();
  const ob = int(v.openingBalance);
  if (!id || !name || !type || ob === null) return null;
  return { id, name, type, openingBalance: ob, color: color(v.color, '#14b8a6'), archived: v.archived === true };
}

export function validTransaction(v: unknown): Transaction | null {
  if (!isObj(v)) return null;
  const type = oneOf(v.type, ['income', 'expense', 'transfer'] as const);
  const id = str(v.id);
  const amount = int(v.amount);
  const accountId = str(v.accountId);
  if (!id || !type || amount === null || amount < 0 || !accountId || !isISODate(v.date)) return null;
  const toAccountId = nullableStr(v.toAccountId);
  if (type === 'transfer' && !toAccountId) return null;
  const categoryId = nullableStr(v.categoryId);
  if (type !== 'transfer' && !categoryId) return null;
  const tags = Array.isArray(v.tags) ? v.tags.filter((t): t is string => typeof t === 'string' && t.trim() !== '') : [];
  return {
    id, type, amount, accountId, date: v.date,
    categoryId: type === 'transfer' ? null : categoryId,
    toAccountId: type === 'transfer' ? toAccountId : null,
    payee: str(v.payee), note: str(v.note), tags,
    recurringId: nullableStr(v.recurringId),
    createdAt: int(v.createdAt) ?? Date.now(),
  };
}

export function validBudget(v: unknown): Budget | null {
  if (!isObj(v)) return null;
  const id = str(v.id);
  const amount = int(v.amount);
  if (!id || amount === null || amount <= 0) return null;
  return { id, categoryId: nullableStr(v.categoryId), amount };
}

export function validRecurring(v: unknown): RecurringRule | null {
  if (!isObj(v)) return null;
  const type = oneOf(v.type, ['income', 'expense'] as const);
  const frequency = oneOf<Frequency>(v.frequency, FREQUENCIES);
  const id = str(v.id);
  const amount = int(v.amount);
  if (!id || !type || !frequency || amount === null || amount <= 0 || !isISODate(v.startDate)) return null;
  const categoryId = str(v.categoryId);
  const accountId = str(v.accountId);
  if (!categoryId || !accountId) return null;
  return {
    id, type, frequency, amount, categoryId, accountId,
    title: str(v.title, 'Recurring'),
    interval: Math.max(1, int(v.interval) ?? 1),
    startDate: v.startDate,
    endDate: isISODate(v.endDate) ? v.endDate : null,
    autoPost: v.autoPost === true,
    isSubscription: v.isSubscription === true,
    postedThrough: isISODate(v.postedThrough) ? v.postedThrough : null,
    active: v.active !== false,
  };
}

function validContribution(v: unknown): GoalContribution | null {
  if (!isObj(v)) return null;
  const amount = int(v.amount);
  if (!str(v.id) || amount === null || !isISODate(v.date)) return null;
  return { id: str(v.id), amount, date: v.date, note: str(v.note) };
}

export function validGoal(v: unknown): Goal | null {
  if (!isObj(v)) return null;
  const id = str(v.id);
  const target = int(v.target);
  const name = str(v.name).trim();
  if (!id || !name || target === null || target <= 0) return null;
  return {
    id, name, target,
    targetDate: isISODate(v.targetDate) ? v.targetDate : null,
    emoji: str(v.emoji, '🎯') || '🎯',
    color: color(v.color, '#10b981'),
    contributions: Array.isArray(v.contributions) ? v.contributions.map(validContribution).filter((c): c is GoalContribution => c !== null) : [],
    createdAt: int(v.createdAt) ?? Date.now(),
  };
}

export const DEFAULT_SETTINGS: Settings = { currency: 'INR', theme: 'dark', name: 'Aarav', lastAccountId: null };

export function validSettings(v: unknown): Settings {
  if (!isObj(v)) return { ...DEFAULT_SETTINGS };
  return {
    currency: isCurrency(v.currency) ? v.currency : 'INR',
    theme: oneOf(v.theme, ['dark', 'light', 'system'] as const) ?? 'dark',
    name: typeof v.name === 'string' ? v.name.slice(0, 40) : DEFAULT_SETTINGS.name,
    lastAccountId: nullableStr(v.lastAccountId),
  };
}

export function validList<T>(v: unknown, fn: (x: unknown) => T | null): T[] | null {
  if (!Array.isArray(v)) return null;
  const out: T[] = [];
  const seen = new Set<string>();
  for (const item of v) {
    const ok = fn(item);
    if (!ok) continue;
    const id = (ok as { id?: unknown }).id;
    if (typeof id === 'string') {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    out.push(ok);
  }
  return out;
}

export function validBackup(v: unknown): Backup | null {
  if (!isObj(v) || v.app !== 'kosh') return null;
  const categories = validList(v.categories, validCategory);
  const accounts = validList(v.accounts, validAccount);
  const transactions = validList(v.transactions, validTransaction);
  if (!categories || !accounts || !transactions) return null;
  const data: DataState = {
    categories, accounts, transactions,
    budgets: validList(v.budgets, validBudget) ?? [],
    recurring: validList(v.recurring, validRecurring) ?? [],
    goals: validList(v.goals, validGoal) ?? [],
  };
  return { app: 'kosh', version: 1, exportedAt: str(v.exportedAt), settings: validSettings(v.settings), ...data };
}
