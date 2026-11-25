import type { Account, Budget, Category, DataState, Goal, RecurringRule, Settings, Transaction } from '../store/types';
import { validAccount, validBudget, validCategory, validGoal, validRecurring, validSettings, validTransaction } from '../store/validate';

/** Store slice → Supabase table. */
export const TABLES = {
  categories: 'categories',
  accounts: 'accounts',
  transactions: 'transactions',
  budgets: 'budgets',
  recurring: 'recurring_rules',
  goals: 'goals',
} as const;
export type SliceKey = keyof DataState;
export type DataTable = (typeof TABLES)[SliceKey];
export type Table = DataTable | 'settings';
export const SLICES = Object.keys(TABLES) as SliceKey[];
export const ALL_TABLES: Table[] = [...SLICES.map((s) => TABLES[s]), 'settings'];
export const SLICE_OF: Record<DataTable, SliceKey> = Object.fromEntries(SLICES.map((s) => [TABLES[s], s])) as Record<DataTable, SliceKey>;

export type Row = Record<string, unknown>;

const iso = (ms: number) => {
  const d = new Date(Number.isFinite(ms) ? ms : Date.now());
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};
const ms = (v: unknown): number | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = Date.parse(v);
  return Number.isNaN(t) ? undefined : t;
};

export function categoryToRow(c: Category): Row {
  return { id: c.id, name: c.name, kind: c.kind, icon: c.icon, color: c.color };
}
export function accountToRow(a: Account): Row {
  return { id: a.id, name: a.name, type: a.type, opening_balance: a.openingBalance, color: a.color, archived: a.archived };
}
export function transactionToRow(t: Transaction): Row {
  return {
    id: t.id, type: t.type, amount: t.amount, category_id: t.categoryId, account_id: t.accountId, to_account_id: t.toAccountId,
    date: t.date, payee: t.payee.slice(0, 200), note: t.note.slice(0, 2000), tags: t.tags, recurring_id: t.recurringId, created_at: iso(t.createdAt),
  };
}
export function budgetToRow(b: Budget): Row {
  return { id: b.id, category_id: b.categoryId, amount: b.amount };
}
export function recurringToRow(r: RecurringRule): Row {
  return {
    id: r.id, title: r.title.slice(0, 120), type: r.type, amount: r.amount, category_id: r.categoryId, account_id: r.accountId,
    frequency: r.frequency, interval: r.interval, start_date: r.startDate, end_date: r.endDate, auto_post: r.autoPost,
    is_subscription: r.isSubscription, posted_through: r.postedThrough, active: r.active,
  };
}
export function goalToRow(g: Goal): Row {
  return { id: g.id, name: g.name, target: g.target, target_date: g.targetDate, emoji: g.emoji, color: g.color, contributions: g.contributions, created_at: iso(g.createdAt) };
}
export function settingsToRow(s: Settings): Row {
  return { currency: s.currency, theme: s.theme, name: s.name.slice(0, 80), last_account_id: s.lastAccountId, onboarded: s.onboarded };
}

export function categoryFromRow(r: Row) {
  return validCategory(r);
}
export function accountFromRow(r: Row) {
  return validAccount({ ...r, openingBalance: Number(r.opening_balance) });
}
export function transactionFromRow(r: Row) {
  return validTransaction({
    ...r, amount: Number(r.amount), categoryId: r.category_id, accountId: r.account_id, toAccountId: r.to_account_id,
    recurringId: r.recurring_id, createdAt: ms(r.created_at),
  });
}
export function budgetFromRow(r: Row) {
  return validBudget({ ...r, amount: Number(r.amount), categoryId: r.category_id });
}
export function recurringFromRow(r: Row) {
  return validRecurring({
    ...r, amount: Number(r.amount), categoryId: r.category_id, accountId: r.account_id, startDate: r.start_date, endDate: r.end_date,
    autoPost: r.auto_post, isSubscription: r.is_subscription, postedThrough: r.posted_through,
  });
}
export function goalFromRow(r: Row) {
  return validGoal({ ...r, target: Number(r.target), targetDate: r.target_date, createdAt: ms(r.created_at) });
}
export function settingsFromRow(r: Row | null | undefined): Settings {
  if (!r) return validSettings(undefined);
  return validSettings({ ...r, lastAccountId: r.last_account_id });
}

type AnyItem = DataState[SliceKey][number];
export const TO_ROW: Record<SliceKey, (x: never) => Row> = {
  categories: categoryToRow, accounts: accountToRow, transactions: transactionToRow, budgets: budgetToRow, recurring: recurringToRow, goals: goalToRow,
};
export const FROM_ROW: Record<SliceKey, (r: Row) => AnyItem | null> = {
  categories: categoryFromRow, accounts: accountFromRow, transactions: transactionFromRow, budgets: budgetFromRow, recurring: recurringFromRow, goals: goalFromRow,
};
export function toRow(slice: SliceKey, item: AnyItem): Row {
  return (TO_ROW[slice] as (x: AnyItem) => Row)(item);
}
