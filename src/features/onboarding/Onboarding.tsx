import { useId, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Banknote, Check, CreditCard, Landmark, PartyPopper, Smartphone, Sparkles } from 'lucide-react';
import { AuthLayout } from '../../auth/AuthLayout';
import { Button } from '../../components/ui/Button';
import { Field, Input, useFieldId } from '../../components/ui/Field';
import { useStore } from '../../store/store';
import { useAuth } from '../../auth/auth';
import type { AccountType } from '../../store/types';
import { CURRENCIES, CURRENCY_META, formatMoney, parseAmount, type CurrencyCode } from '../../lib/money';
import { ACCOUNT_TYPE_LABEL } from '../../data/icons';
import { cn } from '../../lib/cn';
import { navigate } from '../../router';

const STEPS = ['Welcome', 'Your name', 'Currency', 'First account', 'Done'] as const;
const TYPE_ICON: Record<AccountType, typeof Landmark> = { bank: Landmark, cash: Banknote, card: CreditCard, wallet: Smartphone };
const TYPE_DEFAULT_NAME: Record<AccountType, string> = { bank: 'Savings account', cash: 'Cash', card: 'Credit card', wallet: 'UPI wallet' };

export function Onboarding() {
  const existingName = useStore((s) => s.settings.name);
  const existingCurrency = useStore((s) => s.settings.currency);
  const complete = useStore((s) => s.completeOnboarding);
  const email = useAuth((s) => s.user?.email ?? '');
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [name, setName] = useState(existingName || '');
  const [currency, setCurrency] = useState<CurrencyCode>(existingCurrency || 'INR');
  const [accType, setAccType] = useState<AccountType>('bank');
  const [accName, setAccName] = useState('');
  const [opening, setOpening] = useState('');
  const [err, setErr] = useState('');
  const ids = { name: useFieldId('on'), acc: useFieldId('oa'), ob: useFieldId('oo') };
  const curGroup = useId();

  const go = (n: number) => {
    setErr('');
    setDir(n > step ? 1 : -1);
    setStep(n);
  };
  const openingPaise = opening.trim() === '' ? 0 : parseAmount(opening);

  const submitName = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setErr('Tell us what to call you.');
    go(2);
  };
  const submitAccount = (e: FormEvent) => {
    e.preventDefault();
    if (openingPaise === null) return setErr('Opening balance must be a number, like 25,000.');
    go(4);
  };
  const finish = () => {
    complete({ name, currency, account: { name: accName.trim() || TYPE_DEFAULT_NAME[accType], type: accType, openingBalance: openingPaise ?? 0 } });
    navigate('/', { replace: true });
  };

  return (
    <AuthLayout testId="onboarding" wide>
      <div className="mb-8 flex items-center gap-2" aria-label={'Step ' + (step + 1) + ' of ' + STEPS.length + ': ' + STEPS[step]} role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1}>
        {STEPS.map((s, i) => (
          <span key={s} className={cn('h-1.5 flex-1 rounded-full transition-colors duration-300', i <= step ? 'bg-accent' : 'bg-surface-3')} />
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false} custom={dir}>
        <motion.div
          key={step}
          custom={dir}
          initial={{ opacity: 0, x: 24 * dir }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 * dir }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          data-testid={'onb-step-' + step}
        >
          {step === 0 && (
            <div>
              <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent" aria-hidden><Sparkles className="h-6 w-6" /></span>
              <h1 className="text-3xl font-semibold tracking-tight">Welcome to Kosh</h1>
              <p className="mt-2 text-base text-muted">
                You're signed in{email ? <> as <span className="font-medium text-fg">{email}</span></> : null}. Let's set things up — it takes under a minute.
              </p>
              <ul className="mt-6 space-y-2.5 text-sm text-muted">
                {['Pick your name and currency', 'Add where your money lives', 'Start tracking — everything syncs to your account'].map((t) => (
                  <li key={t} className="flex items-center gap-2.5"><Check className="h-4 w-4 text-accent" aria-hidden /> {t}</li>
                ))}
              </ul>
              <Button variant="primary" size="lg" className="mt-8 w-full sm:w-auto" onClick={() => go(1)} data-testid="onb-start" icon={<ArrowRight className="h-4 w-4" aria-hidden />}>
                Get started
              </Button>
            </div>
          )}
          {step === 1 && (
            <form onSubmit={submitName} noValidate>
              <h1 className="text-2xl font-semibold tracking-tight">What should we call you?</h1>
              <p className="mt-1.5 text-sm text-muted">Used for your dashboard greeting. You can change it later in Settings.</p>
              <Field label="Display name" htmlFor={ids.name} className="mt-6">
                <Input id={ids.name} value={name} onChange={(e) => { setName(e.target.value.slice(0, 40)); setErr(''); }} placeholder="e.g. Priya" autoComplete="given-name" autoFocus className="h-11" data-testid="onb-name" aria-invalid={!!err} />
              </Field>
              {err && <p role="alert" className="mt-2 text-sm text-danger" data-testid="onb-error">{err}</p>}
              <StepNav onBack={() => go(0)} />
            </form>
          )}
          {step === 2 && (
            <form onSubmit={(e) => { e.preventDefault(); go(3); }}>
              <h1 className="text-2xl font-semibold tracking-tight" id={curGroup}>Your currency</h1>
              <p className="mt-1.5 text-sm text-muted">Amounts are shown in this currency.</p>
              <div role="radiogroup" aria-labelledby={curGroup} className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CURRENCIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={currency === c}
                    onClick={() => setCurrency(c)}
                    data-testid={'onb-currency-' + c}
                    className={cn('flex flex-col items-start rounded-2xl border p-3 text-left transition-colors', currency === c ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong')}
                  >
                    <span className="text-lg font-semibold">{CURRENCY_META[c].symbol} <span className="text-sm font-medium text-muted">{c}</span></span>
                    <span className="mt-0.5 text-xs text-muted">{CURRENCY_META[c].label}</span>
                  </button>
                ))}
              </div>
              <StepNav onBack={() => go(1)} />
            </form>
          )}
          {step === 3 && (
            <form onSubmit={submitAccount} noValidate>
              <h1 className="text-2xl font-semibold tracking-tight">Add your first account</h1>
              <p className="mt-1.5 text-sm text-muted">Where does your money live? Add more accounts any time.</p>
              <fieldset className="mt-6">
                <legend className="mb-2 text-xs font-medium text-muted">Account type</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Account type">
                  {(Object.keys(ACCOUNT_TYPE_LABEL) as AccountType[]).map((t) => {
                    const I = TYPE_ICON[t];
                    return (
                      <button
                        key={t}
                        type="button"
                        role="radio"
                        aria-checked={accType === t}
                        onClick={() => setAccType(t)}
                        data-testid={'onb-type-' + t}
                        className={cn('flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-sm font-medium transition-colors', accType === t ? 'border-accent bg-accent-soft text-fg' : 'border-line text-muted hover:border-line-strong hover:text-fg')}
                      >
                        <I className={cn('h-5 w-5', accType === t && 'text-accent')} aria-hidden />
                        {ACCOUNT_TYPE_LABEL[t]}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Account name" htmlFor={ids.acc}>
                  <Input id={ids.acc} value={accName} onChange={(e) => setAccName(e.target.value.slice(0, 80))} placeholder={TYPE_DEFAULT_NAME[accType]} className="h-11" data-testid="onb-account-name" />
                </Field>
                <Field label={accType === 'card' ? 'Current balance (negative if owed)' : 'Opening balance'} htmlFor={ids.ob} hint={openingPaise !== null && opening ? formatMoney(openingPaise, currency) : undefined}>
                  <Input id={ids.ob} inputMode="decimal" value={opening} onChange={(e) => { setOpening(e.target.value); setErr(''); }} placeholder="0" className="h-11" data-testid="onb-opening" aria-invalid={!!err} />
                </Field>
              </div>
              {err && <p role="alert" className="mt-2 text-sm text-danger" data-testid="onb-error">{err}</p>}
              <StepNav onBack={() => go(2)} />
            </form>
          )}
          {step === 4 && (
            <div className="text-center sm:text-left">
              <span className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent sm:mx-0" aria-hidden><PartyPopper className="h-6 w-6" /></span>
              <h1 className="text-3xl font-semibold tracking-tight">You're all set{name.trim() ? ', ' + name.trim() : ''}!</h1>
              <p className="mt-2 text-base text-muted">Here's what we'll create in your account:</p>
              <dl className="card mt-6 divide-y divide-line text-left text-sm">
                <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-muted">Currency</dt><dd className="font-medium">{CURRENCY_META[currency].label} ({currency})</dd></div>
                <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-muted">Account</dt><dd className="font-medium">{accName.trim() || TYPE_DEFAULT_NAME[accType]} · {ACCOUNT_TYPE_LABEL[accType]}</dd></div>
                <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-muted">Opening balance</dt><dd className="font-medium tnum">{formatMoney(openingPaise ?? 0, currency)}</dd></div>
                <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-muted">Categories</dt><dd className="font-medium">Food, Rent, Salary and 17 more</dd></div>
              </dl>
              <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                <Button variant="ghost" onClick={() => go(3)} icon={<ArrowLeft className="h-4 w-4" aria-hidden />}>Back</Button>
                <Button variant="primary" size="lg" className="sm:ml-auto" onClick={finish} data-testid="onb-finish" icon={<Check className="h-4 w-4" aria-hidden />}>
                  Go to my dashboard
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </AuthLayout>
  );
}

function StepNav({ onBack }: { onBack: () => void }) {
  return (
    <div className="mt-8 flex items-center gap-2">
      <Button variant="ghost" onClick={onBack} icon={<ArrowLeft className="h-4 w-4" aria-hidden />}>Back</Button>
      <Button type="submit" variant="primary" size="lg" className="ml-auto" data-testid="onb-next" icon={<ArrowRight className="h-4 w-4" aria-hidden />}>
        Continue
      </Button>
    </div>
  );
}
