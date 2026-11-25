import { motion } from 'motion/react';
import { useId } from 'react';
import { cn } from '../../lib/cn';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  testId?: string;
}

export function Segmented<T extends string>({ value, onChange, options, label, className, size = 'md' }: { value: T; onChange: (v: T) => void; options: SegmentOption<T>[]; label: string; className?: string; size?: 'sm' | 'md' }) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-xl border border-line bg-surface-2 p-1', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            data-testid={o.testId}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
              e.preventDefault();
              const i = options.findIndex((x) => x.value === value);
              const next = options[(i + (e.key === 'ArrowRight' ? 1 : options.length - 1)) % options.length];
              onChange(next.value);
            }}
            tabIndex={active ? 0 : -1}
            className={cn('relative flex-1 rounded-lg font-medium transition-colors', size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm', active ? 'text-fg' : 'text-muted hover:text-fg')}
          >
            {active && <motion.span layoutId={'seg-' + id} className="absolute inset-0 rounded-lg border border-line bg-surface shadow-sm" transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }} />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
