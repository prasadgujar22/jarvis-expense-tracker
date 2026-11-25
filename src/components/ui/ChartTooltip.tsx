import { useFormatMoney } from './Money';

export interface TooltipEntry {
  name?: string | number;
  value?: number | string | readonly (number | string)[];
  color?: string;
  dataKey?: string | number | ((obj: unknown) => unknown);
  payload?: unknown;
}

export function ChartTooltip({ active, payload, label, labelFormatter }: { active?: boolean; payload?: readonly TooltipEntry[]; label?: string | number; labelFormatter?: (l: string | number) => string }) {
  const fmt = useFormatMoney();
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl border border-line-strong bg-surface-2/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      {label !== undefined && label !== '' && <div className="mb-1 font-medium text-muted">{labelFormatter ? labelFormatter(label) : label}</div>}
      <ul className="space-y-0.5">
        {payload.map((p, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden />
            <span className="text-muted">{p.name}</span>
            <span className="ml-auto pl-3 font-semibold text-fg tnum">{fmt(Number(p.value ?? 0), { decimals: 0 })}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
