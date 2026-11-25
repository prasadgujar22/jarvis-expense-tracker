import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { CloudCheck, LockKeyhole, PieChart, Repeat } from 'lucide-react';
import { ThemeToggle } from '../components/layout/ThemeToggle';

const FEATURES = [
  { icon: CloudCheck, title: 'Synced everywhere', text: 'Your phone and laptop stay in step — and it still works offline.' },
  { icon: PieChart, title: 'Budgets that nudge', text: 'Monthly limits with a heads-up at 80%.' },
  { icon: Repeat, title: 'Bills on autopilot', text: 'Rent, salary and subscriptions post themselves.' },
  { icon: LockKeyhole, title: 'Private by design', text: 'Row-level security: only you can read your data.' },
];

export function BrandMark({ size = 40 }: { size?: number }) {
  return <img src="/icons/icon-192.png" width={size} height={size} alt="" className="rounded-xl shadow-[0_8px_24px_-8px_rgba(16,185,129,0.6)]" />;
}

/** Split layout used by sign-in, password reset and onboarding: gradient hero on desktop, single column on mobile. */
export function AuthLayout({ children, testId, wide }: { children: ReactNode; testId?: string; wide?: boolean }) {
  return (
    <div className="flex min-h-dvh" data-testid={testId}>
      <aside
        className="relative hidden w-[46%] max-w-[640px] shrink-0 overflow-hidden border-r border-line lg:flex lg:flex-col"
        aria-label="About Kosh"
      >
        <div className="absolute inset-0 bg-[radial-gradient(900px_520px_at_0%_0%,rgba(16,185,129,0.28),transparent_60%),radial-gradient(700px_480px_at_100%_100%,rgba(20,184,166,0.22),transparent_60%)]" aria-hidden />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--k-surface)_70%,transparent),transparent)]" aria-hidden />
        <div className="relative flex flex-1 flex-col px-12 py-10 xl:px-16">
          <div className="flex items-center gap-3">
            <BrandMark size={44} />
            <div className="leading-tight">
              <div className="text-xl font-semibold tracking-tight">Kosh</div>
              <div className="text-xs text-muted">Every rupee, accounted for.</div>
            </div>
          </div>
          <div className="my-auto py-12">
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-sm font-semibold tracking-wide text-accent uppercase">
              Personal finance, beautifully simple
            </motion.p>
            <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mt-3 max-w-md text-4xl leading-[1.1] font-semibold tracking-tight xl:text-[44px]">
              Know where every rupee goes.
            </motion.h2>
            <p className="mt-4 max-w-md text-base text-muted">Track spending, plan budgets and grow your savings — in one calm, fast app that follows you across devices.</p>
            <ul className="mt-10 grid max-w-lg grid-cols-1 gap-4 xl:grid-cols-2">
              {FEATURES.map((f, i) => (
                <motion.li
                  key={f.title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  className="flex gap-3 rounded-2xl border border-line bg-surface/60 p-4 backdrop-blur"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent" aria-hidden>
                    <f.icon className="h-[18px] w-[18px]" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{f.title}</span>
                    <span className="mt-0.5 block text-xs text-muted">{f.text}</span>
                  </span>
                </motion.li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-subtle">© {new Date().getFullYear()} Kosh · Made for India · ₹</p>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8">
          <div className="flex items-center gap-2.5 lg:invisible">
            <BrandMark size={32} />
            <span className="text-lg font-semibold tracking-tight">Kosh</span>
          </div>
          <ThemeToggle />
        </header>
        <main id="main" className="flex flex-1 items-start justify-center px-5 pt-6 pb-12 sm:items-center sm:px-8 sm:pt-0">
          <div className={wide ? 'w-full max-w-xl' : 'w-full max-w-[420px]'}>{children}</div>
        </main>
      </div>
    </div>
  );
}
