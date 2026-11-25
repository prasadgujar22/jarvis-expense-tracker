import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from './Button';
import { currentMonth, monthLabel, shiftMonth, type MonthKey } from '../../lib/dates';

export function MonthSwitcher({ value, onChange, allowFuture = false }: { value: MonthKey; onChange: (m: MonthKey) => void; allowFuture?: boolean }) {
  const isCurrent = value === currentMonth();
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-line bg-surface p-1" data-testid="month-switcher">
      <IconButton label="Previous month" size="icon-sm" onClick={() => onChange(shiftMonth(value, -1))}>
        <ChevronLeft className="h-4 w-4" />
      </IconButton>
      <span className="min-w-32 px-1 text-center text-sm font-medium tnum" aria-live="polite">
        {monthLabel(value)}
      </span>
      <IconButton label="Next month" size="icon-sm" disabled={!allowFuture && isCurrent} onClick={() => onChange(shiftMonth(value, 1))}>
        <ChevronRight className="h-4 w-4" />
      </IconButton>
    </div>
  );
}
