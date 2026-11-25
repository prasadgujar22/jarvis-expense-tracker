import { useMemo, useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { PieChart, Plus, Pencil, CalendarDays } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { MonthSwitcher } from '../../components/ui/MonthSwitcher';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Field, Input, Select, useFieldId } from '../../components/ui/Field';
import { EmptyState } from '../../components/ui/EmptyState';
import { ProgressBar, ProgressRing, stateColor } from '../../components/ui/Progress';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { useFormatMoney } from '../../components/ui/Money';
import { useCategoryMap, useStore } from '../../store/store';
import { useUI } from '../../store/ui';
import { budgetStatus, type BudgetStatus } from '../../lib/analytics';
import { currentMonth, monthLabel, daysInMonth } from '../../lib/dates';
import { parseAmount, paiseToInput } from '../../lib/money';
import { cn } from '../../lib/cn';

const STATE_LABEL = { ok: 'On track', warning: 'Nearing limit', over: 'Over budget' } as const;

export default function BudgetsPage() {
  const [month, setMonth] = useState(currentMonth());
  const budgets = useStore((s) => s.budgets);
  const txs = useStore((s) => s.transactions);
  const cats = useCategoryMap();
  const fmt = useFormatMoney();
  const [editing, setEditing] = useState<{ categoryId: string | null; amount: number } | null>(null);
  const [open, setOpen] = useState(false);

  const status = useMemo(() => budgetStatus(budgets, txs, cats, month), [budgets, txs, cats, month]);
  const overall = status.find((s) => s.budget.categoryId === null);
  const perCat = status.filter((s) => s.budget.categoryId !== null);
  const isCurrent = month === currentMonth();
  const elapsedPct = isCurrent ? (new Date().getDate() / daysInMonth(month)) * 100 : month < currentMonth() ? 100 : 0;

  const openEditor = (b?: BudgetStatus) => {
    setEditing(b ? { categoryId: b.budget.categoryId, amount: b.budget.amount } : null);
    setOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Budgets"
        subtitle="Monthly limits that reset on the 1st"
        actions={
          <>
            <MonthSwitcher value={month} onChange={setMonth} allowFuture />
            <Button variant="primary" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => openEditor()} data-testid="add-budget">
              New budget
            </Button>
          </>
        }
      />

      {status.length === 0 ? (
        <Card>
          <EmptyState icon={PieChart} title="No budgets yet" description="Set an overall monthly limit or per-category budgets. We'll warn you at 80%." action={<Button variant="primary" onClick={() => openEditor()}>Create your first budget</Button>} />
        </Card>
      ) : (
        <div className="space-y-6">
          {overall && (
            <Card className="relative overflow-hidden p-5 sm:p-6" data-testid="budget-card" data-budget="overall" data-state={overall.state}>
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <ProgressRing value={overall.pct} size={120} stroke={11} color={stateColor[overall.state]} label="Overall budget used" valueText={fmt(overall.spent, { decimals: 0 }) + ' of ' + fmt(overall.budget.amount, { decimals: 0 }) + ' (' + Math.round(overall.pct) + '%)' + (overall.remaining < 0 ? ', over by ' + fmt(-overall.remaining, { decimals: 0 }) : '')}>
                  <div className="text-center">
                    <div className="text-xl font-semibold tnum">{Math.round(overall.pct)}%</div>
                    <div className="text-[11px] text-muted">used</div>
                  </div>
                </ProgressRing>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">Overall budget</h2>
                    <StateBadge s={overall} />
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    <span className="font-medium text-fg tnum">{fmt(overall.spent, { decimals: 0 })}</span> spent of {fmt(overall.budget.amount, { decimals: 0 })} in {monthLabel(month)}
                  </p>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <Stat label={overall.remaining >= 0 ? 'Left' : 'Over by'} value={fmt(Math.abs(overall.remaining), { decimals: 0 })} danger={overall.remaining < 0} />
                    <Stat label="Days left" value={String(overall.daysLeft)} />
                    <Stat label="Safe / day" value={overall.daysLeft > 0 ? fmt(overall.safePerDay, { decimals: 0 }) : '—'} testId="safe-per-day" />
                  </div>
                </div>
                <Button variant="ghost" size="icon" aria-label="Edit overall budget" onClick={() => openEditor(overall)} className="absolute top-3 right-3">
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          )}

          {perCat.length > 0 && (
            <section aria-label="Category budgets" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {perCat.map((b, i) => (
                <motion.div key={b.budget.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <Card className="group p-5" data-testid="budget-card" data-budget={b.budget.categoryId ?? ''} data-state={b.state}>
                    <div className="flex items-center gap-3">
                      <CategoryIcon category={b.category} />
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-semibold">{b.category?.name}</h3>
                        <StateBadge s={b} />
                      </div>
                      <Button variant="ghost" size="icon-sm" aria-label={'Edit ' + (b.category?.name ?? '') + ' budget'} onClick={() => openEditor(b)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-4 flex items-baseline justify-between text-sm">
                      <span className="font-semibold tnum">{fmt(b.spent, { decimals: 0 })}</span>
                      <span className="text-muted tnum">of {fmt(b.budget.amount, { decimals: 0 })}</span>
                    </div>
                    <div className="relative mt-2">
                      <ProgressBar value={b.pct} color={stateColor[b.state]} label={(b.category?.name ?? '') + ' budget used'} valueText={fmt(b.spent, { decimals: 0 }) + ' of ' + fmt(b.budget.amount, { decimals: 0 }) + ' (' + Math.round(b.pct) + '%)' + (b.remaining < 0 ? ', over by ' + fmt(-b.remaining, { decimals: 0 }) : '')} />
                      {isCurrent && <span aria-hidden title="Today" className="absolute -top-1 h-4 w-0.5 rounded bg-fg/40" style={{ left: elapsedPct + '%' }} />}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted">
                      <span className={cn('tnum', b.remaining < 0 && 'font-medium text-danger')}>{b.remaining >= 0 ? fmt(b.remaining, { decimals: 0 }) + ' left' : fmt(-b.remaining, { decimals: 0 }) + ' over'}</span>
                      {b.daysLeft > 0 && (
                        <span className="inline-flex items-center gap-1 tnum">
                          <CalendarDays className="h-3 w-3" aria-hidden />
                          {b.remaining > 0 ? fmt(b.safePerDay, { decimals: 0 }) + '/day · ' : ''}
                          {b.daysLeft}d left
                        </span>
                      )}
                    </div>
                  </Card>
                </motion.div>
              ))}
            </section>
          )}
        </div>
      )}
      <BudgetEditor open={open} onClose={() => setOpen(false)} initial={editing} />
    </div>
  );
}

function Stat({ label, value, danger, testId }: { label: string; value: string; danger?: boolean; testId?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2">
      <div className="text-[11px] text-muted">{label}</div>
      <div className={cn('truncate text-sm font-semibold tnum', danger && 'text-danger')} data-testid={testId}>{value}</div>
    </div>
  );
}

function StateBadge({ s }: { s: BudgetStatus }) {
  const cls = { ok: 'bg-accent-soft text-accent', warning: 'bg-warning-soft text-warning', over: 'bg-danger-soft text-danger' }[s.state];
  return <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold', cls)}>{STATE_LABEL[s.state]}</span>;
}

function BudgetEditor({ open, onClose, initial }: { open: boolean; onClose: () => void; initial: { categoryId: string | null; amount: number } | null }) {
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit budget' : 'New budget'} size="sm" testId="budget-modal">
      <BudgetForm key={String(open) + (initial?.categoryId ?? 'x')} initial={initial} onClose={onClose} />
    </Modal>
  );
}

function BudgetForm({ initial, onClose }: { initial: { categoryId: string | null; amount: number } | null; onClose: () => void }) {
  const categories = useStore((s) => s.categories);
  const budgets = useStore((s) => s.budgets);
  const setBudget = useStore((s) => s.setBudget);
  const toast = useUI((s) => s.toast);
  const [cat, setCat] = useState<string>(initial ? initial.categoryId ?? '__overall' : '');
  const [amount, setAmount] = useState(initial ? paiseToInput(initial.amount) : '');
  const [err, setErr] = useState('');
  const idC = useFieldId('bc');
  const idA = useFieldId('ba');
  const used = new Set(budgets.map((b) => b.categoryId ?? '__overall'));
  const options = [{ id: '__overall', name: 'Overall (all spending)' }, ...categories.filter((c) => c.kind === 'expense')].filter((o) => !used.has(o.id) || o.id === (initial ? initial.categoryId ?? '__overall' : ''));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const p = parseAmount(amount);
    if (!cat) return setErr('Choose a category.');
    if (p === null || p <= 0) return setErr('Enter a monthly amount.');
    setBudget(cat === '__overall' ? null : cat, p);
    toast({ message: 'Budget saved', tone: 'success' });
    onClose();
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Category" htmlFor={idC}>
        <Select id={idC} value={cat} onChange={(e) => setCat(e.target.value)} disabled={!!initial} data-testid="budget-category">
          <option value="">Select…</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Monthly limit" htmlFor={idA}>
        <Input id={idA} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 8000" data-testid="budget-amount" data-autofocus />
      </Field>
      {err && <p role="alert" className="text-sm text-danger">{err}</p>}
      <div className="flex justify-between gap-2 pt-2">
        {initial ? (
          <Button variant="ghost" className="text-danger" onClick={() => { setBudget(initial.categoryId, null); toast({ message: 'Budget removed' }); onClose(); }}>
            Remove
          </Button>
        ) : <span />}
        <Button type="submit" variant="primary" data-testid="budget-submit">Save budget</Button>
      </div>
    </form>
  );
}
