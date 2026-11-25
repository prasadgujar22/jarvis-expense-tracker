import { useState } from 'react';
import { MoreHorizontal, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { Link, matchRoute, navigate, usePath } from '../../router';
import { MOBILE_PRIMARY, NAV } from './nav';
import { cn } from '../../lib/cn';
import { Modal } from '../ui/Modal';
import { useUI } from '../../store/ui';

export function BottomNav() {
  const path = matchRoute(usePath());
  const [more, setMore] = useState(false);
  const primary = NAV.filter((n) => MOBILE_PRIMARY.includes(n.path));
  const secondary = NAV.filter((n) => !MOBILE_PRIMARY.includes(n.path));
  const moreActive = secondary.some((n) => n.path === path);
  const openQuickAdd = useUI((s) => s.openQuickAdd);
  return (
    <>
      <motion.button
        type="button"
        aria-label="Add transaction"
        data-testid="quick-add-fab"
        onClick={() => openQuickAdd()}
        whileTap={{ scale: 0.92 }}
        className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-fg shadow-[0_12px_32px_-8px_color-mix(in_oklab,var(--k-accent)_70%,transparent)] lg:hidden"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </motion.button>
      <nav aria-label="Main" className="glass fixed inset-x-0 bottom-0 z-40 border-t border-line pb-[env(safe-area-inset-bottom)] lg:hidden">
        <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
          {primary.map((item) => {
            const active = path === item.path;
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  data-testid={'mnav-' + item.id}
                  aria-current={active ? 'page' : undefined}
                  className={cn('flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium', active ? 'text-accent' : 'text-muted')}
                >
                  <item.icon className="h-5 w-5" aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMore(true)}
              data-testid="mnav-more"
              aria-haspopup="dialog"
              className={cn('flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-medium', moreActive ? 'text-accent' : 'text-muted')}
            >
              <MoreHorizontal className="h-5 w-5" aria-hidden />
              More
            </button>
          </li>
        </ul>
      </nav>
      <Modal open={more} onClose={() => setMore(false)} title="More" size="sm" testId="more-sheet">
        <ul className="grid grid-cols-2 gap-2 pb-2">
          {secondary.map((item) => (
            <li key={item.path}>
              <button
                type="button"
                data-testid={'more-' + item.id}
                onClick={() => {
                  setMore(false);
                  navigate(item.path);
                }}
                className={cn('flex w-full items-center gap-3 rounded-2xl border border-line p-4 text-left text-sm font-medium hover:bg-surface-2', path === item.path && 'border-accent text-accent')}
              >
                <item.icon className="h-5 w-5" aria-hidden />
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
