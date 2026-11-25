import { useId, useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, KeyRound, Loader2 } from 'lucide-react';
import { requireSupabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { AuthLayout } from './AuthLayout';
import { PasswordInput } from './PasswordInput';
import { friendlyAuthError, validateNewPassword } from './errors';
import { useAuth } from './auth';
import { navigate } from '../router';
import { useUI } from '../store/ui';

/** Shown after a PASSWORD_RECOVERY redirect: the user has a temporary session and must choose a new password. */
export function ResetPasswordScreen() {
  const email = useAuth((s) => s.user?.email ?? '');
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = { pw: useId(), confirm: useId() };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const v = validateNewPassword(pw);
    if (v) return setError(v);
    if (pw !== confirm) return setError("The passwords don't match.");
    setBusy(true);
    const { error } = await requireSupabase().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setError(friendlyAuthError(error));
    useAuth.setState({ recovery: false });
    navigate('/', { replace: true });
    useUI.getState().toast({ message: 'Password updated — you are signed in', tone: 'success' });
  };
  return (
    <AuthLayout testId="reset-password-screen">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent" aria-hidden>
          <KeyRound className="h-6 w-6" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="mt-1.5 text-sm text-muted">{email ? <>For <span className="font-medium text-fg">{email}</span>.</> : null} Use at least 8 characters with letters and numbers.</p>
        <form onSubmit={submit} noValidate className="mt-6 space-y-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.pw} className="text-xs font-medium text-muted">New password</label>
            <PasswordInput id={ids.pw} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" data-testid="new-password" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.confirm} className="text-xs font-medium text-muted">Confirm new password</label>
            <PasswordInput id={ids.confirm} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" data-testid="confirm-password" />
          </div>
          {error && (
            <p role="alert" data-testid="auth-error" className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> <span>{error}</span>
            </p>
          )}
          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy} data-testid="save-password">
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {busy ? 'Saving…' : 'Save password'}
          </Button>
        </form>
      </motion.div>
    </AuthLayout>
  );
}
