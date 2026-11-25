import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

export function EmptyState({ icon: Icon, title, description, action, className, compact }: { icon: LucideIcon; title: string; description?: ReactNode; action?: ReactNode; className?: string; compact?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-8' : 'px-6 py-14', className)}
      data-testid="empty-state"
    >
      <div className="relative mb-4">
        <div className="absolute inset-0 -m-3 rounded-full bg-accent-soft blur-xl" aria-hidden />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-gradient-to-b from-surface-2 to-surface text-accent shadow-sm">
          <Icon className="h-6 w-6" aria-hidden />
        </div>
      </div>
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </motion.div>
  );
}
