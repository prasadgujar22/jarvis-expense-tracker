import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { IconButton } from './Button';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let openCount = 0;
export function isModalOpen(): boolean {
  return openCount > 0;
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  testId?: string;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  hideTitle?: boolean;
}

export function Modal(props: ModalProps) {
  return createPortal(<AnimatePresence>{props.open && <ModalInner key="modal" {...props} />}</AnimatePresence>, document.body);
}

function ModalInner({ onClose, title, description, children, footer, size = 'md', testId, initialFocusRef, hideTitle }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    openCount++;
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Focus synchronously on mount; never steal focus from an element the user (or a test)
    // has already focused inside the dialog — a delayed focus can hijack in-progress typing.
    const focusInitial = () => {
      const root = ref.current;
      if (!root || root.contains(document.activeElement)) return;
      const target = initialFocusRef?.current ?? root.querySelector<HTMLElement>('[data-autofocus]') ?? root.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus();
    };
    focusInitial();
    // Fallback for content that mounts a frame later (e.g. lazy children)
    const t = window.setTimeout(focusInitial, 30);
    const onKey = (e: KeyboardEvent) => {
      if (!ref.current) return;
      // Only the top-most modal handles keys
      const dialogs = document.querySelectorAll('[data-kosh-dialog]');
      if (dialogs[dialogs.length - 1] !== ref.current) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
      } else if (e.key === 'Tab') {
        const els = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
        if (els.length === 0) return;
        const first = els[0];
        const last = els[els.length - 1];
        if (e.shiftKey && (document.activeElement === first || !ref.current.contains(document.activeElement))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      openCount--;
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey, true);
      if (openCount === 0) document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [initialFocusRef]);

  const width = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }[size];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <motion.div
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        ref={ref}
        data-kosh-dialog
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        data-testid={testId}
        className={cn('relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-surface shadow-2xl sm:rounded-2xl', width)}
        initial={{ opacity: 0, y: 32, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ type: 'spring', bounce: 0.12, duration: 0.38 }}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line-strong sm:hidden" aria-hidden />
        <div className={cn('flex items-start justify-between gap-4 px-5 pt-4 sm:pt-5', hideTitle && 'sr-only')}>
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold tracking-tight">{title}</h2>
            {description && <p id={descId} className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          {!hideTitle && (
            <IconButton label="Close dialog" size="icon-sm" onClick={onClose} className="-mt-1 -mr-1">
              <X className="h-4 w-4" />
            </IconButton>
          )}
        </div>
        {children ? <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div> : <div className="h-4" />}
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-2/50 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </motion.div>
    </div>
  );
}
