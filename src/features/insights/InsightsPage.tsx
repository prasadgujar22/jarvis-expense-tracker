import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { format, parseISO, subDays } from 'date-fns';
import { ArrowDownRight, ArrowUpRight, Lightbulb, Minus, TrendingDown, TrendingUp, Sparkles, CalendarRange, Repeat, PiggyBank } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { MonthSwitcher } from '../../components/ui/MonthSwitcher';
import { Card, CardHeader } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { CategoryDot, CategoryIcon } from '../../components/ui/CategoryIcon';
import { useFormatMoney } from '../../components/ui/Money';
import { HorizontalBars } from '../../components/charts/Charts';
import { useCategoryMap, useStore } from '../../store/store';
import { heatmap, monthTotals, monthlySubscriptionCost, spendByCategory, weekdayPattern } from '../../lib/analytics';
import { currentMonth, daysInMonth, monthLabel, shiftMonth, toISODate, formatShort } from '../../lib/dates';
import { pctChange } from '../../lib/money';
import { cn } from '../../lib/cn';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface Insight {
  id: string;
  icon: typeof Lightbulb;
  tone: 'good' | 'bad' | 'neutral';
  text: string;
}

export default function InsightsPage() {
  const [month, setMonth] = useState(currentMonth());
  const txs = useStore((s) => s.transactions);
  const rules = useStore((s) => s.recurring);
  const cats = useCategoryMap();
  const fmt = useFormatMoney();
  const prev = shiftMonth(month, -1);
  const isCurrent = month === currentMonth();
  const elapsed = isCurrent ? new Date().getDate() : daysInMonth(month);

  const data = useMemo(() => {
    const cur = spendByCategory(txs, cats, month);
    const last = spendByCategory(txs, cats, prev);
    const lastMap = new Map(last.map((c) => [c.category.id, c.amount]));
    const curMap = new Map(cur.map((c) => [c.category.id, c.amount]));
    const allIds = new Set([...curMap.keys(), ...lastMap.keys()]);
    const mom = [...allIds]
      .map((id) => ({ category: cats.get(id)!, cur: curMap.get(id) ?? 0, prev: lastMap.get(id) ?? 0 }))
      .filter((r) => r.category)
      .map((r) => ({ ...r, diff: r.cur - r.prev, pct: pctChange(r.cur, r.prev) }))
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
    const biggest = txs.filter((t) => t.type === 'expense' && t.date.startsWith(month)).sort((a, b) => b.amount - a.amount).slice(0, 6);
    const totals = monthTotals(txs, month);
    const prevTotals = monthTotals(txs, prev);
    const avgDaily = elapsed > 0 ? Math.round(totals.expense / elapsed) : 0;
    const prevAvg = Math.round(prevTotals.expense / daysInMonth(prev));
    const to = toISODate(new Date());
    const from = toISODate(subDays(new Date(), 89));
    const weekday = weekdayPattern(txs, from, to);
    const heat = heatmap(txs, 13);
    return { cur, mom, biggest, totals, prevTotals, avgDaily, prevAvg, weekday, heat };
  }, [txs, cats, month, prev, elapsed]);

  const insights = useMemo<Insight[]>(() => {
    const out: Insight[] = [];
    // Category comparisons (comparing to last month; for the current month, scale last month to same elapsed days is noisy — use plain totals for completed months, pace for current)
    for (const r of data.mom.slice(0, 4)) {
      if (r.prev === 0 || r.pct === null || Math.abs(r.pct) < 5) continue;
      if (isCurrent && r.pct > 0 && r.cur > r.prev) {
        out.push({ id: 'cat-' + r.category.id, icon: TrendingUp, tone: 'bad', text: 'You’ve already spent ' + Math.round(r.pct) + '% more on ' + r.category.name + ' than all of last month.' });
      } else if (!isCurrent || r.pct > 0) {
        out.push({ id: 'cat-' + r.category.id, icon: r.pct < 0 ? TrendingDown : TrendingUp, tone: r.pct < 0 ? 'good' : 'bad', text: 'You spent ' + Math.abs(Math.round(r.pct)) + '% ' + (r.pct < 0 ? 'less' : 'more') + ' on ' + r.category.name + ' than last month.' });
      }
    }
    const avgDelta = pctChange(data.avgDaily, data.prevAvg);
    if (avgDelta !== null && data.avgDaily > 0) {
      out.push({ id: 'avg', icon: CalendarRange, tone: avgDelta <= 0 ? 'good' : 'bad', text: 'Average daily spend is ' + fmt(data.avgDaily, { decimals: 0 }) + ', ' + Math.abs(Math.round(avgDelta)) + '% ' + (avgDelta <= 0 ? 'lower' : 'higher') + ' than last month’s ' + fmt(data.prevAvg, { decimals: 0 }) + '.' });
    }
    const wk = data.weekday;
    const weekendAvg = (wk[0].avg + wk[6].avg) / 2;
    const weekdayAvg = (wk[1].avg + wk[2].avg + wk[3].avg + wk[4].avg + wk[5].avg) / 5;
    if (weekdayAvg > 0 && weekendAvg > weekdayAvg * 1.15) {
      out.push({ id: 'weekend', icon: Sparkles, tone: 'neutral', text: 'Weekends cost you ' + (weekendAvg / weekdayAvg).toFixed(1) + '× more per day than weekdays (last 90 days).' });
    }
    const top = [...wk].sort((a, b) => b.avg - a.avg)[0];
    if (top && top.avg > 0) out.push({ id: 'topday', icon: CalendarRange, tone: 'neutral', text: WEEKDAY_NAMES[top.weekday] + 's are your biggest spending day, averaging ' + fmt(top.avg, { decimals: 0 }) + '.' });
    const sub = monthlySubscriptionCost(rules);
    if (sub > 0 && data.totals.income > 0) out.push({ id: 'subs', icon: Repeat, tone: 'neutral', text: 'Subscriptions take ' + ((sub / data.totals.income) * 100).toFixed(1) + '% of your income — ' + fmt(sub * 12, { decimals: 0 }) + ' a year.' });
    if (data.totals.income > 0) {
      const sr = data.totals.savingsRate;
      out.push({ id: 'savings', icon: PiggyBank, tone: sr >= 20 ? 'good' : sr < 0 ? 'bad' : 'neutral', text: sr >= 0 ? 'You saved ' + sr.toFixed(0) + '% of your income in ' + monthLabel(month) + (sr >= 20 ? ' — great discipline.' : '.') : 'You spent ' + fmt(-data.totals.net, { decimals: 0 }) + ' more than you earned in ' + monthLabel(month) + '.' });
    }
    return out.slice(0, 6);
  }, [data, fmt, isCurrent, month, rules]);

  const maxHeat = Math.max(1, ...data.heat.flat().map((d) => d.amount));
  const maxWeekday = Math.max(1, ...data.weekday.map((w) => w.avg));
  const hasData = txs.some((t) => t.type === 'expense');

  if (!hasData) {
    return (
      <div>
        <PageHeader title="Insights" />
        <Card><EmptyState icon={Lightbulb} title="Insights need a little history" description="Add a few expenses and Kosh will start spotting patterns for you." /></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Insights" subtitle="Patterns in your spending, in plain language" actions={<MonthSwitcher value={month} onChange={setMonth} />} />

      <section aria-label="Insight highlights" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {insights.map((ins, i) => (
          <motion.div key={ins.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="flex h-full items-start gap-3 p-4" data-testid="insight-card">
              <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', ins.tone === 'good' ? 'bg-accent-soft text-accent' : ins.tone === 'bad' ? 'bg-danger-soft text-danger' : 'bg-surface-3 text-muted')} aria-hidden>
                <ins.icon className="h-4 w-4" />
              </span>
              <p className="text-sm leading-relaxed text-fg">{ins.text}</p>
            </Card>
          </motion.div>
        ))}
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { l: 'Spent in ' + monthLabel(month, 'short'), v: fmt(data.totals.expense, { decimals: 0 }) },
          { l: 'Average per day', v: fmt(data.avgDaily, { decimals: 0 }) },
          { l: 'Transactions', v: String(txs.filter((t) => t.type === 'expense' && t.date.startsWith(month)).length) },
          { l: 'Categories used', v: String(data.cur.length) },
        ].map((s) => (
          <Card key={s.l} className="p-4">
            <div className="text-xs text-muted">{s.l}</div>
            <div className="mt-1 truncate text-lg font-semibold tnum">{s.v}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card aria-labelledby="tc-h">
          <CardHeader id="tc-h" title="Top categories" subtitle={monthLabel(month)} />
          <div className="p-4">{data.cur.length ? <HorizontalBars data={data.cur.slice(0, 8).map((c) => ({ name: c.category.name, value: c.amount, color: c.category.color }))} /> : <p className="py-8 text-center text-sm text-muted">No expenses this month.</p>}</div>
        </Card>
        <Card aria-labelledby="be-h">
          <CardHeader id="be-h" title="Biggest expenses" subtitle={monthLabel(month)} />
          <ol className="p-3">
            {data.biggest.map((t, i) => {
              const c = t.categoryId ? cats.get(t.categoryId) : null;
              return (
                <li key={t.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                  <span className="w-4 text-xs font-semibold text-subtle tnum">{i + 1}</span>
                  <CategoryIcon category={c} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{t.payee || c?.name}</div>
                    <div className="text-xs text-subtle">{c?.name} · {formatShort(t.date)}</div>
                  </div>
                  <span className="text-sm font-semibold tnum">{fmt(t.amount, { decimals: 0 })}</span>
                </li>
              );
            })}
            {data.biggest.length === 0 && <li className="py-8 text-center text-sm text-muted">No expenses this month.</li>}
          </ol>
        </Card>
      </div>

      <Card aria-labelledby="mom-h">
        <CardHeader id="mom-h" title="Month-over-month by category" subtitle={monthLabel(prev) + ' → ' + monthLabel(month)} />
        <div className="overflow-x-auto p-2" tabIndex={0} role="region" aria-labelledby="mom-h">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th scope="col" className="px-3 py-2 font-medium">Category</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{monthLabel(prev, 'short')}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{monthLabel(month, 'short')}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Change</th>
              </tr>
            </thead>
            <tbody>
              {data.mom.map((r) => {
                const Icon = r.diff > 0 ? ArrowUpRight : r.diff < 0 ? ArrowDownRight : Minus;
                return (
                  <tr key={r.category.id} className="border-t border-line">
                    <td className="px-3 py-2.5"><span className="flex items-center gap-2"><CategoryDot color={r.category.color} />{r.category.name}</span></td>
                    <td className="px-3 py-2.5 text-right text-muted tnum">{fmt(r.prev, { decimals: 0 })}</td>
                    <td className="px-3 py-2.5 text-right font-medium tnum">{fmt(r.cur, { decimals: 0 })}</td>
                    <td className={cn('px-3 py-2.5 text-right font-medium tnum', r.diff > 0 ? 'text-danger' : r.diff < 0 ? 'text-accent' : 'text-muted')}>
                      <span className="inline-flex items-center gap-0.5"><Icon className="h-3.5 w-3.5" aria-hidden />{r.pct === null ? 'new' : Math.abs(r.pct).toFixed(0) + '%'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2" aria-labelledby="wd-h">
          <CardHeader id="wd-h" title="Weekday pattern" subtitle="Average spend per day, last 90 days" />
          <ul className="space-y-2.5 p-5">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const w = data.weekday[d];
              return (
                <li key={d} className="flex items-center gap-3 text-sm">
                  <span className="w-9 text-muted">{WEEKDAYS[d]}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                    <motion.div className="h-full rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: (w.avg / maxWeekday) * 100 + '%' }} transition={{ duration: 0.8 }} />
                  </div>
                  <span className="w-20 text-right font-medium tnum">{fmt(w.avg, { decimals: 0 })}</span>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card className="lg:col-span-3" aria-labelledby="hm-h">
          <CardHeader id="hm-h" title="Spending heatmap" subtitle="Last 13 weeks" />
          <div className="overflow-x-auto p-5">
            <div className="flex gap-1.5" role="img" aria-label="Daily spending heatmap for the last 13 weeks; darker means more spending">
              <div className="flex flex-col gap-1.5 pr-1 text-[10px] text-subtle" aria-hidden>
                {['Mon', '', 'Wed', '', 'Fri', '', 'Sun'].map((l, i) => <span key={i} className="flex h-5 items-center">{l}</span>)}
              </div>
              {data.heat.map((col, ci) => (
                <div key={ci} className="flex flex-col gap-1.5">
                  {col.map((d) => {
                    const intensity = d.amount / maxHeat;
                    return (
                      <span
                        key={d.date}
                        title={d.future ? '' : format(parseISO(d.date), 'EEE d MMM') + ': ' + fmt(d.amount, { decimals: 0 })}
                        className={cn('h-5 w-5 rounded-[5px]', d.future && 'opacity-0')}
                        style={{ background: d.amount === 0 ? 'var(--k-surface-3)' : 'color-mix(in oklab, var(--k-accent) ' + Math.round(20 + intensity * 80) + '%, var(--k-surface-3))' }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-subtle" aria-hidden>
              Less {[0, 0.25, 0.5, 0.75, 1].map((v) => <span key={v} className="h-3 w-3 rounded-[3px]" style={{ background: v === 0 ? 'var(--k-surface-3)' : 'color-mix(in oklab, var(--k-accent) ' + Math.round(20 + v * 80) + '%, var(--k-surface-3))' }} />)} More
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
