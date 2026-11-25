import { AlertTriangle, Check, CloudOff, Loader2, RotateCw } from 'lucide-react';
import { useSync, syncNow } from './sync';
import { cn } from '../lib/cn';

const LABEL = {
  synced: 'Synced',
  syncing: 'Syncing…',
  offline: 'Offline – changes saved on this device',
  error: 'Sync error',
} as const;

/** Small pill in the top bar: Synced / Syncing… / Offline / Sync error (with retry). */
export function SyncIndicator({ className }: { className?: string }) {
  const status = useSync((s) => s.status);
  const pending = useSync((s) => s.pending);
  const error = useSync((s) => s.error);
  const Icon = status === 'synced' ? Check : status === 'syncing' ? Loader2 : status === 'offline' ? CloudOff : AlertTriangle;
  const title = status === 'error' ? 'Sync error: ' + (error ?? 'unknown') + '. Click to retry.' : status === 'offline' ? LABEL.offline + (pending ? ' (' + pending + ' pending)' : '') : LABEL[status];
  const content = (
    <>
      <Icon className={cn('h-3.5 w-3.5 shrink-0', status === 'syncing' && 'animate-spin')} aria-hidden />
      <span className={cn(status === 'offline' ? 'max-w-[9rem] truncate sm:max-w-none' : '', status === 'synced' && 'sr-only sm:not-sr-only')}>
        {status === 'offline' ? <><span className="sm:hidden">Offline</span><span className="hidden sm:inline">{LABEL.offline}</span></> : LABEL[status]}
      </span>
      {status === 'error' && <RotateCw className="h-3.5 w-3.5" aria-hidden />}
    </>
  );
  const cls = cn(
    'inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap',
    status === 'synced' && 'border-line text-muted',
    status === 'syncing' && 'border-line text-muted',
    status === 'offline' && 'border-warning/30 bg-warning-soft text-warning',
    status === 'error' && 'border-danger/30 bg-danger-soft text-danger hover:brightness-110',
    className,
  );
  if (status === 'error') {
    return (
      <button type="button" onClick={() => void syncNow()} className={cls} title={title} aria-label={title} data-testid="sync-status" data-state={status}>
        {content}
      </button>
    );
  }
  return (
    <span role="status" aria-live="polite" className={cls} title={title} data-testid="sync-status" data-state={status} data-pending={pending}>
      {content}
    </span>
  );
}
