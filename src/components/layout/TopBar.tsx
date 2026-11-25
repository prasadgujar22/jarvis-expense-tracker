import { Search } from 'lucide-react';
import { Link } from '../../router';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { useUI } from '../../store/ui';

export function TopBar() {
  const setPalette = useUI((s) => s.setPalette);
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  return (
    <header className="glass sticky top-0 z-30 border-b border-line pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2 lg:hidden">
          <Logo size={28} />
          <span className="text-base font-semibold tracking-tight">Kosh</span>
        </Link>
        <button
          type="button"
          onClick={() => setPalette(true)}
          data-testid="search-button"
          className="ml-auto flex h-10 items-center gap-2 rounded-xl border border-line bg-surface-2/70 px-3 text-sm text-subtle transition-colors hover:border-line-strong hover:text-fg lg:ml-0 lg:w-80"
          aria-keyshortcuts="Control+K Meta+K /"
        >
          <Search className="h-4 w-4" aria-hidden />
          <span className="sr-only sm:not-sr-only">Search or jump to…</span>
          <kbd aria-hidden="true" className="ml-auto hidden rounded-md border border-line bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-muted sm:inline">{isMac ? '⌘' : 'Ctrl'} K</kbd>
        </button>
        <div className="flex items-center gap-1 lg:ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
