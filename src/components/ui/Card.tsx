import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('card', className)} {...rest} />;
}

export function CardHeader({ title, subtitle, action, className, id }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string; id?: string }) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-5 pt-5', className)}>
      <div className="min-w-0">
        <h2 id={id} className="text-[15px] font-semibold tracking-tight text-fg">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
