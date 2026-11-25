import { useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { format, parseISO } from 'date-fns';
import { Pencil, Plus, Target, Trash2, CalendarDays } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button, IconButton } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Field, Input, useFieldId } from '../../components/ui/Field';
import { EmptyState } from '../../components/ui/EmptyState';
import { ProgressRing } from '../../components/ui/Progress';
import { useFormatMoney } from '../../components/ui/Money';
import { useStore } from '../../store/store';
import { useUI } from '../../store/ui';
import type { Goal } from '../../store/types';
import { parseAmount, paiseToInput } from '../../lib/money';
import { todayISO, formatShort } from '../../lib/dates';
import { PALETTE } from '../../data/icons';
import { goalSaved, requiredMonthly } from '../../lib/goals';
import { ColorPicker } from '../../components/ui/ColorPicker';
import { cn } from '../../lib/cn';

const EMOJIS = ['🎯', '🛟', '🏠', '🚗', '✈️', '🗾', '💻', '📱', '💍', '🎓', '👶', '🏖️', '🎸', '🏍️', '💰', '🌱'];

export default function GoalsPage() {
  const goals = useStore((s) => s.goals);
  const deleteGoal = useStore((s) => s.deleteGoal);
  const toast = useUI((s) => s.toast);
  const fmt = useFormatMoney();
  const [editing, setEditing] = useState<Goal | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [contrib, setContrib] = useState<Goal | null>(null);
  const [confirm, setConfirm] = useState<Goal | null>(null);
  const totalSaved = goals.reduce((s, g) => s + goalSaved(g), 0);
  const totalTarget = goals.reduce((s, g) => s + g.target, 0);

  return (
    <div>
      <PageHeader
        title="Savings goals"
        subtitle={goals.length ? fmt(totalSaved, { decimals: 0 }) + ' saved of ' + fmt(totalTarget, { decimals: 0 }) : 'Put money aside for what matters'}
        actions={<Button variant="primary" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => { setEditing(null); setFormOpen(true); }} data-testid="add-goal">New goal</Button>}
      />
      {goals.length === 0 ? (
        <Card>
          <EmptyState icon={Target} title="No goals yet" description="An emergency fund, a trip to Japan, a new laptop — set a target and track your progress." action={<Button variant="primary" onClick={() => { setEditing(null); setFormOpen(true); }}>Create a goal</Button>} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {goals.map((g, i) => {
            const saved = goalSaved(g);
            const pct = (saved / g.target) * 100;
            const req = requiredMonthly(g);
            const done = saved >= g.target;
            return (
              <motion.div key={g.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Card className="flex h-full flex-col p-5" data-testid="goal-card">
                  <div className="flex items-start gap-4">
                    <ProgressRing value={pct} size={84} stroke={8} color={g.color} label={g.name + ' progress'}>
                      <span className="text-2xl" aria-hidden>{g.emoji}</span>
                    </ProgressRing>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-semibold">{g.name}</h2>
                      <div className="mt-1 text-xl font-semibold tnum">{fmt(saved, { decimals: 0 })}</div>
                      <div className="text-xs text-muted tnum">of {fmt(g.target, { decimals: 0 })} · {Math.min(100, pct).toFixed(0)}%</div>
                    </div>
                    <div className="flex gap-0.5">
                      <IconButton label={'Edit ' + g.name} size="icon-sm" onClick={() => { setEditing(g); setFormOpen(true); }}><Pencil className="h-4 w-4" /></IconButton>
                      <IconButton label={'Delete ' + g.name} size="icon-sm" onClick={() => setConfirm(g)}><Trash2 className="h-4 w-4" /></IconButton>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-surface-2 px-3 py-2">
                      <div className="text-muted">Target date</div>
                      <div className="mt-0.5 flex items-center gap-1 font-medium"><CalendarDays className="h-3 w-3" aria-hidden />{g.targetDate ? format(parseISO(g.targetDate), 'd MMM yyyy') : 'No deadline'}</div>
                    </div>
                    <div className="rounded-xl bg-surface-2 px-3 py-2">
                      <div className="text-muted">Needed / month</div>
                      <div className={cn('mt-0.5 font-medium tnum', done && 'text-accent')} data-testid="goal-required">{done ? 'Goal reached 🎉' : req === null ? '—' : fmt(req, { decimals: 0 })}</div>
                    </div>
                  </div>
                  {g.contributions.length > 0 && (
                    <ul className="mt-3 space-y-1 text-xs" aria-label="Recent contributions">
                      {[...g.contributions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3).map((c) => (
                        <li key={c.id} className="flex items-center justify-between text-muted">
                          <span>{formatShort(c.date)}{c.note ? ' · ' + c.note : ''}</span>
                          <span className={cn('tnum font-medium', c.amount >= 0 ? 'text-fg' : 'text-danger')}>{c.amount >= 0 ? '+' : ''}{fmt(c.amount, { decimals: 0 })}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-auto pt-4">
                    <Button className="w-full" variant="secondary" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setContrib(g)} data-testid="add-contribution">Add contribution</Button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit goal' : 'New goal'} testId="goal-modal">
        <GoalForm key={(editing?.id ?? 'new') + String(formOpen)} goal={editing} onClose={() => setFormOpen(false)} />
      </Modal>
      <Modal open={!!contrib} onClose={() => setContrib(null)} title={'Add to ' + (contrib?.name ?? '')} size="sm" testId="contribution-modal">
        {contrib && <ContributionForm goal={contrib} onClose={() => setContrib(null)} />}
      </Modal>
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} title="Delete goal?" description={'"' + (confirm?.name ?? '') + '" and its contributions will be removed.'} confirmLabel="Delete" onConfirm={() => { if (confirm) { deleteGoal(confirm.id); toast({ message: 'Goal deleted' }); } }} />
    </div>
  );
}

function GoalForm({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const save = useStore((s) => s.saveGoal);
  const toast = useUI((s) => s.toast);
  const [name, setName] = useState(goal?.name ?? '');
  const [target, setTarget] = useState(goal ? paiseToInput(goal.target) : '');
  const [date, setDate] = useState(goal?.targetDate ?? '');
  const [emoji, setEmoji] = useState(goal?.emoji ?? '🎯');
  const [color, setColor] = useState(goal?.color ?? PALETTE[13]);
  const [err, setErr] = useState('');
  const ids = { n: useFieldId('gn'), t: useFieldId('gt'), d: useFieldId('gd') };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const p = parseAmount(target);
    if (!name.trim()) return setErr('Name your goal.');
    if (p === null || p <= 0) return setErr('Enter a target amount.');
    save({ id: goal?.id, name: name.trim(), target: p, targetDate: date || null, emoji, color });
    toast({ message: 'Goal saved', tone: 'success' });
    onClose();
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor={ids.n} className="sm:col-span-2"><Input id={ids.n} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Emergency fund" data-autofocus data-testid="goal-name" /></Field>
        <Field label="Target amount" htmlFor={ids.t}><Input id={ids.t} inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="300000" data-testid="goal-target" /></Field>
        <Field label="Target date" htmlFor={ids.d}><Input id={ids.d} type="date" value={date} min={goal ? undefined : todayISO()} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      <fieldset>
        <legend className="mb-2 text-xs font-medium text-muted">Emoji</legend>
        <div className="flex flex-wrap gap-1.5">
          {EMOJIS.map((em) => (
            <button key={em} type="button" aria-label={'Emoji ' + em} aria-pressed={emoji === em} onClick={() => setEmoji(em)} className={cn('h-10 w-10 rounded-xl border text-xl', emoji === em ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface-2')}>{em}</button>
          ))}
        </div>
      </fieldset>
      <ColorPicker value={color} onChange={setColor} />
      {err && <p role="alert" className="text-sm text-danger">{err}</p>}
      <div className="flex justify-end"><Button type="submit" variant="primary" data-testid="goal-submit">Save goal</Button></div>
    </form>
  );
}

function ContributionForm({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const add = useStore((s) => s.addContribution);
  const toast = useUI((s) => s.toast);
  const fmt = useFormatMoney();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [withdraw, setWithdraw] = useState(false);
  const [err, setErr] = useState('');
  const ids = { a: useFieldId('ca'), d: useFieldId('cd'), n: useFieldId('cn') };
  const req = requiredMonthly(goal);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const p = parseAmount(amount);
    if (p === null || p <= 0) return setErr('Enter an amount.');
    add(goal.id, { amount: withdraw ? -p : p, date, note: note.trim() });
    toast({ message: (withdraw ? 'Withdrew ' : 'Added ') + fmt(p, { decimals: 0 }) + (withdraw ? ' from ' : ' to ') + goal.name, tone: 'success' });
    onClose();
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Amount" htmlFor={ids.a} hint={req ? 'Suggested: ' + fmt(req, { decimals: 0 }) + ' this month' : undefined}>
        <Input id={ids.a} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} data-autofocus data-testid="contribution-amount" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" htmlFor={ids.d}><Input id={ids.d} type="date" value={date} onChange={(e) => setDate(e.target.value || todayISO())} /></Field>
        <Field label="Note" htmlFor={ids.n}><Input id={ids.n} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={withdraw} onChange={(e) => setWithdraw(e.target.checked)} className="h-4 w-4 accent-[var(--k-accent)]" /> This is a withdrawal</label>
      {err && <p role="alert" className="text-sm text-danger">{err}</p>}
      <div className="flex justify-end"><Button type="submit" variant="primary" data-testid="contribution-submit">Save</Button></div>
    </form>
  );
}
