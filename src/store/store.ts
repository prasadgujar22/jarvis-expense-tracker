import { create } from 'zustand';
import { useMemo } from 'react';
import type { Account, Backup, Budget, Category, DataState, Goal, GoalContribution, RecurringRule, Settings, Transaction } from './types';
import { DEFAULT_SETTINGS } from './validate';
import { markExplicitRestores } from '../sync/explicit';
import { generateDue, occurrenceTxId, txFromRule } from './engine';
import { todayISO, toISODate, type ISODate } from '../lib/dates';
import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';
import { uid } from '../lib/id';
import { nextOccurrence, occurrencesBetween } from '../lib/recurring';
import { DEFAULT_CATEGORIES, FALLBACK_EXPENSE_CATEGORY, FALLBACK_INCOME_CATEGORY } from '../data/categories';

export type NewTransaction = Omit<Transaction, 'id' | 'createdAt'>;

export interface Store extends DataState {
  settings: Settings;
  addTransaction(t: NewTransaction): Transaction;
  updateTransaction(id: string, patch: Partial<NewTransaction>): void;
  deleteTransaction(id: string): Transaction | undefined;
  restoreTransaction(t: Transaction): void;
  importTransactions(list: NewTransaction[]): number;

  saveAccount(a: Omit<Account, 'id'> & { id?: string }): Account;
  setAccountArchived(id: string, archived: boolean): void;

  saveCategory(c: Omit<Category, 'id'> & { id?: string }): Category;
  deleteCategory(id: string): void;

  setBudget(categoryId: string | null, amount: number | null): void;

  saveRecurring(r: Omit<RecurringRule, 'id' | 'postedThrough'> & { id?: string; postedThrough?: ISODate | null }): RecurringRule;
  deleteRecurring(id: string): void;
  markRecurringPaid(id: string): Transaction | null;
  skipRecurring(id: string): void;

  saveGoal(g: Omit<Goal, 'id' | 'contributions' | 'createdAt'> & { id?: string }): Goal;
  deleteGoal(id: string): void;
  addContribution(goalId: string, c: Omit<GoalContribution, 'id'>): void;
  removeContribution(goalId: string, contributionId: string): void;

  updateSettings(patch: Partial<Settings>): void;
  /** Auto-post recurring occurrences that fell due (idempotent: deterministic ids + postedThrough). */
  runDue(): void;
  /** First-run setup: default categories (if none), the first account and profile settings. */
  completeOnboarding(o: { name: string; currency: Settings['currency']; account: Omit<Account, 'id' | 'archived' | 'color'> & { color?: string } }): Account;
  /** Merge data from another source (legacy device data) into the account; items with the same id are replaced. */
  mergeData(data: DataState, settings?: Partial<Settings>): void;
  restoreBackup(b: Backup): void;
  exportBackup(): Backup;
}

export function emptyData(): DataState {
  return { categories: [], accounts: [], transactions: [], budgets: [], recurring: [], goals: [] };
}

function mergeById<T extends { id: string }>(base: T[], incoming: T[]): T[] {
  if (incoming.length === 0) return base;
  const byId = new Map(incoming.map((x) => [x.id, x]));
  const out = base.map((x) => byId.get(x.id) ?? x);
  const have = new Set(base.map((x) => x.id));
  for (const x of incoming) if (!have.has(x.id)) out.push(x);
  return out;
}

export const useStore = create<Store>()((set, get) => ({
  ...emptyData(),
  settings: { ...DEFAULT_SETTINGS },

  addTransaction(t) {
    const tx: Transaction = { ...t, id: uid('tx_'), createdAt: Date.now() };
    set((s) => ({ transactions: [...s.transactions, tx], settings: { ...s.settings, lastAccountId: t.accountId } }));
    return tx;
  },
  updateTransaction(id, patch) {
    set((s) => ({ transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  },
  deleteTransaction(id) {
    const tx = get().transactions.find((t) => t.id === id);
    if (tx) set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }));
    return tx;
  },
  restoreTransaction(tx) {
    set((s) => (s.transactions.some((t) => t.id === tx.id) ? s : { transactions: [...s.transactions, tx] }));
  },
  importTransactions(list) {
    const now = Date.now();
    const txs = list.map((t, i) => ({ ...t, id: uid('imp_'), createdAt: now + i }));
    set((s) => ({ transactions: [...s.transactions, ...txs] }));
    return txs.length;
  },

  saveAccount(a) {
    const acc: Account = { ...a, id: a.id ?? uid('acc_') };
    set((s) => ({
      accounts: s.accounts.some((x) => x.id === acc.id) ? s.accounts.map((x) => (x.id === acc.id ? acc : x)) : [...s.accounts, acc],
    }));
    return acc;
  },
  setAccountArchived(id, archived) {
    set((s) => ({ accounts: s.accounts.map((a) => (a.id === id ? { ...a, archived } : a)) }));
  },

  saveCategory(c) {
    const cat: Category = { ...c, id: c.id ?? uid('cat_') };
    set((s) => ({
      categories: s.categories.some((x) => x.id === cat.id) ? s.categories.map((x) => (x.id === cat.id ? cat : x)) : [...s.categories, cat],
    }));
    return cat;
  },
  deleteCategory(id) {
    const cat = get().categories.find((c) => c.id === id);
    if (!cat || id === FALLBACK_EXPENSE_CATEGORY || id === FALLBACK_INCOME_CATEGORY) return;
    const fb = cat.kind === 'income' ? FALLBACK_INCOME_CATEGORY : FALLBACK_EXPENSE_CATEGORY;
    set((s) => ({
      categories: s.categories.filter((c) => c.id !== id),
      transactions: s.transactions.map((t) => (t.categoryId === id ? { ...t, categoryId: fb } : t)),
      recurring: s.recurring.map((r) => (r.categoryId === id ? { ...r, categoryId: fb } : r)),
      budgets: s.budgets.filter((b) => b.categoryId !== id),
    }));
  },

  setBudget(categoryId, amount) {
    set((s) => {
      const rest = s.budgets.filter((b) => b.categoryId !== categoryId);
      if (amount === null || amount <= 0) return { budgets: rest };
      const existing = s.budgets.find((b) => b.categoryId === categoryId);
      const b: Budget = { id: existing?.id ?? uid('bud_'), categoryId, amount };
      return { budgets: [...rest, b] };
    });
  },

  saveRecurring(r) {
    const prev = r.id ? get().recurring.find((x) => x.id === r.id) : undefined;
    let postedThrough: ISODate | null;
    if (r.postedThrough !== undefined) postedThrough = r.postedThrough;
    else if (!prev) postedThrough = null;
    else {
      // Editing never re-posts history: occurrences up to the previous postedThrough stay settled even if the
      // start date moves (new occurrence dates would otherwise get new ids and slip past the duplicate check).
      postedThrough = prev.postedThrough;
      // If the schedule moved (start date / frequency / interval), a new-schedule date that falls in a period
      // already paid under the old schedule must not be posted again (e.g. paid on the 8th, moved to the 9th).
      const scheduleChanged = prev.startDate !== r.startDate || prev.frequency !== r.frequency || prev.interval !== r.interval;
      if (scheduleChanged && prev.postedThrough) {
        const prevNext = nextOccurrence(prev, prev.postedThrough);
        if (prevNext) {
          const gap = differenceInCalendarDays(parseISO(prevNext), parseISO(prev.postedThrough));
          const midpoint = toISODate(addDays(parseISO(prev.postedThrough), Math.floor(gap / 2)));
          const covered = occurrencesBetween(r, prev.postedThrough, midpoint, 50);
          if (covered.length > 0) postedThrough = covered[covered.length - 1];
        }
      }
      // Resuming a paused rule starts fresh from today: payments that fell due while paused are not back-posted.
      if (!prev.active && r.active) {
        const yesterday = toISODate(addDays(new Date(), -1));
        if (postedThrough === null || postedThrough < yesterday) postedThrough = yesterday;
      }
    }
    const rule: RecurringRule = { ...r, id: r.id ?? uid('rec_'), postedThrough };
    set((s) => {
      const recurring = s.recurring.some((x) => x.id === rule.id) ? s.recurring.map((x) => (x.id === rule.id ? rule : x)) : [...s.recurring, rule];
      return generateDue({ ...s, recurring }, todayISO());
    });
    return rule;
  },
  deleteRecurring(id) {
    set((s) => ({ recurring: s.recurring.filter((r) => r.id !== id) }));
  },
  markRecurringPaid(id) {
    const rule = get().recurring.find((r) => r.id === id);
    if (!rule) return null;
    const due = nextOccurrence(rule, rule.postedThrough);
    if (!due) return null;
    const existingId = occurrenceTxId(rule.id, due);
    const tx = { ...txFromRule(rule, due), createdAt: Date.now() };
    set((s) => ({
      recurring: s.recurring.map((r) => (r.id === id ? { ...r, postedThrough: due } : r)),
      transactions: s.transactions.some((t) => t.id === existingId) ? s.transactions : [...s.transactions, tx],
    }));
    return tx;
  },
  skipRecurring(id) {
    const rule = get().recurring.find((r) => r.id === id);
    if (!rule) return;
    const due = nextOccurrence(rule, rule.postedThrough);
    if (!due) return;
    set((s) => ({ recurring: s.recurring.map((r) => (r.id === id ? { ...r, postedThrough: due } : r)) }));
  },

  saveGoal(g) {
    const prev = g.id ? get().goals.find((x) => x.id === g.id) : undefined;
    const goal: Goal = { ...g, id: g.id ?? uid('goal_'), contributions: prev?.contributions ?? [], createdAt: prev?.createdAt ?? Date.now() };
    set((s) => ({ goals: prev ? s.goals.map((x) => (x.id === goal.id ? goal : x)) : [...s.goals, goal] }));
    return goal;
  },
  deleteGoal(id) {
    set((s) => ({ goals: s.goals.filter((g) => g.id !== id) }));
  },
  addContribution(goalId, c) {
    set((s) => ({ goals: s.goals.map((g) => (g.id === goalId ? { ...g, contributions: [...g.contributions, { ...c, id: uid('gc_') }] } : g)) }));
  },
  removeContribution(goalId, cid) {
    set((s) => ({ goals: s.goals.map((g) => (g.id === goalId ? { ...g, contributions: g.contributions.filter((c) => c.id !== cid) } : g)) }));
  },

  updateSettings(patch) {
    set((s) => ({ settings: { ...s.settings, ...patch } }));
  },
  runDue() {
    set((s) => {
      const next = generateDue(s, todayISO());
      return next === s ? s : { recurring: next.recurring, transactions: next.transactions };
    });
  },
  completeOnboarding({ name, currency, account }) {
    const acc: Account = { id: uid('acc_'), name: account.name, type: account.type, openingBalance: account.openingBalance, color: account.color ?? '#10b981', archived: false };
    set((s) => ({
      categories: s.categories.length > 0 ? s.categories : DEFAULT_CATEGORIES.map((c) => ({ ...c })),
      accounts: [...s.accounts, acc],
      settings: { ...s.settings, name: name.trim().slice(0, 40), currency, lastAccountId: acc.id, onboarded: true },
    }));
    return acc;
  },
  mergeData(data, settings) {
    // Imported occurrences are the user's own records, not auto-posts: upload them even if once deleted.
    const have = new Set(get().transactions.map((t) => t.id));
    markExplicitRestores(data.transactions.map((t) => t.id).filter((id) => !have.has(id)));
    set((s) => {
      const merged: DataState = {
        categories: mergeById(s.categories, data.categories),
        accounts: mergeById(s.accounts, data.accounts),
        transactions: mergeById(s.transactions, data.transactions),
        budgets: mergeById(s.budgets, data.budgets),
        recurring: mergeById(s.recurring, data.recurring),
        goals: mergeById(s.goals, data.goals),
      };
      if (merged.categories.length === 0) merged.categories = DEFAULT_CATEGORIES.map((c) => ({ ...c }));
      return { ...generateDue(merged, todayISO()), settings: { ...s.settings, ...settings } };
    });
  },
  restoreBackup(b) {
    // "Restore replaces all data": occurrences in the backup must come back even if they were deleted (tombstoned).
    const have = new Set(get().transactions.map((t) => t.id));
    markExplicitRestores(b.transactions.map((t) => t.id).filter((id) => !have.has(id)));
    set(() => ({
      ...generateDue({ categories: b.categories, accounts: b.accounts, transactions: b.transactions, budgets: b.budgets, recurring: b.recurring, goals: b.goals }, todayISO()),
      settings: { ...b.settings, onboarded: true },
    }));
  },
  exportBackup() {
    const s = get();
    return {
      app: 'kosh', version: 1, exportedAt: new Date().toISOString(), settings: s.settings,
      categories: s.categories, accounts: s.accounts, transactions: s.transactions, budgets: s.budgets, recurring: s.recurring, goals: s.goals,
    };
  },
}));

// ---- Convenience hooks ----
export const useCurrency = () => useStore((s) => s.settings.currency);
export function useCategoryMap(): Map<string, Category> {
  const cats = useStore((s) => s.categories);
  return useMemoMap(cats);
}
export function useAccountMap(): Map<string, Account> {
  const accs = useStore((s) => s.accounts);
  return useMemoMap(accs);
}

function useMemoMap<T extends { id: string }>(list: T[]): Map<string, T> {
  return useMemo(() => new Map(list.map((x) => [x.id, x])), [list]);
}
