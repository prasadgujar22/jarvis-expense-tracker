import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, ArrowLeft, CheckCircle2, Info, Loader2, Mail, MailCheck, Sparkles } from 'lucide-react';
import { requireSupabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { inputClass } from '../components/ui/Field';
import { cn } from '../lib/cn';
import { AuthLayout } from './AuthLayout';
import { PasswordInput } from './PasswordInput';
import { friendlyAuthError, passwordScore, validateEmail, validateNewPassword } from './errors';
import { setAuthNotice, useAuth } from './auth';

type Mode = 'signin' | 'signup' | 'forgot';
type Sent = { kind: 'confirm' | 'magic' | 'reset'; email: string } | null;

const origin = () => window.location.origin;

export function AuthScreen({ initialMode = 'signin' }: { initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<null | 'password' | 'magic'>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<{ email?: string; password?: string }>({});
  const [sent, setSent] = useState<Sent>(null);
  const notice = useAuth((s) => s.notice);
  const emailRef = useRef<HTMLInputElement>(null);
  const ids = { email: useId(), password: useId(), err: useId(), tabs: useId() };

  useEffect(() => {
    document.title = (mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Reset password' : 'Sign in') + ' · Kosh';
  }, [mode]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setFieldErr({});
    setAuthNotice(null);
  };

  const checkFields = (needPassword: boolean, strict: boolean) => {
    const e = validateEmail(email);
    const p = needPassword ? (strict ? validateNewPassword(password) : password ? null : 'Enter your password.') : null;
    setFieldErr({ email: e ?? undefined, password: p ?? undefined });
    if (e) emailRef.current?.focus();
    return !e && !p;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setError(null);
    const supabase = requireSupabase();
    if (mode === 'forgot') {
      if (!checkFields(false, false)) return;
      setBusy('password');
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: origin() + '/reset-password' });
      setBusy(null);
      if (error) return setError(friendlyAuthError(error));
      setSent({ kind: 'reset', email: email.trim() });
      return;
    }
    if (!checkFields(true, mode === 'signup')) return;
    setBusy('password');
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setBusy(null);
      if (error) setError(friendlyAuthError(error));
      // On success, onAuthStateChange swaps this screen for the app.
      return;
    }
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: origin() } });
    setBusy(null);
    if (error) return setError(friendlyAuthError(error));
    // With email confirmation on, an existing address comes back as a user with no identities.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return setError('An account with this email already exists. Sign in instead.');
    }
    if (!data.session) setSent({ kind: 'confirm', email: email.trim() });
  };

  const magic = async () => {
    setError(null);
    if (!checkFields(false, false)) return;
    setBusy('magic');
    const { error } = await requireSupabase().auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: origin(), shouldCreateUser: false } });
    setBusy(null);
    if (error) return setError(friendlyAuthError(error));
    setSent({ kind: 'magic', email: email.trim() });
  };

  if (sent) return <AuthLayout testId="auth-screen"><SentPanel sent={sent} onBack={() => { setSent(null); switchMode('signin'); }} /></AuthLayout>;

  const title = mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset your password';
  const subtitle =
    mode === 'signin' ? 'Sign in to pick up where you left off.' : mode === 'signup' ? 'Free, private and synced across your devices.' : "Enter your email and we'll send you a link to choose a new password.";
  const score = passwordScore(password);

  return (
    <AuthLayout testId="auth-screen">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        {mode === 'forgot' ? (
          <button type="button" onClick={() => switchMode('signin')} className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg" data-testid="auth-back">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back to sign in
          </button>
        ) : (
          <div role="tablist" aria-label="Account" className="mb-7 grid grid-cols-2 rounded-xl border border-line bg-surface-2 p-1">
            {(['signin', 'signup'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                id={ids.tabs + m}
                aria-selected={mode === m}
                aria-controls={ids.tabs + 'panel'}
                data-testid={'auth-tab-' + m}
                onClick={() => switchMode(m)}
                className={cn('relative h-9 rounded-lg text-sm font-medium transition-colors', mode === m ? 'text-fg' : 'text-muted hover:text-fg')}
              >
                {mode === m && <motion.span layoutId="auth-tab" className="absolute inset-0 rounded-lg border border-line bg-surface shadow-sm" transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }} />}
                <span className="relative">{m === 'signin' ? 'Sign in' : 'Create account'}</span>
              </button>
            ))}
          </div>
        )}
        <div id={ids.tabs + 'panel'} role={mode === 'forgot' ? undefined : 'tabpanel'} aria-labelledby={mode === 'forgot' ? undefined : ids.tabs + mode}>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
          <p className="mt-1.5 text-sm text-muted">{subtitle}</p>

          {notice && <Banner tone={notice.tone} testId="auth-notice">{notice.text}</Banner>}

          <form onSubmit={submit} noValidate className="mt-6 space-y-4" aria-describedby={error ? ids.err : undefined}>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.email} className="text-xs font-medium text-muted">Email</label>
              <input
                ref={emailRef}
                id={ids.email}
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(e) => { setEmail(e.target.value); setFieldErr((f) => ({ ...f, email: undefined })); }}
                placeholder="you@example.com"
                className={cn(inputClass, 'h-11', fieldErr.email && 'border-danger')}
                aria-invalid={!!fieldErr.email}
                aria-describedby={fieldErr.email ? ids.email + 'e' : undefined}
                data-testid="auth-email"
              />
              {fieldErr.email && <p id={ids.email + 'e'} className="text-xs text-danger" data-testid="auth-email-error">{fieldErr.email}</p>}
            </div>
            {mode !== 'forgot' && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor={ids.password} className="text-xs font-medium text-muted">Password</label>
                  {mode === 'signin' && (
                    <button type="button" onClick={() => switchMode('forgot')} className="text-xs font-medium text-accent hover:underline" data-testid="auth-forgot">
                      Forgot password?
                    </button>
                  )}
                </div>
                <PasswordInput
                  id={ids.password}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setFieldErr((f) => ({ ...f, password: undefined })); }}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
                  aria-invalid={!!fieldErr.password}
                  aria-describedby={fieldErr.password ? ids.password + 'e' : mode === 'signup' ? ids.password + 'h' : undefined}
                  className={fieldErr.password ? 'border-danger' : undefined}
                  data-testid="auth-password"
                />
                {fieldErr.password ? (
                  <p id={ids.password + 'e'} className="text-xs text-danger" data-testid="auth-password-error">{fieldErr.password}</p>
                ) : mode === 'signup' ? (
                  <div id={ids.password + 'h'} className="flex items-center gap-2" aria-live="polite">
                    <div className="flex flex-1 gap-1" aria-hidden>
                      {[0, 1, 2, 3].map((i) => (
                        <span key={i} className={cn('h-1 flex-1 rounded-full transition-colors', i < score ? (score <= 1 ? 'bg-danger' : score === 2 ? 'bg-warning' : 'bg-accent') : 'bg-surface-3')} />
                      ))}
                    </div>
                    <span className="w-28 text-right text-xs text-muted">{password ? ['Too short', 'Weak', 'Okay', 'Strong', 'Very strong'][score] : '8+ chars, letters & numbers'}</span>
                  </div>
                ) : null}
              </div>
            )}

            <AnimatePresence initial={false}>
              {error && (
                <motion.div key="err" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <p id={ids.err} role="alert" data-testid="auth-error" className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>{error}</span>
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={!!busy} aria-busy={busy === 'password'} data-testid="auth-submit">
              {busy === 'password' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {mode === 'signin' ? (busy ? 'Signing in…' : 'Sign in') : mode === 'signup' ? (busy ? 'Creating account…' : 'Create account') : busy ? 'Sending…' : 'Send reset link'}
            </Button>
            {mode === 'signin' && (
              <>
                <div className="flex items-center gap-3 text-xs text-subtle" aria-hidden>
                  <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
                </div>
                <Button variant="secondary" size="lg" className="w-full" onClick={() => void magic()} disabled={!!busy} aria-busy={busy === 'magic'} data-testid="auth-magic-link" icon={busy === 'magic' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}>
                  Email me a sign-in link
                </Button>
              </>
            )}
          </form>
          <p className="mt-6 text-center text-sm text-muted">
            {mode === 'signup' ? (
              <>Already have an account? <button type="button" className="font-semibold text-accent hover:underline" onClick={() => switchMode('signin')}>Sign in</button></>
            ) : mode === 'signin' ? (
              <>New to Kosh? <button type="button" className="font-semibold text-accent hover:underline" onClick={() => switchMode('signup')}>Create an account</button></>
            ) : null}
          </p>
        </div>
      </motion.div>
    </AuthLayout>
  );
}

function Banner({ tone, children, testId }: { tone: 'info' | 'error' | 'success'; children: ReactNode; testId?: string }) {
  const Icon = tone === 'error' ? AlertCircle : tone === 'success' ? CheckCircle2 : Info;
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      data-testid={testId}
      className={cn(
        'mt-5 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm',
        tone === 'error' ? 'border-danger/30 bg-danger-soft text-danger' : 'border-line bg-accent-soft text-fg',
      )}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', tone !== 'error' && 'text-accent')} aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function SentPanel({ sent, onBack }: { sent: NonNullable<Sent>; onBack: () => void }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);
  const resend = async () => {
    setError(null);
    setState('busy');
    const auth = requireSupabase().auth;
    const { error } =
      sent.kind === 'confirm'
        ? await auth.resend({ type: 'signup', email: sent.email, options: { emailRedirectTo: origin() } })
        : sent.kind === 'magic'
          ? await auth.signInWithOtp({ email: sent.email, options: { emailRedirectTo: origin(), shouldCreateUser: false } })
          : await auth.resetPasswordForEmail(sent.email, { redirectTo: origin() + '/reset-password' });
    if (error) {
      setState('idle');
      setError(friendlyAuthError(error));
      return;
    }
    setState('done');
    setCooldown(30);
  };
  const copy = {
    confirm: { title: 'Check your email', body: 'We sent a confirmation link to', after: 'Open it on this device to activate your account and sign in.' },
    magic: { title: 'Check your email', body: 'We sent a sign-in link to', after: 'Open it on this device to sign in. The link expires in an hour.' },
    reset: { title: 'Check your email', body: 'If an account exists, we sent a password reset link to', after: 'Open it on this device to choose a new password.' },
  }[sent.kind];
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center" data-testid={sent.kind === 'reset' ? 'reset-sent' : sent.kind === 'magic' ? 'magic-sent' : 'check-email'}>
      <div className="relative mx-auto mb-6 w-fit">
        <div className="absolute inset-0 -m-4 rounded-full bg-accent-soft blur-2xl" aria-hidden />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-gradient-to-b from-surface-2 to-surface text-accent shadow-sm">
          <MailCheck className="h-7 w-7" aria-hidden />
        </div>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
      <p className="mt-2 text-sm text-muted">
        {copy.body} <span className="font-semibold break-all text-fg" data-testid="sent-email">{sent.email}</span>.
      </p>
      <p className="mt-1 text-sm text-muted">{copy.after}</p>
      {error && <Banner tone="error" testId="auth-error">{error}</Banner>}
      {state === 'done' && <Banner tone="success" testId="resend-done">Sent again. It can take a minute to arrive — check spam too.</Banner>}
      <div className="mt-8 flex flex-col gap-2">
        <Button variant="secondary" size="lg" className="w-full" onClick={() => void resend()} disabled={state === 'busy' || cooldown > 0} data-testid="auth-resend" icon={state === 'busy' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Mail className="h-4 w-4" aria-hidden />}>
          {cooldown > 0 ? 'Resend in ' + cooldown + 's' : 'Resend email'}
        </Button>
        <Button variant="ghost" size="lg" className="w-full" onClick={onBack} data-testid="auth-back">
          Back to sign in
        </Button>
      </div>
    </motion.div>
  );
}
