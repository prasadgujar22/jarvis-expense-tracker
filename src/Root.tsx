import { lazy, Suspense, useEffect } from 'react';
import { MotionConfig } from 'motion/react';
import { useAuth, initAuth, signOut } from './auth/auth';
import { useSync, retryInitialLoad } from './sync/sync';
import { useStore } from './store/store';
import { navigate, usePath, useSearch } from './router';
import { useApplyTheme } from './components/layout/useTheme';
import { Splash, ConfigError, LoadError } from './auth/Screens';
import { AuthScreen } from './auth/AuthScreen';
import { ResetPasswordScreen } from './auth/ResetPassword';
import { Toaster } from './components/ui/Toaster';
import { LegacyImport } from './features/onboarding/LegacyImport';

const App = lazy(() => import('./App'));
const Onboarding = lazy(() => import('./features/onboarding/Onboarding').then((m) => ({ default: m.Onboarding })));

const NEXT_KEY = 'kosh:next';
const clean = (p: string) => p.replace(/\/+$/, '') || '/';

/** Only same-origin app paths are accepted as a post-login destination. */
function safeNext(v: string | null | undefined): string | null {
  if (!v || !v.startsWith('/') || v.startsWith('//') || v.startsWith('/login') || v.startsWith('/reset-password')) return null;
  return v;
}

export default function Root() {
  useApplyTheme();
  const status = useAuth((s) => s.status);
  const recovery = useAuth((s) => s.recovery);
  const phase = useSync((s) => s.phase);
  const syncError = useSync((s) => s.error);
  const onboarded = useStore((s) => s.settings.onboarded);
  const path = clean(usePath());
  const search = useSearch();

  useEffect(() => {
    void initAuth();
  }, []);

  // Guard: signed-out visitors go to /login?next=<where they wanted to go>.
  useEffect(() => {
    if (status !== 'signedOut') return;
    if (path === '/login' || path === '/reset-password') {
      const next = safeNext(new URLSearchParams(search).get('next'));
      if (next) sessionStorage.setItem(NEXT_KEY, next);
      return;
    }
    const target = path + search;
    if (target !== '/') sessionStorage.setItem(NEXT_KEY, target);
    navigate(target === '/' ? '/login' : '/login?next=' + encodeURIComponent(target), { replace: true });
  }, [status, path, search]);

  // After sign-in: leave /login for the deep link the user originally asked for.
  useEffect(() => {
    if (status !== 'signedIn' || recovery) return;
    if (path === '/login' || path === '/reset-password') {
      const next = safeNext(new URLSearchParams(search).get('next')) ?? safeNext(sessionStorage.getItem(NEXT_KEY)) ?? '/';
      sessionStorage.removeItem(NEXT_KEY);
      navigate(next, { replace: true });
    } else if (path === '/') {
      // Magic links / email confirmations land on the origin: restore a pending deep link once.
      const next = safeNext(sessionStorage.getItem(NEXT_KEY));
      sessionStorage.removeItem(NEXT_KEY);
      if (next && next !== '/') navigate(next, { replace: true });
    } else sessionStorage.removeItem(NEXT_KEY);
  }, [status, recovery, path, search]);

  let view: React.ReactNode;
  if (status === 'unconfigured') view = <ConfigError />;
  else if (status === 'loading') view = <Splash />;
  else if (status === 'signedOut') view = <AuthScreen key={path} initialMode={path === '/reset-password' ? 'forgot' : 'signin'} />;
  else if (recovery) view = <ResetPasswordScreen />;
  else if (path === '/login' || path === '/reset-password') view = <Splash />;
  else if (phase === 'loading' || phase === 'idle') view = <Splash label="Loading your data" />;
  else if (phase === 'failed') view = <LoadError message={syncError} onRetry={retryInitialLoad} onSignOut={() => void signOut()} />;
  else view = (
    <>
      <Suspense fallback={<Splash />}>{onboarded ? <App /> : <Onboarding />}</Suspense>
      <LegacyImport />
    </>
  );

  return (
    <MotionConfig reducedMotion="user">
      {view}
      {status !== 'signedIn' || recovery || !onboarded || phase !== 'ready' ? <Toaster /> : null}
    </MotionConfig>
  );
}
