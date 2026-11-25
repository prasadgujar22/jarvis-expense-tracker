import { getDay, parseISO, differenceInCalendarDays, addDays } from 'date-fns';
import type { Account, Budget, Category, RecurringRule, Transaction } from '../store/types';
import { monthKey, shiftMonth, daysInMonth, daysLeftInMonth, currentMonth, toISODate, type ISODate, type MonthKey } from './dates';
import type { Paise } from './money';
import { occurrencesBetween, monthlyEquivalent } from './recurring';

export function accountBalances(accounts: Account[], txs: Transaction[], upTo?: ISODate): Map<string, Paise> {
  const m = new Map<string, Paise>(accounts.map((a) => [a.id, a.openingBalance]));
  for (const t of txs) {
    if (upTo && t.date > upTo) continue;
    if (t.type === 'income') m.set(t.accountId, (m.get(t.accountId) ?? 0) + t.amount);
    else if (t.type === 'expense') m.set(t.accountId, (m.get(t.accountId) ?? 0) - t.amount);
    else {
      m.set(t.accountId, (m.get(t.accountId) ?? 0) - t.amount);
      if (t.toAccountId) m.set(t.toAccountId, (m.get(t.toAccountId) ?? 0) + t.amount);
    }
  }
  return m;
}

export function netWorth(accounts: Account[], txs: Transaction[], upTo?: ISODate): Paise {
  const b = accountBalances(accounts, txs, upTo);
  let total = 0;
  for (const a of accounts) total += b.get(a.id) ?? 0;
  return total;
}

export function txInMonth(txs: Transaction[], m: MonthKey): Transaction[] {
  return txs.filter((t) => t.date.startsWith(m));
}

export interface MonthTotals {
  income: Paise;
  expense: Paise;
  net: Paise;
  savingsRate: number; // 0-100, can be negative
}
export function monthTotals(txs: Transaction[], m: MonthKey): MonthTotals {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (!t.date.startsWith(m)) continue;
    if (t.type === 'income') income += t.amount;
    else if (t.type === 'expense') expense += t.amount;
  }
  const net = income - expense;
  return { income, expense, net, savingsRate: income > 0 ? (net / income) * 100 : 0 };
}

export interface CategorySpend {
  category: Category;
  amount: Paise;
  count: number;
}
export function spendByCategory(txs: Transaction[], cats: Map<string, Category>, m: MonthKey | null, kind: 'expense' | 'income' = 'expense'): CategorySpend[] {
  const acc = new Map<string, CategorySpend>();
  for (const t of txs) {
    if (t.type !== kind || !t.categoryId) continue;
    if (m && !t.date.startsWith(m)) continue;
    const c = cats.get(t.categoryId);
    if (!c) continue;
    const e = acc.get(c.id) ?? { category: c, amount: 0, count: 0 };
    e.amount += t.amount;
    e.count++;
    acc.set(c.id, e);
  }
  return [...acc.values()].sort((a, b) => b.amount - a.amount);
}

export function lastNMonths(n: number, end: MonthKey = currentMonth()): MonthKey[] {
  const out: MonthKey[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(shiftMonth(end, -i));
  return out;
}

export function dailySpend(txs: Transaction[], m: MonthKey): { day: number; date: ISODate; amount: Paise; cumulative: Paise }[] {
  const days = daysInMonth(m);
  const arr = Array.from({ length: days }, (_, i) => ({ day: i + 1, date: m + '-' + String(i + 1).padStart(2, '0'), amount: 0, cumulative: 0 }));
  for (const t of txs) {
    if (t.type !== 'expense' || !t.date.startsWith(m)) continue;
    const d = Number(t.date.slice(8, 10));
    arr[d - 1].amount += t.amount;
  }
  let c = 0;
  for (const a of arr) {
    c += a.amount;
    a.cumulative = c;
  }
  return arr;
}

export type BudgetState = 'ok' | 'warning' | 'over';
export interface BudgetStatus {
  budget: Budget;
  category: Category | null;
  spent: Paise;
  remaining: Paise;
  pct: number;
  state: BudgetState;
  daysLeft: number;
  safePerDay: Paise;
}
export function budgetStatus(budgets: Budget[], txs: Transaction[], cats: Map<string, Category>, m: MonthKey): BudgetStatus[] {
  const spentBy = new Map<string, Paise>();
  let total = 0;
  for (const t of txs) {
    if (t.type !== 'expense' || !t.date.startsWith(m)) continue;
    total += t.amount;
    if (t.categoryId) spentBy.set(t.categoryId, (spentBy.get(t.categoryId) ?? 0) + t.amount);
  }
  const daysLeft = daysLeftInMonth(m);
  return budgets
    .map((b) => {
      const spent = b.categoryId === null ? total : spentBy.get(b.categoryId) ?? 0;
      const pct = b.amount > 0 ? (spent / b.amount) * 100 : 0;
      const remaining = b.amount - spent;
      const state: BudgetState = pct > 100 ? 'over' : pct >= 80 ? 'warning' : 'ok';
      return {
        budget: b,
        category: b.categoryId ? cats.get(b.categoryId) ?? null : null,
        spent, remaining, pct, state, daysLeft,
        safePerDay: daysLeft > 0 && remaining > 0 ? Math.floor(remaining / daysLeft) : 0,
      };
    })
    .filter((s) => s.budget.categoryId === null || s.category !== null)
    .sort((a, b) => (a.budget.categoryId === null ? -1 : b.budget.categoryId === null ? 1 : b.pct - a.pct));
}

export interface Upcoming {
  rule: RecurringRule;
  date: ISODate;
  overdue: boolean;
}
/** Unpaid occurrences from (postedThrough, today+days]. Overdue = date < today. */
export function upcomingBills(rules: RecurringRule[], days = 30, today: ISODate = toISODate(new Date())): Upcoming[] {
  const until = toISODate(addDays(parseISO(today), days));
  const out: Upcoming[] = [];
  for (const r of rules) {
    if (!r.active) continue;
    const occ = occurrencesBetween(r, r.postedThrough, until, 400);
    // for auto-posting rules, only future dates are relevant
    for (const d of occ) {
      if (r.autoPost && d <= today) continue;
      out.push({ rule: r, date: d, overdue: d < today });
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function monthlySubscriptionCost(rules: RecurringRule[]): Paise {
  return rules.filter((r) => r.active && r.isSubscription && r.type === 'expense').reduce((s, r) => s + monthlyEquivalent(r.amount, r.frequency, r.interval), 0);
}

/** Average spend per weekday (0=Sun..6=Sat) over the given window. */
export function weekdayPattern(txs: Transaction[], from: ISODate, to: ISODate): { weekday: number; avg: Paise; total: Paise }[] {
  const totals = Array(7).fill(0) as number[];
  const counts = Array(7).fill(0) as number[];
  const start = parseISO(from);
  const n = differenceInCalendarDays(parseISO(to), start) + 1;
  for (let i = 0; i < n; i++) counts[getDay(addDays(start, i))]++;
  for (const t of txs) {
    if (t.type !== 'expense' || t.date < from || t.date > to) continue;
    totals[getDay(parseISO(t.date))] += t.amount;
  }
  return totals.map((total, weekday) => ({ weekday, total, avg: counts[weekday] ? Math.round(total / counts[weekday]) : 0 }));
}

/** Expense per day for heatmap: last `weeks` weeks ending today, Monday-first grid. */
export function heatmap(txs: Transaction[], weeks: number, today = new Date()): { date: ISODate; amount: Paise; future: boolean }[][] {
  const map = new Map<string, number>();
  for (const t of txs) if (t.type === 'expense') map.set(t.date, (map.get(t.date) ?? 0) + t.amount);
  const dow = (getDay(today) + 6) % 7; // Monday=0
  const gridStart = addDays(today, -dow - (weeks - 1) * 7);
  const todayStr = toISODate(today);
  const cols: { date: ISODate; amount: Paise; future: boolean }[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const date = toISODate(addDays(gridStart, w * 7 + d));
      col.push({ date, amount: map.get(date) ?? 0, future: date > todayStr });
    }
    cols.push(col);
  }
  return cols;
}

export function monthOf(t: Transaction): MonthKey {
  return monthKey(t.date);
}
