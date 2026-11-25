import { motion } from 'motion/react';
import { CloudOff, Settings2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { BrandMark } from './AuthLayout';

/** Full-screen splash while the session (or the first data load) resolves. */
export function Splash({ label = 'Loading Kosh', reason }: { label?: string; reason?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6" role="status" aria-live="polite" data-testid="splash" data-reason={reason}>
      <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35, ease: 'easeOut' }} className="relative">
        <div className="absolute inset-0 -m-6 animate-pulse rounded-full bg-accent-soft blur-2xl" aria-hidden />
        <BrandMark size={64} />
      </motion.div>
      <div className="flex flex-col items-center gap-3">
        <div className="h-1 w-32 overflow-hidden rounded-full bg-surface-3" aria-hidden>
          <motion.div className="h-full w-1/3 rounded-full bg-accent" animate={{ x: ['-100%', '300%'] }} transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }} />
        </div>
        <span className="text-sm text-muted">{label}…</span>
      </div>
    </div>
  );
}

function CenterCard({ icon, title, children, testId }: { icon: React.ReactNode; title: string; children: React.ReactNode; testId: string }) {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-5" data-testid={testId}>
      <div className="card w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-warning-soft text-warning" aria-hidden>{icon}</div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <div className="mt-2 space-y-3 text-sm text-muted">{children}</div>
      </div>
    </main>
  );
}

/** Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY at build time. */
export function ConfigError() {
  return (
    <CenterCard testId="config-error" icon={<Settings2 className="h-6 w-6" />} title="Kosh isn't configured yet">
      <p>This build doesn't know which server to sync with. Set these environment variables and rebuild:</p>
      <pre className="rounded-xl bg-surface-2 p-3 text-left text-xs text-fg">VITE_SUPABASE_URL{'\n'}VITE_SUPABASE_ANON_KEY</pre>
      <p>Use the project's publishable (anon) key — never a service-role key.</p>
    </CenterCard>
  );
}

/** First load for this user failed (offline with no cache on this device, or a server error). */
export function LoadError({ message, onRetry, onSignOut }: { message: string | null; onRetry: () => void; onSignOut: () => void }) {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  return (
    <CenterCard testId="load-error" icon={<CloudOff className="h-6 w-6" />} title={offline ? "You're offline" : "Couldn't load your data"}>
      <p>{offline ? 'Connect to the internet once so Kosh can download your data to this device. After that it works offline too.' : message ?? 'Something went wrong talking to the server.'}</p>
      <div className="flex justify-center gap-2 pt-3">
        <Button variant="primary" onClick={onRetry} data-testid="load-retry">Try again</Button>
        <Button variant="ghost" onClick={onSignOut}>Sign out</Button>
      </div>
    </CenterCard>
  );
}
