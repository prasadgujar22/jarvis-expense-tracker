import { useMemo, useState, type FormEvent } from 'react';
import { navigate } from '../../router';
import { AnimatePresence, motion } from 'motion/react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { CalendarClock, Check, Pencil, Plus, Repeat, SkipForward, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button, IconButton } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Field, Input, Select, Toggle, useFieldId } from '../../components/ui/Field';
import { Segmented } from '../../components/ui/Segmented';
import { EmptyState } from '../../components/ui/EmptyState';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { useFormatMoney } from '../../components/ui/Money';
import { useCategoryMap, useStore } from '../../store/store';
import { useUI } from '../../store/ui';
import type { RecurringRule } from '../../store/types';
import { upcomingBills, monthlySubscriptionCost } from '../../lib/analytics';
import { FREQUENCIES, frequencyLabel, monthlyEquivalent, nextOccurrence, type Frequency } from '../../lib/recurring';
import { parseAmount, paiseToInput } from '../../lib/money';
import { todayISO } from '../../lib/dates';
import { cn } from '../../lib/cn';

export default function RecurringPage() {
  const rules = useStore((s) => s.recurring);
  const cats = useCategoryMap();
  const accounts = useStore((s) => s.accounts);
  const markPaid = useStore((s) => s.markRecurringPaid);
  const skip = useStore((s) => s.skipRecurring);
  const del = useStore((s) => s.deleteRecurring);
  const toast = useUI((s) => s.toast);
  const fmt = useFormatMoney();
  const [editing, setEditing] = useState<RecurringRule | null>(null);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<RecurringRule | null>(null);

  const upcoming = useMemo(() => upcomingBills(rules, 30), [rules]);
  const subCost = monthlySubscriptionCost(rules);
  const monthlyOut = rules.filter((r) => r.active && r.type === 'expense').reduce((s, r) => s + monthlyEquivalent(r.amount, r.frequency, r.interval), 0);
  const upcomingTotal = upcoming.filter((u) => u.rule.type === 'expense').reduce((s, u) => s + u.rule.amount, 0);
  const subs = rules.filter((r) => r.isSubscription);
  const others = rules.filter((r) => !r.isSubscription);

  const edit = (r: RecurringRule | null) => {
    setEditing(r);
    setOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Recurring & subscriptions"
        subtitle="Bills, subscriptions and salary that repeat"
        actions={<Button variant="primary" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => edit(null)} disabled={accounts.length === 0} data-testid="add-recurring">New recurring</Button>}
      />
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-5" data-testid="subscription-total">
          <div className="text-sm text-muted">Subscriptions / month</div>
          <div className="mt-1 text-2xl font-semibold tnum">{fmt(subCost)}</div>
          <div className="mt-1 text-xs text-subtle">{subs.filter((s) => s.active).length} active · {fmt(subCost * 12, { decimals: 0 })} / year</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-muted">All recurring outflow / month</div>
          <div className="mt-1 text-2xl font-semibold tnum">{fmt(monthlyOut, { decimals: 0 })}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-muted">Due in next 30 days</div>
          <div className="mt-1 text-2xl font-semibold tnum">{fmt(upcomingTotal, { decimals: 0 })}</div>
          <div className="mt-1 text-xs text-subtle">{upcoming.length} payments</div>
        </Card>
      </div>

      {rules.length === 0 ? (
        <Card>
          <EmptyState icon={Repeat} title="Nothing recurring yet" description="Add rent, salary, Netflix and other repeating payments. Kosh posts them automatically or reminds you." action={accounts.length > 0 ? <Button variant="primary" onClick={() => edit(null)}>Add recurring</Button> : <Button variant="primary" onClick={() => navigate('/accounts')} data-testid="recurring-add-account">Add an account first</Button>} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-2" aria-labelledby="upc-h">
            <CardHeader id="upc-h" title="Upcoming in next 30 days" />
            <ul className="p-3" data-testid="upcoming-30">
              {upcoming.length === 0 && <EmptyState compact icon={CalendarClock} title="Nothing due" />}
              <AnimatePresence initial={false}>
                {upcoming.map((u) => {
                  const days = differenceInCalendarDays(parseISO(u.date), new Date());
                  const isNext = nextOccurrence(u.rule, u.rule.postedThrough) === u.date;
                  return (
                    <motion.li key={u.rule.id + u.date} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-3 rounded-xl px-2 py-2.5" data-testid="upcoming-item">
                      <div className={cn('flex w-11 shrink-0 flex-col items-center rounded-xl border py-1', u.overdue ? 'border-danger/40 text-danger' : 'border-line')}>
                        <span className="text-[10px] font-semibold uppercase">{format(parseISO(u.date), 'MMM')}</span>
                        <span className="text-base leading-none font-semibold tnum">{format(parseISO(u.date), 'd')}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{u.rule.title}</div>
                        <div className={cn('text-xs', u.overdue ? 'text-danger' : 'text-subtle')}>
                          {u.overdue ? 'Overdue' : days === 0 ? 'Today' : 'In ' + days + ' day' + (days === 1 ? '' : 's')} · {u.rule.autoPost ? 'Auto-posts' : 'Manual'}
                        </div>
                      </div>
                      <span className={cn('text-sm font-semibold tnum', u.rule.type === 'income' && 'text-income')}>{fmt(u.rule.amount, { decimals: 0 })}</span>
                      {!u.rule.autoPost && isNext && (
                        <div className="flex gap-1">
                          <IconButton label={'Mark ' + u.rule.title + ' as paid'} size="icon-sm" variant="outline" data-testid="mark-paid" onClick={() => { markPaid(u.rule.id); toast({ message: u.rule.title + ' recorded', tone: 'success' }); }}>
                            <Check className="h-4 w-4" />
                          </IconButton>
                          <IconButton label={'Skip this ' + u.rule.title} size="icon-sm" onClick={() => { skip(u.rule.id); toast({ message: 'Skipped ' + u.rule.title }); }}>
                            <SkipForward className="h-4 w-4" />
                          </IconButton>
                        </div>
                      )}
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </Card>
          <div className="space-y-4 lg:col-span-3">
            {[{ title: 'Subscriptions', list: subs }, { title: 'Bills, income & other', list: others }].map((grp) =>
              grp.list.length === 0 ? null : (
                <Card key={grp.title} aria-label={grp.title}>
                  <CardHeader title={grp.title} />
                  <ul className="p-3">
                    {grp.list.map((r) => {
                      const next = nextOccurrence(r, r.postedThrough);
                      return (
                        <li key={r.id} className={cn('flex items-center gap-3 rounded-xl px-2 py-2.5', !r.active && 'opacity-60')} data-testid="recurring-rule">
                          <CategoryIcon category={cats.get(r.categoryId)} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{r.title}</div>
                            <div className="truncate text-xs text-subtle">
                              {frequencyLabel(r.frequency, r.interval)} · {r.active ? (next ? 'next ' + format(parseISO(next), 'd MMM') : 'ended') : 'paused'}
                            </div>
                          </div>
                          <span className={cn('text-sm font-semibold tnum', r.type === 'income' && 'text-income')}>{fmt(r.amount)}</span>
                          <IconButton label={'Edit ' + r.title} size="icon-sm" onClick={() => edit(r)}>
                            <Pencil className="h-4 w-4" />
                          </IconButton>
                          <IconButton label={'Delete ' + r.title} size="icon-sm" onClick={() => setConfirm(r)}>
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              ),
            )}
          </div>
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit recurring' : 'New recurring'} testId="recurring-modal">
        <RecurringForm key={(editing?.id ?? 'new') + String(open)} rule={editing} onClose={() => setOpen(false)} />
      </Modal>
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Delete recurring rule?"
        description={'"' + (confirm?.title ?? '') + '" will stop repeating. Transactions already recorded are kept.'}
        confirmLabel="Delete"
        onConfirm={() => { if (confirm) { del(confirm.id); toast({ message: 'Recurring rule deleted' }); } }}
      />
    </div>
  );
}

function RecurringForm({ rule, onClose }: { rule: RecurringRule | null; onClose: () => void }) {
  const categories = useStore((s) => s.categories);
  const allAccounts = useStore((s) => s.accounts);
  const accounts = allAccounts.filter((a) => !a.archived);
  const save = useStore((s) => s.saveRecurring);
  const toast = useUI((s) => s.toast);
  const [type, setType] = useState<'expense' | 'income'>(rule?.type ?? 'expense');
  const [title, setTitle] = useState(rule?.title ?? '');
  const [amount, setAmount] = useState(rule ? paiseToInput(rule.amount) : '');
  const [categoryId, setCategoryId] = useState(rule?.categoryId ?? '');
  const [accountId, setAccountId] = useState(rule?.accountId ?? accounts[0]?.id ?? '');
  const [frequency, setFrequency] = useState<Frequency>(rule?.frequency ?? 'monthly');
  const [interval, setInterval] = useState(String(rule?.interval ?? 1));
  const [startDate, setStartDate] = useState(rule?.startDate ?? todayISO());
  const [endDate, setEndDate] = useState(rule?.endDate ?? '');
  const [autoPost, setAutoPost] = useState(rule?.autoPost ?? true);
  const [isSub, setIsSub] = useState(rule?.isSubscription ?? false);
  const [active, setActive] = useState(rule?.active ?? true);
  const [err, setErr] = useState('');
  const ids = { t: useFieldId('rt'), a: useFieldId('ra'), c: useFieldId('rc'), acc: useFieldId('racc'), f: useFieldId('rf'), i: useFieldId('ri'), s: useFieldId('rs'), e: useFieldId('re') };
  const kindCats = categories.filter((c) => c.kind === type);
  const cat = kindCats.some((c) => c.id === categoryId) ? categoryId : kindCats[0]?.id ?? '';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const p = parseAmount(amount);
    if (!title.trim()) return setErr('Give it a name.');
    if (p === null || p <= 0) return setErr('Enter an amount.');
    if (!accountId) return setErr('Choose an account.');
    if (endDate && endDate < startDate) return setErr('End date must be after the start date.');
    save({
      id: rule?.id, title: title.trim(), type, amount: p, categoryId: cat, accountId, frequency,
      interval: Math.max(1, Number.parseInt(interval, 10) || 1), startDate, endDate: endDate || null,
      autoPost, isSubscription: isSub, active,
      // new rules: if start is in the past and auto-post is on, past occurrences get posted
    });
    toast({ message: 'Recurring saved', tone: 'success' });
    onClose();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Segmented label="Type" value={type} onChange={setType} className="w-full" options={[{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }]} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor={ids.t}>
          <Input id={ids.t} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Netflix" data-autofocus data-testid="recurring-title" />
        </Field>
        <Field label="Amount" htmlFor={ids.a}>
          <Input id={ids.a} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="649" data-testid="recurring-amount" />
        </Field>
        <Field label="Category" htmlFor={ids.c}>
          <Select id={ids.c} value={cat} onChange={(e) => setCategoryId(e.target.value)}>
            {kindCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Account" htmlFor={ids.acc}>
          <Select id={ids.acc} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Field>
        <Field label="Repeats" htmlFor={ids.f}>
          <Select id={ids.f} value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
            {FREQUENCIES.map((f) => <option key={f} value={f}>{frequencyLabel(f, 1)}</option>)}
          </Select>
        </Field>
        <Field label="Every" htmlFor={ids.i} hint={'e.g. 3 = every 3 ' + { daily: 'days', weekly: 'weeks', monthly: 'months', yearly: 'years' }[frequency]}>
          <Input id={ids.i} type="number" min={1} max={99} value={interval} onChange={(e) => setInterval(e.target.value)} />
        </Field>
        <Field label="Starts / first due" htmlFor={ids.s}>
          <Input id={ids.s} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value || todayISO())} />
        </Field>
        <Field label="Ends (optional)" htmlFor={ids.e}>
          <Input id={ids.e} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
      </div>
      <div className="space-y-3 rounded-2xl border border-line p-4">
        {[
          { label: 'Auto-post when due', hint: 'Off = remind me and I’ll mark it paid', v: autoPost, set: setAutoPost },
          { label: 'This is a subscription', hint: 'Counts towards monthly subscription cost', v: isSub, set: setIsSub },
          { label: 'Active', hint: 'Pause without deleting', v: active, set: setActive },
        ].map((o) => (
          <div key={o.label} className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium">{o.label}</div>
              <div className="text-xs text-subtle">{o.hint}</div>
            </div>
            <Toggle checked={o.v} onChange={o.set} label={o.label} />
          </div>
        ))}
      </div>
      {err && <p role="alert" className="text-sm text-danger">{err}</p>}
      <div className="flex justify-end">
        <Button type="submit" variant="primary" data-testid="recurring-submit">Save</Button>
      </div>
    </form>
  );
}
