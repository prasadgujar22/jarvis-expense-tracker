import { useEffect, useMemo, useState, useDeferredValue } from 'react';
import { useSearch } from '../../router';
import { AnimatePresence, motion } from 'motion/react';
import { Download, Filter, Plus, Search, X, ArrowLeftRight, SearchX } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Field, Input, Select, useFieldId } from '../../components/ui/Field';
import { EmptyState } from '../../components/ui/EmptyState';
import { CategoryDot } from '../../components/ui/CategoryIcon';
import { useFormatMoney } from '../../components/ui/Money';
import { useAccountMap, useCategoryMap, useStore } from '../../store/store';
import { useUI } from '../../store/ui';
import { parseAmount } from '../../lib/money';
import { formatDay } from '../../lib/dates';
import { cn } from '../../lib/cn';
import { TransactionRow } from './TransactionRow';
import { applyFilters, countActive, DEFAULT_FILTERS, type DatePreset, type SortKey, type TxFilters } from './filters';
import { exportTransactionsCSV } from '../data/csvExport';
import type { Transaction } from '../../store/types';

const PAGE = 40;

export default function TransactionsPage() {
  const txs = useStore((s) => s.transactions);
  const categories = useStore((s) => s.categories);
  const accounts = useStore((s) => s.accounts);
  const cats = useCategoryMap();
  const accs = useAccountMap();
  const fmt = useFormatMoney();
  const openQuickAdd = useUI((s) => s.openQuickAdd);
  const toast = useUI((s) => s.toast);

  const [f, setF] = useState<TxFilters>(() => {
    const q = new URLSearchParams(window.location.search).get('q') ?? '';
    return { ...DEFAULT_FILTERS, q };
  });
  // Keep the search box in sync when the URL query changes while this page is mounted
  // (e.g. "Search all transactions" from the command palette).
  const search = useSearch();
  useEffect(() => {
    const q = new URLSearchParams(search).get('q');
    if (q !== null) setF((p) => (p.q === q ? p : { ...p, q }));
  }, [search]);
  const [showFilters, setShowFilters] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const deferred = useDeferredValue(f);
  const set = <K extends keyof TxFilters>(k: K, v: TxFilters[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setLimit(PAGE);
  };

  const filtered = useMemo(() => applyFilters(txs, deferred, parseAmount), [txs, deferred]);
  const byDate = deferred.sort.startsWith('date');
  const groups = useMemo(() => {
    const shown = filtered.slice(0, limit);
    if (!byDate) return [{ date: '', items: shown, total: 0 }];
    const out: { date: string; items: Transaction[]; total: number }[] = [];
    for (const t of shown) {
      let g = out[out.length - 1];
      if (!g || g.date !== t.date) {
        g = { date: t.date, items: [], total: 0 };
        out.push(g);
      }
      g.items.push(t);
      g.total += t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0;
    }
    return out;
  }, [filtered, limit, byDate]);

  const totals = useMemo(() => {
    let inc = 0;
    let exp = 0;
    for (const t of filtered) {
      if (t.type === 'income') inc += t.amount;
      else if (t.type === 'expense') exp += t.amount;
    }
    return { inc, exp };
  }, [filtered]);

  const active = countActive(f);
  const ids = {
    search: useFieldId('q'),
    preset: useFieldId('preset'),
    from: useFieldId('from'),
    to: useFieldId('to'),
    type: useFieldId('type'),
    account: useFieldId('acc'),
    min: useFieldId('min'),
    max: useFieldId('max'),
    sort: useFieldId('sort'),
  };
  const expenseCats = categories.filter((c) => (f.type === 'income' ? c.kind === 'income' : f.type === 'expense' ? c.kind === 'expense' : true));

  return (
    <div>
      <PageHeader
        title="Transactions"
        subtitle={filtered.length + ' transaction' + (filtered.length === 1 ? '' : 's') + (active || f.q ? ' match your filters' : '')}
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Download className="h-4 w-4" aria-hidden />}
              data-testid="export-csv"
              disabled={filtered.length === 0}
              onClick={() => {
                exportTransactionsCSV(filtered, cats, accs);
                toast({ message: 'Exported ' + filtered.length + ' transactions', tone: 'success' });
              }}
            >
              Export CSV
            </Button>
            <Button variant="primary" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => openQuickAdd()} className="max-lg:hidden">
              Add
            </Button>
          </>
        }
      />

      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <label htmlFor={ids.search} className="sr-only">
              Search transactions
            </label>
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
            <Input id={ids.search} value={f.q} onChange={(e) => set('q', e.target.value)} placeholder="Search payee, note or #tag" className="pl-9" data-testid="tx-search" type="search" />
          </div>
          <div className="flex gap-2">
            <Select aria-label="Date range" value={f.preset} onChange={(e) => set('preset', e.target.value as DatePreset)} data-testid="filter-preset" className="sm:w-40">
              <option value="all">All time</option>
              <option value="this-month">This month</option>
              <option value="last-month">Last month</option>
              <option value="last-90">Last 90 days</option>
              <option value="custom">Custom range</option>
            </Select>
            <Button variant={showFilters || active > 0 ? 'outline' : 'secondary'} icon={<Filter className="h-4 w-4" aria-hidden />} onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} aria-controls="tx-filters" data-testid="toggle-filters">
              Filters
              {active > 0 && <span className="ml-0.5 rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-fg tnum">{active}</span>}
            </Button>
          </div>
        </div>
        <AnimatePresence initial={false}>
          {(showFilters || f.preset === 'custom') && (
            <motion.div id="tx-filters" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="grid grid-cols-2 gap-3 pt-3 md:grid-cols-4">
                {f.preset === 'custom' && (
                  <>
                    <Field label="From" htmlFor={ids.from}>
                      <Input id={ids.from} type="date" value={f.from} onChange={(e) => set('from', e.target.value)} data-testid="filter-from" />
                    </Field>
                    <Field label="To" htmlFor={ids.to}>
                      <Input id={ids.to} type="date" value={f.to} onChange={(e) => set('to', e.target.value)} data-testid="filter-to" />
                    </Field>
                  </>
                )}
                {showFilters && (
                  <>
                    <Field label="Type" htmlFor={ids.type}>
                      <Select id={ids.type} value={f.type} onChange={(e) => set('type', e.target.value as TxFilters['type'])} data-testid="filter-type">
                        <option value="all">All types</option>
                        <option value="expense">Expenses</option>
                        <option value="income">Income</option>
                        <option value="transfer">Transfers</option>
                      </Select>
                    </Field>
                    <Field label="Account" htmlFor={ids.account}>
                      <Select id={ids.account} value={f.account} onChange={(e) => set('account', e.target.value)} data-testid="filter-account">
                        <option value="">All accounts</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Min amount" htmlFor={ids.min}>
                      <Input id={ids.min} inputMode="decimal" value={f.min} onChange={(e) => set('min', e.target.value)} placeholder="0" data-testid="filter-min" />
                    </Field>
                    <Field label="Max amount" htmlFor={ids.max}>
                      <Input id={ids.max} inputMode="decimal" value={f.max} onChange={(e) => set('max', e.target.value)} placeholder="Any" data-testid="filter-max" />
                    </Field>
                    <Field label="Sort by" htmlFor={ids.sort}>
                      <Select id={ids.sort} value={f.sort} onChange={(e) => set('sort', e.target.value as SortKey)} data-testid="filter-sort">
                        <option value="date-desc">Newest first</option>
                        <option value="date-asc">Oldest first</option>
                        <option value="amount-desc">Amount: high to low</option>
                        <option value="amount-asc">Amount: low to high</option>
                      </Select>
                    </Field>
                    <fieldset className="col-span-2 md:col-span-4">
                      <legend className="mb-1.5 text-xs font-medium text-muted">Categories</legend>
                      <div className="flex flex-wrap gap-1.5">
                        {expenseCats.map((c) => {
                          const on = f.categories.includes(c.id);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              aria-pressed={on}
                              onClick={() => set('categories', on ? f.categories.filter((x) => x !== c.id) : [...f.categories, c.id])}
                              className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors', on ? 'border-accent bg-accent-soft text-fg' : 'border-line text-muted hover:text-fg')}
                              data-testid={'filter-cat-' + c.id}
                            >
                              <CategoryDot color={c.color} className="!h-2 !w-2" />
                              {c.name}
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                    <div className="col-span-2 flex justify-end md:col-span-4">
                      <Button variant="ghost" size="sm" icon={<X className="h-3.5 w-3.5" aria-hidden />} onClick={() => setF({ ...DEFAULT_FILTERS, q: f.q })} data-testid="clear-filters">
                        Clear filters
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {filtered.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-3">
          {[
            { label: 'Income', v: totals.inc, cls: 'text-income' },
            { label: 'Expenses', v: totals.exp, cls: 'text-fg' },
            { label: 'Net', v: totals.inc - totals.exp, cls: totals.inc - totals.exp >= 0 ? 'text-income' : 'text-danger' },
          ].map((k) => (
            <div key={k.label} className="rounded-2xl border border-line bg-surface/60 px-4 py-3">
              <div className="text-xs text-muted">{k.label}</div>
              <div className={cn('mt-0.5 truncate text-sm font-semibold sm:text-base tnum', k.cls)}>{fmt(k.v, { decimals: 0 })}</div>
            </div>
          ))}
        </div>
      )}

      {txs.length === 0 ? (
        <Card>
          <EmptyState icon={ArrowLeftRight} title="No transactions yet" description="Add your first expense or income — press N anytime." action={<Button variant="primary" onClick={() => openQuickAdd()} icon={<Plus className="h-4 w-4" aria-hidden />}>Add transaction</Button>} />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState icon={SearchX} title="Nothing matches" description="Try a different search or clear some filters." action={<Button onClick={() => setF(DEFAULT_FILTERS)}>Reset filters</Button>} />
        </Card>
      ) : (
        <div className="space-y-4" data-testid="transaction-list">
          {groups.map((g) => (
            <Card key={g.date || 'all'} className="p-2">
              {g.date && (
                <div className="flex items-center justify-between px-3 pt-2 pb-1">
                  <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">{formatDay(g.date)}</h2>
                  <span className={cn('text-xs font-medium tnum', g.total >= 0 ? 'text-income' : 'text-muted')} data-testid="day-total">
                    {g.total > 0 ? '+' : g.total < 0 ? '−' : ''}
                    {fmt(Math.abs(g.total))}
                  </span>
                </div>
              )}
              <ul>
                <AnimatePresence initial={false}>
                  {g.items.map((t) => (
                    <TransactionRow key={t.id} tx={t} category={t.categoryId ? cats.get(t.categoryId) : null} account={accs.get(t.accountId)} toAccount={t.toAccountId ? accs.get(t.toAccountId) : undefined} showDate={!g.date} />
                  ))}
                </AnimatePresence>
              </ul>
            </Card>
          ))}
          {filtered.length > limit && (
            <div className="flex justify-center">
              <Button onClick={() => setLimit((l) => l + PAGE * 2)} data-testid="load-more">
                Show more ({filtered.length - limit} remaining)
              </Button>
            </div>
          )}
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {filtered.length} results
      </span>
    </div>
  );
}
