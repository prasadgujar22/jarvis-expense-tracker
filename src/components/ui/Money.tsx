import { animate, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { formatMoney, type FormatOptions } from '../../lib/money';
import { useCurrency } from '../../store/store';
import { cn } from '../../lib/cn';

export function Money({ value, className, ...opts }: { value: number; className?: string } & FormatOptions) {
  const currency = useCurrency();
  return <span className={cn('tnum', className)}>{formatMoney(value, currency, opts)}</span>;
}

export function useFormatMoney() {
  const currency = useCurrency();
  return (v: number, opts?: FormatOptions) => formatMoney(v, currency, opts);
}

/** Animated count-up; honours prefers-reduced-motion. */
export function CountUp({ value, className, format }: { value: number; className?: string; format: (v: number) => string }) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);
  const prev = useRef(reduce ? value : 0);
  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      prev.current = value;
      return;
    }
    const controls = animate(prev.current, value, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, reduce]);
  return (
    <span role="img" className={cn('tnum', className)} aria-label={format(value)}>
      <span aria-hidden="true">{format(display)}</span>
    </span>
  );
}
