import { subDays, format } from 'date-fns';
import type { Transaction, TxType } from '../../store/types';
import { currentMonth, monthEnd, monthStart, shiftMonth, toISODate, type ISODate } from '../../lib/dates';

export type DatePreset = 'all' | 'this-month' | 'last-month' | 'last-90' | 'custom';
export type SortKey = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

export interface TxFilters {
  q: string;
  preset: DatePreset;
  from: ISODate;
  to: ISODate;
  type: TxType | 'all';
  categories: string[];
  account: string;
  min: string;
  max: string;
  sort: SortKey;
}

export const DEFAULT_FILTERS: TxFilters = {
  q: '', preset: 'all', from: '', to: '', type: 'all', categories: [], account: '', min: '', max: '', sort: 'date-desc',
};

export function presetRange(p: DatePreset, from: ISODate, to: ISODate): [ISODate | null, ISODate | null] {
  const cm = currentMonth();
  switch (p) {
    case 'this-month':
      return [toISODate(monthStart(cm)), toISODate(monthEnd(cm))];
    case 'last-month': {
      const lm = shiftMonth(cm, -1);
      return [toISODate(monthStart(lm)), toISODate(monthEnd(lm))];
    }
    case 'last-90':
      return [format(subDays(new Date(), 89), 'yyyy-MM-dd'), toISODate(new Date())];
    case 'custom':
      return [from || null, to || null];
    default:
      return [null, null];
  }
}

export function applyFilters(txs: Transaction[], f: TxFilters, parse: (s: string) => number | null): Transaction[] {
  const [from, to] = presetRange(f.preset, f.from, f.to);
  const q = f.q.trim().toLowerCase();
  const min = f.min ? parse(f.min) : null;
  const max = f.max ? parse(f.max) : null;
  const cats = new Set(f.categories);
  const out = txs.filter((t) => {
    if (from && t.date < from) return false;
    if (to && t.date > to) return false;
    if (f.type !== 'all' && t.type !== f.type) return false;
    if (cats.size > 0 && (!t.categoryId || !cats.has(t.categoryId))) return false;
    if (f.account && t.accountId !== f.account && t.toAccountId !== f.account) return false;
    if (min !== null && t.amount < min) return false;
    if (max !== null && t.amount > max) return false;
    if (q) {
      const hay = (t.payee + ' ' + t.note + ' ' + t.tags.map((x) => '#' + x).join(' ')).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const cmp: Record<SortKey, (a: Transaction, b: Transaction) => number> = {
    'date-desc': (a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1),
    'date-asc': (a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1),
    'amount-desc': (a, b) => b.amount - a.amount,
    'amount-asc': (a, b) => a.amount - b.amount,
  };
  return out.sort(cmp[f.sort]);
}

export function countActive(f: TxFilters): number {
  let n = 0;
  if (f.preset !== 'all') n++;
  if (f.type !== 'all') n++;
  if (f.categories.length) n++;
  if (f.account) n++;
  if (f.min || f.max) n++;
  return n;
}
