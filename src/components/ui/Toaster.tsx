import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { CheckCircle2, Info, X, AlertTriangle } from 'lucide-react';
import { useUI, type Toast } from '../../store/ui';

function ToastItem({ t }: { t: Toast }) {
  const dismiss = useUI((s) => s.dismiss);
  useEffect(() => {
    const h = window.setTimeout(() => dismiss(t.id), t.duration ?? (t.action ? 6000 : 3500));
    return () => window.clearTimeout(h);
  }, [t, dismiss]);
  const Icon = t.tone === 'success' ? CheckCircle2 : t.tone === 'danger' ? AlertTriangle : Info;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96, transition: { duration: 0.15 } }}
      className="pointer-events-auto flex w-full items-center gap-3 rounded-2xl border border-line-strong bg-surface-2 px-4 py-3 text-sm shadow-2xl sm:w-auto sm:min-w-80"
      data-testid="toast"
    >
      <Icon className={t.tone === 'danger' ? 'h-4 w-4 text-danger' : 'h-4 w-4 text-accent'} aria-hidden />
      <span className="flex-1 text-fg">{t.message}</span>
      {t.action && (
        <button
          type="button"
          className="rounded-lg px-2 py-1 font-semibold text-accent hover:bg-accent-soft"
          data-testid="toast-action"
          onClick={() => {
            t.action?.onClick();
            dismiss(t.id);
          }}
        >
          {t.action.label}
        </button>
      )}
      <button type="button" aria-label="Dismiss notification" className="rounded-md p-1 text-subtle hover:text-fg" onClick={() => dismiss(t.id)}>
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.li>
  );
}

export function Toaster() {
  const toasts = useUI((s) => s.toasts);
  return (
    <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] flex justify-center px-4 lg:bottom-6">
      <ul className="flex w-full max-w-md flex-col items-center gap-2">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <ToastItem key={t.id} t={t} />
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
