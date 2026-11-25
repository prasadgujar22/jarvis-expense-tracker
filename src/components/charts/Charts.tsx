import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useReducedMotion } from 'motion/react';
import { ChartTooltip } from '../ui/ChartTooltip';
import { useFormatMoney } from '../ui/Money';

const axis = { stroke: 'var(--k-subtle)', fontSize: 11, tickLine: false, axisLine: false } as const;

export function DonutChart({ data, height = 220, centerLabel, centerValue }: { data: { name: string; value: number; color: string }[]; height?: number; centerLabel?: string; centerValue?: string }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height={height} initialDimension={{ width: height, height }}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="96%" paddingAngle={data.length > 1 ? 2 : 0} stroke="none" cornerRadius={6} isAnimationActive={!reduce} animationDuration={800}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      {centerLabel && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xs text-muted">{centerLabel}</span>
          <span className="text-lg font-semibold tracking-tight tnum">{centerValue}</span>
        </div>
      )}
    </div>
  );
}

export function IncomeExpenseChart({ data, height = 240 }: { data: { label: string; income: number; expense: number }[]; height?: number }) {
  const fmt = useFormatMoney();
  const reduce = useReducedMotion();
  return (
    <ResponsiveContainer width="100%" height={height} initialDimension={{ width: 400, height }}>
      <BarChart data={data} barGap={4} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--k-chart-grid)" />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} width={56} tickFormatter={(v: number) => fmt(v, { compact: true })} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--k-surface-2)', radius: 8 }} />
        <Bar dataKey="income" name="Income" fill="var(--k-chart-income)" radius={[6, 6, 2, 2]} maxBarSize={22} isAnimationActive={!reduce} />
        <Bar dataKey="expense" name="Expenses" fill="var(--k-chart-expense)" radius={[6, 6, 2, 2]} maxBarSize={22} isAnimationActive={!reduce} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DailySpendChart({ data, height = 200 }: { data: { day: number; amount: number }[]; height?: number }) {
  const fmt = useFormatMoney();
  const reduce = useReducedMotion();
  return (
    <ResponsiveContainer width="100%" height={height} initialDimension={{ width: 400, height }}>
      <AreaChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--k-accent)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--k-accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--k-chart-grid)" />
        <XAxis dataKey="day" {...axis} interval="preserveStartEnd" minTickGap={16} />
        <YAxis {...axis} width={56} tickFormatter={(v: number) => fmt(v, { compact: true })} />
        <Tooltip content={<ChartTooltip labelFormatter={(l) => 'Day ' + l} />} cursor={{ stroke: 'var(--k-border-strong)' }} />
        <Area type="monotone" dataKey="amount" name="Spent" stroke="var(--k-accent)" strokeWidth={2} fill="url(#spendFill)" isAnimationActive={!reduce} activeDot={{ r: 4, strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function HorizontalBars({ data, height }: { data: { name: string; value: number; color: string }[]; height?: number }) {
  const fmt = useFormatMoney();
  const reduce = useReducedMotion();
  const h = height ?? Math.max(160, data.length * 36);
  return (
    <ResponsiveContainer width="100%" height={h} initialDimension={{ width: 400, height: h }}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" {...axis} width={110} tick={{ fill: 'var(--k-muted)', fontSize: 12 }} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--k-surface-2)' }} />
        <Bar dataKey="value" name="Spent" radius={[4, 8, 8, 4]} maxBarSize={18} isAnimationActive={!reduce} label={{ position: 'right', fill: 'var(--k-muted)', fontSize: 11, formatter: (v: unknown) => fmt(Number(v), { compact: true }) }}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
