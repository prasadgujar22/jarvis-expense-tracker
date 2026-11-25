import { motion } from 'motion/react';
import { ArrowRight, Repeat, Trash2 } from 'lucide-react';
import type { Account, Category, Transaction } from '../../store/types';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { useFormatMoney } from '../../components/ui/Money';
import { useUI } from '../../store/ui';
import { cn } from '../../lib/cn';
import { formatShort } from '../../lib/dates';
import { useDeleteTransaction } from './useDeleteTransaction';

export function TransactionRow({ tx, category, account, toAccount, showDate, compact }: { tx: Transaction; category: Category | null | undefined; account: Account | undefined; toAccount?: Account; showDate?: boolean; compact?: boolean }) {
  const fmt = useFormatMoney();
  const openQuickAdd = useUI((s) => s.openQuickAdd);
  const del = useDeleteTransaction();
  const sign = tx.type === 'income' ? 1 : tx.type === 'expense' ? -1 : 0;
  const title = tx.payee || category?.name || 'Transfer';
  const sub = tx.type === 'transfer' ? (
    <span className="inline-flex items-center gap-1">
      {account?.name ?? 'Unknown'} <ArrowRight className="h-3 w-3" aria-hidden="true" /><span className="sr-only">to</span> {toAccount?.name ?? 'Unknown'}
    </span>
  ) : (
    <span>
      {category?.name ?? 'Uncategorised'} · {account?.name ?? 'Unknown account'}
    </span>
  );
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16, transition: { duration: 0.18 } }}
      className="group relative"
      data-testid="transaction-row"
      data-tx-id={tx.id}
    >
      <button
        type="button"
        onClick={() => openQuickAdd({ editing: tx })}
        className={cn('flex w-full items-center gap-3 rounded-xl px-3 text-left transition-colors hover:bg-surface-2', compact ? 'py-2' : 'py-2.5')}
      >
        <span className="sr-only">Edit </span>
        <CategoryIcon category={tx.type === 'transfer' ? null : category} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-fg">{title}</span>
            {tx.recurringId && <Repeat className="h-3 w-3 shrink-0 text-subtle" aria-hidden="true" />}
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-2 truncate text-xs text-subtle">
            {sub}
            {showDate && <span className="tnum">· {formatShort(tx.date)}</span>}
            {!compact &&
              tx.tags.slice(0, 2).map((t) => (
                <span key={t} className="hidden rounded-md bg-surface-3 px-1.5 py-px text-[10px] text-muted sm:inline">
                  #{t}
                </span>
              ))}
          </div>
        </div>
        <span className={cn('shrink-0 text-sm font-semibold tnum', sign > 0 ? 'text-income' : sign < 0 ? 'text-fg' : 'text-muted')}>
          {sign > 0 ? '+' : sign < 0 ? '−' : ''}
          {fmt(tx.amount)}
        </span>
        <span className="w-8 shrink-0 max-sm:hidden" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={'Delete ' + title}
        data-testid="transaction-delete"
        onClick={() => del(tx.id)}
        className="absolute top-1/2 right-2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-subtle opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-danger-soft hover:text-danger focus-visible:opacity-100 sm:flex"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </motion.li>
  );
}
