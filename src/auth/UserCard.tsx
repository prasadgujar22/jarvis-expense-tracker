import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth, signOut } from './auth';
import { useSync } from '../sync/sync';
import { useStore } from '../store/store';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Button, IconButton } from '../components/ui/Button';
import { cn } from '../lib/cn';

export function Avatar({ email, name, size = 36 }: { email: string; name?: string; size?: number }) {
  const initial = (name?.trim() || email || '?').charAt(0).toUpperCase();
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-sm font-semibold text-[#03140d]"
    >
      {initial}
    </span>
  );
}

/** Sign out with a warning when changes are still waiting to sync. */
export function useSignOut() {
  const [open, setOpen] = useState(false);
  const pending = useSync((s) => s.pending);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await signOut();
    } finally {
      setBusy(false);
    }
  };
  const request = () => (pending > 0 ? setOpen(true) : void run());
  const dialog = (
    <ConfirmDialog
      open={open}
      onClose={() => setOpen(false)}
      title="Sign out with unsynced changes?"
      description={pending + ' change' + (pending === 1 ? " hasn't" : "s haven't") + ' reached the cloud yet. Signing out removes them from this device.'}
      confirmLabel="Sign out anyway"
      onConfirm={() => void run()}
    />
  );
  return { request, dialog, busy };
}

/** Sidebar footer (desktop). */
export function SidebarUser() {
  const email = useAuth((s) => s.user?.email ?? '');
  const name = useStore((s) => s.settings.name);
  const { request, dialog, busy } = useSignOut();
  return (
    <div className="mt-auto flex items-center gap-3 rounded-2xl border border-line bg-surface-2/60 p-3" data-testid="sidebar-user">
      <Avatar email={email} name={name} />
      <div className="min-w-0 flex-1 leading-tight">
        {name && <div className="truncate text-sm font-semibold">{name}</div>}
        <div className="truncate text-xs text-muted" data-testid="user-email" title={email}>{email}</div>
      </div>
      <IconButton label="Sign out" size="icon-sm" onClick={request} disabled={busy} data-testid="sign-out">
        <LogOut className="h-4 w-4" />
      </IconButton>
      {dialog}
    </div>
  );
}

/** Settings → Account card body (mobile + desktop). */
export function AccountPanel({ className }: { className?: string }) {
  const email = useAuth((s) => s.user?.email ?? '');
  const name = useStore((s) => s.settings.name);
  const { request, dialog, busy } = useSignOut();
  return (
    <div className={cn('flex flex-wrap items-center gap-4 p-5', className)} data-testid="account-panel">
      <Avatar email={email} name={name} size={44} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{name || 'Your account'}</div>
        <div className="truncate text-sm text-muted" data-testid="settings-email">{email}</div>
      </div>
      <Button variant="outline" icon={<LogOut className="h-4 w-4" aria-hidden />} onClick={request} disabled={busy} data-testid="settings-sign-out">
        Sign out
      </Button>
      {dialog}
    </div>
  );
}
