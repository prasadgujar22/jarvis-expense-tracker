import { iconFor, ACCOUNT_ICONS } from '../../data/icons';
import type { AccountType, Category } from '../../store/types';
import { cn } from '../../lib/cn';
import { ArrowLeftRight } from 'lucide-react';

export function CategoryIcon({ category, size = 'md', className }: { category: Pick<Category, 'icon' | 'color'> | null | undefined; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const Icon = category ? iconFor(category.icon) : ArrowLeftRight;
  const color = category?.color ?? '#64748b';
  const dims = { sm: 'h-7 w-7 rounded-lg', md: 'h-10 w-10 rounded-xl', lg: 'h-12 w-12 rounded-2xl' }[size];
  const icon = { sm: 'h-3.5 w-3.5', md: 'h-[18px] w-[18px]', lg: 'h-5 w-5' }[size];
  return (
    <span
      aria-hidden
      className={cn('inline-flex shrink-0 items-center justify-center', dims, className)}
      style={{ background: 'color-mix(in oklab, ' + color + ' 16%, transparent)', color, boxShadow: 'inset 0 0 0 1px color-mix(in oklab, ' + color + ' 22%, transparent)' }}
    >
      <Icon className={icon} strokeWidth={2.2} />
    </span>
  );
}

export function CategoryDot({ color, className }: { color: string; className?: string }) {
  return <span aria-hidden className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full', className)} style={{ background: color }} />;
}

export function AccountIcon({ type, color, size = 'md' }: { type: AccountType; color: string; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = ACCOUNT_ICONS[type];
  const dims = { sm: 'h-7 w-7 rounded-lg', md: 'h-10 w-10 rounded-xl', lg: 'h-12 w-12 rounded-2xl' }[size];
  return (
    <span aria-hidden className={cn('inline-flex shrink-0 items-center justify-center', dims)} style={{ background: 'color-mix(in oklab, ' + color + ' 16%, transparent)', color }}>
      <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5'} strokeWidth={2.1} />
    </span>
  );
}
