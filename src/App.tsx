import { lazy, Suspense, useEffect } from 'react';
import { MotionConfig, motion } from 'motion/react';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { BottomNav } from './components/layout/BottomNav';
import { Toaster } from './components/ui/Toaster';
import { CommandPalette } from './components/CommandPalette';
import { QuickAdd } from './features/transactions/QuickAdd';
import { matchRoute, usePath, type RoutePath } from './router';
import { useUI } from './store/ui';
import { isModalOpen } from './components/ui/Modal';
import { NAV } from './components/layout/nav';

const pages: Record<RoutePath, React.LazyExoticComponent<() => React.JSX.Element>> = {
  '/': lazy(() => import('./features/dashboard/DashboardPage')),
  '/transactions': lazy(() => import('./features/transactions/TransactionsPage')),
  '/budgets': lazy(() => import('./features/budgets/BudgetsPage')),
  '/recurring': lazy(() => import('./features/recurring/RecurringPage')),
  '/goals': lazy(() => import('./features/goals/GoalsPage')),
  '/insights': lazy(() => import('./features/insights/InsightsPage')),
  '/accounts': lazy(() => import('./features/accounts/AccountsPage')),
  '/settings': lazy(() => import('./features/settings/SettingsPage')),
};
const NotFound = lazy(() => import('./features/NotFound'));

function useShortcuts() {
  const openQuickAdd = useUI((s) => s.openQuickAdd);
  const setPalette = useUI((s) => s.setPalette);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (!isModalOpen()) setPalette(true);
        return;
      }
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if (typing || e.metaKey || e.ctrlKey || e.altKey || isModalOpen()) return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        openQuickAdd();
      } else if (e.key === '/') {
        e.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openQuickAdd, setPalette]);
}

function PageFallback() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-surface-2" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-surface-2" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl bg-surface-2" />
    </div>
  );
}

export default function App() {
  useShortcuts();
  const path = usePath();
  const route = matchRoute(path);
  const Page = route ? pages[route] : NotFound;

  useEffect(() => {
    const item = NAV.find((n) => n.path === route);
    document.title = (item && item.path !== '/' ? item.label + ' · ' : '') + 'Kosh — Every rupee, accounted for.';
  }, [route]);

  return (
    <MotionConfig reducedMotion="user">
      <a href="#main" className="sr-only z-[70] rounded-lg bg-accent px-3 py-2 text-accent-fg focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>
      <div className="flex min-h-dvh">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-32 focus:outline-none sm:px-6 lg:px-8 lg:pb-12">
            <motion.div key={route ?? 'nf'} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
              <Suspense fallback={<PageFallback />}>
                <Page />
              </Suspense>
            </motion.div>
          </main>
        </div>
      </div>
      <BottomNav />
      <QuickAdd />
      <CommandPalette />
      <Toaster />
    </MotionConfig>
  );
}
