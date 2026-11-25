import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '../../lib/cn';

/** goodWhenUp: income/savings up is good; expense up is bad. */
export function DeltaChip({ pct, goodWhenUp = true, suffix = 'vs last month', unit = '%' }: { pct: number | null; goodWhenUp?: boolean; suffix?: string; unit?: string }) {
  if (pct === null) return <span className="text-xs text-subtle">No data last month</span>;
  const flat = Math.abs(pct) < 0.5;
  const up = pct > 0;
  const good = flat ? null : up === goodWhenUp;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        className={cn(
          'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold tnum',
          good === null ? 'bg-surface-3 text-muted' : good ? 'bg-accent-soft text-accent' : 'bg-danger-soft text-danger',
        )}
      >
        <Icon className="h-3 w-3" aria-hidden />
        {Math.abs(pct) >= 1000 ? '999+' : Math.abs(pct).toFixed(Math.abs(pct) < 10 ? 1 : 0)}{unit}
      </span>
      <span className="text-subtle">{suffix}</span>
    </span>
  );
}
