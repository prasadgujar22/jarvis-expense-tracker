import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, ArrowRight, CalendarClock, Landmark, PieChart as PieIcon, Plus, Sparkles, TrendingDown, TrendingUp, Wallet, PiggyBank } from 'lucide-react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { Card, CardHeader } from '../../components/ui/Card';
import { MonthSwitcher } from '../../components/ui/MonthSwitcher';
import { CountUp, useFormatMoney } from '../../components/ui/Money';
import { DeltaChip } from '../../components/ui/DeltaChip';
import { ProgressBar, stateColor } from '../../components/ui/Progress';
import { CategoryDot, CategoryIcon } from '../../components/ui/CategoryIcon';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { DonutChart, IncomeExpenseChart, DailySpendChart } from '../../components/charts/Charts';
import { useAccountMap, useCategoryMap, useStore } from '../../store/store';
import { useUI } from '../../store/ui';
import { Link, navigate } from '../../router';
import { budgetStatus, dailySpend, lastNMonths, monthTotals, netWorth, spendByCategory, upcomingBills } from '../../lib/analytics';
import { currentMonth, monthEnd, monthLabel, shiftMonth, toISODate, todayISO, formatShort } from '../../lib/dates';
import { pctChange } from '../../lib/money';
import { nextOccurrence } from '../../lib/recurring';
import { TransactionRow } from '../transactions/TransactionRow';
import { cn } from '../../lib/cn';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const [month, setMonth] = useState(currentMonth());
  const txs = useStore((s) => s.transactions);
  const accounts = useStore((s) => s.accounts);
  const budgets = useStore((s) => s.budgets);
  const recurring = useStore((s) => s.recurring);
  const name = useStore((s) => s.settings.name);
  const cats = useCategoryMap();
  const accs = useAccountMap();
  const fmt = useFormatMoney();
  const openQuickAdd = useUI((s) => s.openQuickAdd);
  const markPaid = useStore((s) => s.markRecurringPaid);
  const toast = useUI((s) => s.toast);

  const prev = shiftMonth(month, -1);
  const stats = useMemo(() => {
    const isCurrent = month === currentMonth();
    const endCur = isCurrent ? todayISO() : toISODate(monthEnd(month));
    const endPrev = toISODate(monthEnd(prev));
    const cur = monthTotals(txs, month);
    const p = monthTotals(txs, prev);
    const nw = netWorth(accounts, txs, endCur);
    const nwPrev = netWorth(accounts, txs, endPrev);
    return { cur, p, nw, nwPrev };
  }, [txs, accounts, month, prev]);

  const byCat = useMemo(() => spendByCategory(txs, cats, month), [txs, cats, month]);
  const sixMonths = useMemo(() => lastNMonths(6, month).map((m) => ({ label: monthLabel(m, 'short'), ...monthTotals(txs, m) })), [txs, month]);
  const daily = useMemo(() => {
    const d = dailySpend(txs, month);
    return month === currentMonth() ? d.filter((x) => x.day <= new Date().getDate()) : d;
  }, [txs, month]);
  const bStatus = useMemo(() => budgetStatus(budgets, txs, cats, month), [budgets, txs, cats, month]);
  const alerts = bStatus.filter((b) => b.state === 'over');
  const upcoming = useMemo(() => upcomingBills(recurring, 30).filter((u) => u.rule.type === 'expense').slice(0, 5), [recurring]);
  const recent = useMemo(() => [...txs].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1)).slice(0, 6), [txs]);

  if (accounts.length === 0 && txs.length === 0) {
    return (
      <div>
        <Greeting name={name} />
        <Card className="mt-6 overflow-hidden">
          <EmptyState
            icon={Sparkles}
            title="A fresh start"
            description="Kosh is empty. Add an account to begin tracking your money."
            action={
              <>
                <Button variant="primary" icon={<Landmark className="h-4 w-4" aria-hidden />} onClick={() => navigate('/accounts')} data-testid="empty-add-account">
                  Add an account
                </Button>
              </>
            }
          />
        </Card>
      </div>
    );
  }

  const savingsDelta = stats.p.income > 0 ? stats.cur.savingsRate - stats.p.savingsRate : null;
  const kpis = [
    { id: 'networth', label: 'Net worth', value: stats.nw, delta: pctChange(stats.nw, stats.nwPrev), good: true, icon: Wallet, fmt: (v: number) => fmt(v, { decimals: 0 }) },
    { id: 'income', label: 'Income', value: stats.cur.income, delta: pctChange(stats.cur.income, stats.p.income), good: true, icon: TrendingUp, fmt: (v: number) => fmt(v, { decimals: 0 }) },
    { id: 'expenses', label: 'Expenses', value: stats.cur.expense, delta: pctChange(stats.cur.expense, stats.p.expense), good: false, icon: TrendingDown, fmt: (v: number) => fmt(v, { decimals: 0 }) },
    { id: 'savings', label: 'Savings rate', value: Math.round(stats.cur.savingsRate * 10), delta: savingsDelta, good: true, icon: PiggyBank, fmt: (v: number) => (v / 10).toFixed(1) + '%', unit: ' pts' },
  ];
  const totalSpent = byCat.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <Greeting name={name} />
        <MonthSwitcher value={month} onChange={setMonth} />
      </div>

      {alerts.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} role="alert" data-testid="over-budget-alert" className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-fg">
              {alerts.length === 1 ? 'You are over budget in ' + (alerts[0].category?.name ?? 'your overall budget') : 'Over budget in ' + alerts.length + ' budgets'}
            </p>
            <p className="mt-0.5 text-muted">
              {alerts
                .slice(0, 3)
                .map((a) => (a.category?.name ?? 'Overall') + ' by ' + fmt(-a.remaining, { decimals: 0 }))
                .join(' · ')}
            </p>
          </div>
          <Link to="/budgets" className="shrink-0 rounded-lg px-2 py-1 text-sm font-semibold text-danger hover:underline">
            Review
          </Link>
        </motion.div>
      )}

      <section aria-label="Key figures" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {kpis.map((k, i) => (
          <motion.div key={k.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className={cn('relative h-full overflow-hidden p-4 sm:p-5', i === 0 && 'bg-gradient-to-br from-accent-soft to-transparent')} data-testid={'kpi-' + k.id}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted sm:text-sm">{k.label}</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-muted" aria-hidden>
                  <k.icon className="h-4 w-4" />
                </span>
              </div>
              <div className={cn('mt-2 truncate text-xl font-semibold tracking-tight sm:text-[26px]', k.id === 'savings' && k.value < 0 && 'text-danger')}>
                <CountUp value={k.value} format={k.fmt} />
              </div>
              <div className="mt-2">
                <DeltaChip pct={k.delta} goodWhenUp={k.good} unit={k.unit} />
              </div>
            </Card>
          </motion.div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card aria-labelledby="donut-h">
          <CardHeader id="donut-h" title="Spending by category" subtitle={monthLabel(month)} />
          {byCat.length === 0 ? (
            <EmptyState compact icon={PieIcon} title="No spending yet" description="Expenses for this month will show up here." />
          ) : (
            <div className="flex flex-col items-center gap-5 p-5 sm:flex-row">
              <div className="w-full max-w-[200px] shrink-0">
                <DonutChart data={byCat.map((c) => ({ name: c.category.name, value: c.amount, color: c.category.color }))} centerLabel="Spent" centerValue={fmt(totalSpent, { compact: true })} />
              </div>
              <ul className="w-full min-w-0 flex-1 space-y-2">
                {byCat.slice(0, 6).map((c) => (
                  <li key={c.category.id} className="flex items-center gap-2 text-sm">
                    <CategoryDot color={c.category.color} />
                    <span className="min-w-0 flex-1 truncate text-muted">{c.category.name}</span>
                    <span className="text-xs text-subtle tnum">{((c.amount / totalSpent) * 100).toFixed(0)}%</span>
                    <span className="text-right font-medium tnum">{fmt(c.amount, { decimals: 0 })}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
        <Card aria-labelledby="ie-h">
          <CardHeader
            id="ie-h"
            title="Income vs expenses"
            subtitle="Last 6 months"
            action={
              <div className="flex items-center gap-3 text-xs text-muted">
                <span className="flex items-center gap-1.5"><CategoryDot color="var(--k-chart-income)" /> Income</span>
                <span className="flex items-center gap-1.5"><CategoryDot color="var(--k-chart-expense)" /> Expenses</span>
              </div>
            }
          />
          <div className="px-2 pt-4 pb-3 sm:px-4">
            <IncomeExpenseChart data={sixMonths} />
          </div>
        </Card>
      </div>

      <Card aria-labelledby="daily-h">
        <CardHeader id="daily-h" title="Daily spending" subtitle={monthLabel(month) + ' · avg ' + fmt(daily.length ? Math.round(daily.reduce((s, d) => s + d.amount, 0) / daily.length) : 0, { decimals: 0 }) + ' / day'} />
        <div className="px-2 pt-4 pb-3 sm:px-4">
          <DailySpendChart data={daily} />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card aria-labelledby="bh-h">
          <CardHeader id="bh-h" title="Budget health" subtitle={bStatus.length ? bStatus.filter((b) => b.state === 'ok').length + ' of ' + bStatus.length + ' on track' : undefined} action={<Link to="/budgets" className="text-sm font-medium text-accent hover:underline">View all</Link>} />
          <div className="space-y-4 p-5">
            {bStatus.length === 0 ? (
              <EmptyState compact icon={PieIcon} title="No budgets" description="Set monthly limits to stay on track." action={<Button size="sm" onClick={() => navigate('/budgets')}>Create budget</Button>} />
            ) : (
              bStatus.slice(0, 5).map((b) => (
                <div key={b.budget.id}>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <CategoryDot color={b.category?.color ?? 'var(--k-accent)'} />
                      <span className="truncate font-medium">{b.category?.name ?? 'Overall'}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted tnum">
                      {fmt(b.spent, { decimals: 0 })} / {fmt(b.budget.amount, { decimals: 0 })}
                    </span>
                  </div>
                  <ProgressBar value={b.pct} color={stateColor[b.state]} label={(b.category?.name ?? 'Overall') + ' budget used'} height={6} />
                </div>
              ))
            )}
          </div>
        </Card>

        <Card aria-labelledby="up-h">
          <CardHeader id="up-h" title="Upcoming bills" subtitle="Next 30 days" action={<Link to="/recurring" className="text-sm font-medium text-accent hover:underline">Manage</Link>} />
          <ul className="p-3" data-testid="upcoming-list">
            {upcoming.length === 0 && <EmptyState compact icon={CalendarClock} title="All clear" description="No bills due in the next 30 days." />}
            {upcoming.map((u) => {
              const days = differenceInCalendarDays(parseISO(u.date), new Date());
              return (
                <li key={u.rule.id + u.date} className="flex items-center gap-3 rounded-xl px-2 py-2">
                  <CategoryIcon category={cats.get(u.rule.categoryId)} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{u.rule.title}</div>
                    <div className={cn('text-xs', u.overdue ? 'text-danger' : 'text-subtle')}>
                      {u.overdue ? 'Overdue · ' + formatShort(u.date) : days === 0 ? 'Due today' : days === 1 ? 'Tomorrow' : 'In ' + days + ' days · ' + format(parseISO(u.date), 'd MMM')}
                      {u.rule.autoPost && ' · auto'}
                    </div>
                  </div>
                  <span className="text-sm font-semibold tnum">{fmt(u.rule.amount, { decimals: 0 })}</span>
                  {!u.rule.autoPost && (u.overdue || days <= 7) && nextOccurrence(u.rule, u.rule.postedThrough) === u.date && (
                    <Button size="sm" variant="outline" onClick={() => { markPaid(u.rule.id); toast({ message: u.rule.title + ' marked as paid', tone: 'success' }); }} aria-label={'Pay ' + u.rule.title}>
                      Pay
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>

        <Card aria-labelledby="rt-h">
          <CardHeader id="rt-h" title="Recent transactions" action={<Link to="/transactions" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">All <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>} />
          <ul className="p-2">
            {recent.length === 0 && <EmptyState compact icon={Plus} title="No transactions" action={<Button size="sm" variant="primary" onClick={() => openQuickAdd()}>Add one</Button>} />}
            {recent.map((t) => (
              <TransactionRow key={t.id} tx={t} compact showDate category={t.categoryId ? cats.get(t.categoryId) : null} account={accs.get(t.accountId)} toAccount={t.toAccountId ? accs.get(t.toAccountId) : undefined} />
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Greeting({ name }: { name: string }) {
  return (
    <div>
      <p className="text-sm text-muted">{format(new Date(), 'EEEE, d MMMM')}</p>
      <h1 className="mt-0.5 text-2xl font-semibold tracking-tight sm:text-[28px]">
        {greeting()}
        {name ? ', ' + name : ''}
      </h1>
    </div>
  );
}
