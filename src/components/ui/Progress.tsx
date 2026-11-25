import { motion } from 'motion/react';
import { cn } from '../../lib/cn';
import type { BudgetState } from '../../lib/analytics';

export const stateColor: Record<BudgetState, string> = {
  ok: 'var(--k-accent)',
  warning: 'var(--k-warning)',
  over: 'var(--k-danger)',
};

/** Human-readable value: keeps the true (possibly >100%) usage even though aria-valuenow is clamped. */
function defaultValueText(value: number): string {
  const v = Math.round(value);
  return v > 100 ? v.toLocaleString('en-IN') + '% used, ' + (v - 100).toLocaleString('en-IN') + '% over' : v + '% used';
}

export function ProgressBar({ value, color, label, className, height = 8, valueText }: { value: number; color?: string; label: string; className?: string; height?: number; valueText?: string }) {
  const pct = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-valuetext={valueText ?? defaultValueText(value)}
      className={cn('w-full overflow-hidden rounded-full bg-surface-3', className)}
      style={{ height }}
    >
      <motion.div
        className="h-full rounded-full"
        style={{ background: color ?? 'var(--k-accent)' }}
        initial={{ width: 0 }}
        animate={{ width: pct + '%' }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

export function ProgressRing({ value, size = 88, stroke = 8, color = 'var(--k-accent)', children, label, valueText }: { value: number; size?: number; stroke?: number; color?: string; children?: React.ReactNode; label: string; valueText?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-valuetext={valueText ?? defaultValueText(value)}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--k-surface-3)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct / 100) }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
