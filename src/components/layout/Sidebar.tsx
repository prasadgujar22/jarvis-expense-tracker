import { Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { Link, matchRoute, usePath } from '../../router';
import { NAV } from './nav';
import { Logo } from './Logo';
import { cn } from '../../lib/cn';
import { useUI } from '../../store/ui';
import { Button } from '../ui/Button';
import { SidebarUser } from '../../auth/UserCard';

export function Sidebar() {
  const path = matchRoute(usePath());
  const openQuickAdd = useUI((s) => s.openQuickAdd);
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col self-start overflow-hidden border-r border-line bg-surface/40 px-4 py-5 lg:flex" aria-label="Sidebar">
      <Link to="/" className="mb-7 flex shrink-0 items-center gap-2.5 px-2" data-testid="sidebar-logo">
        <Logo size={32} />
        <div className="leading-tight">
          <div className="text-[17px] font-semibold tracking-tight">Kosh</div>
          <div className="text-[11px] text-subtle">Every rupee, accounted for.</div>
        </div>
      </Link>
      <Button variant="primary" className="mb-6 w-full shrink-0" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => openQuickAdd()} data-testid="quick-add-button">
        Add transaction
        <kbd className="ml-auto rounded-md bg-black/10 px-1.5 py-0.5 text-[10px] font-semibold">N</kbd>
      </Button>
      <nav aria-label="Main" className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 scrollbar-none">
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const active = path === item.path;
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  data-testid={'nav-' + item.id}
                  aria-current={active ? 'page' : undefined}
                  className={cn('relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors', active ? 'text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg')}
                >
                  {active && <motion.span layoutId="sidebar-active" className="absolute inset-0 rounded-xl border border-line bg-surface-2 shadow-sm" transition={{ type: 'spring', bounce: 0.15, duration: 0.45 }} />}
                  <item.icon className={cn('relative h-[18px] w-[18px]', active && 'text-accent')} aria-hidden />
                  <span className="relative">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <SidebarUser />
    </aside>
  );
}
