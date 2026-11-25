import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Trash2, Wallet } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select, useFieldId } from '../../components/ui/Field';
import { Segmented } from '../../components/ui/Segmented';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { useStore } from '../../store/store';
import { useUI } from '../../store/ui';
import type { TxType } from '../../store/types';
import { parseAmount, paiseToInput, CURRENCY_META, cleanAmountText } from '../../lib/money';
import { todayISO } from '../../lib/dates';
import { cn } from '../../lib/cn';
import { navigate } from '../../router';
import { useDeleteTransaction } from './useDeleteTransaction';

export function QuickAdd() {
  const { open, editing, presetType } = useUI((s) => s.quickAdd);
  const close = useUI((s) => s.closeQuickAdd);
  const amountRef = useRef<HTMLInputElement>(null);
  return (
    <Modal open={open} onClose={close} title={editing ? 'Edit transaction' : 'New transaction'} testId="quick-add-modal" initialFocusRef={amountRef}>
      <QuickAddForm key={(editing?.id ?? 'new') + presetType} amountRef={amountRef} />
    </Modal>
  );
}

function QuickAddForm({ amountRef }: { amountRef: React.RefObject<HTMLInputElement | null> }) {
  const { editing, presetType } = useUI((s) => s.quickAdd);
  const close = useUI((s) => s.closeQuickAdd);
  const toast = useUI((s) => s.toast);
  const categories = useStore((s) => s.categories);
  const accounts = useStore((s) => s.accounts);
  const transactions = useStore((s) => s.transactions);
  const settings = useStore((s) => s.settings);
  const addTransaction = useStore((s) => s.addTransaction);
  const updateTransaction = useStore((s) => s.updateTransaction);
  const del = useDeleteTransaction();

  const activeAccounts = accounts.filter((a) => !a.archived || a.id === editing?.accountId || a.id === editing?.toAccountId);
  const defaultAccount = (settings.lastAccountId && activeAccounts.find((a) => a.id === settings.lastAccountId)?.id) || activeAccounts[0]?.id || '';

  const [type, setType] = useState<TxType>(editing?.type ?? presetType);
  const [amount, setAmount] = useState(editing ? paiseToInput(editing.amount) : '');
  const [categoryId, setCategoryId] = useState<string>(editing?.categoryId ?? '');
  const [accountId, setAccountId] = useState(editing?.accountId ?? defaultAccount);
  const [toAccountId, setToAccountId] = useState(editing?.toAccountId ?? activeAccounts.find((a) => a.id !== defaultAccount)?.id ?? '');
  const [date, setDate] = useState(editing?.date ?? todayISO());
  const [payee, setPayee] = useState(editing?.payee ?? '');
  const [note, setNote] = useState(editing?.note ?? '');
  const [tags, setTags] = useState((editing?.tags ?? []).join(', '));
  const [error, setError] = useState<string | null>(null);

  const kindCats = useMemo(() => categories.filter((c) => c.kind === (type === 'income' ? 'income' : 'expense')), [categories, type]);

  // Frequency-sorted categories: most used first for quick chips
  const sortedCats = useMemo(() => {
    const freq = new Map<string, number>();
    for (const t of transactions.slice(-300)) if (t.categoryId) freq.set(t.categoryId, (freq.get(t.categoryId) ?? 0) + 1);
    return [...kindCats].sort((a, b) => (freq.get(b.id) ?? 0) - (freq.get(a.id) ?? 0));
  }, [kindCats, transactions]);

  useEffect(() => {
    if (type === 'transfer') return;
    if (!kindCats.some((c) => c.id === categoryId)) setCategoryId(sortedCats[0]?.id ?? '');
  }, [type, kindCats, sortedCats, categoryId]);

  // Payee suggestions from history
  const payees = useMemo(() => {
    const s = new Set<string>();
    for (let i = transactions.length - 1; i >= 0 && s.size < 60; i--) if (transactions[i].payee) s.add(transactions[i].payee);
    return [...s];
  }, [transactions]);

  const idAmount = useFieldId('amount');
  const idPayee = useFieldId('payee');
  const idAccount = useFieldId('account');
  const idTo = useFieldId('to');
  const idDate = useFieldId('date');
  const idNote = useFieldId('note');
  const idTags = useFieldId('tags');
  const listId = useFieldId('payees');

  if (activeAccounts.length === 0) {
    return (
      <div className="flex flex-col items-center py-6 text-center" data-testid="quick-add-no-accounts">
        <Wallet className="mb-3 h-8 w-8 text-accent" aria-hidden />
        <p className="font-medium">Add an account first</p>
        <p className="mt-1 text-sm text-muted">Transactions belong to an account like Cash, a bank or a card.</p>
        <Button
          variant="primary"
          className="mt-4"
          onClick={() => {
            close();
            navigate('/accounts');
          }}
        >
          Go to accounts
        </Button>
      </div>
    );
  }

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const paise = parseAmount(amount);
    if (paise === null || paise <= 0) return setError('Enter an amount greater than zero.');
    if (!accountId) return setError('Choose an account.');
    if (type === 'transfer' && (!toAccountId || toAccountId === accountId)) return setError('Choose a different destination account.');
    if (type !== 'transfer' && !categoryId) return setError('Choose a category.');
    const data = {
      type,
      amount: paise,
      categoryId: type === 'transfer' ? null : categoryId,
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : null,
      date,
      payee: payee.trim() || (type === 'transfer' ? 'Transfer' : categories.find((c) => c.id === categoryId)?.name ?? ''),
      note: note.trim(),
      tags: tags.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean),
      recurringId: editing?.recurringId ?? null,
    };
    if (editing) {
      updateTransaction(editing.id, data);
      toast({ message: 'Transaction updated', tone: 'success' });
    } else {
      addTransaction(data);
      toast({ message: (type === 'income' ? 'Income' : type === 'transfer' ? 'Transfer' : 'Expense') + ' added', tone: 'success' });
    }
    close();
  };

  const symbol = CURRENCY_META[settings.currency].symbol;

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <Segmented<TxType>
        label="Transaction type"
        value={type}
        onChange={setType}
        className="w-full"
        options={[
          { value: 'expense', label: 'Expense', testId: 'type-expense' },
          { value: 'income', label: 'Income', testId: 'type-income' },
          { value: 'transfer', label: 'Transfer', testId: 'type-transfer' },
        ]}
      />
      <div className="rounded-2xl border border-line bg-surface-2 px-4 py-4 text-center">
        <label htmlFor={idAmount} className="text-xs font-medium text-muted">
          Amount
        </label>
        <div className="mt-1 flex items-center justify-center gap-2">
          <span className={cn('text-3xl font-semibold', type === 'income' ? 'text-income' : 'text-subtle')} aria-hidden>
            {symbol}
          </span>
          <input
            ref={amountRef}
            id={idAmount}
            data-testid="amount-input"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value={amount}
            onChange={(e) => {
              setError(null);
              setAmount(cleanAmountText(e.target.value).replace('-', ''));
            }}
            className="w-full max-w-[14ch] bg-transparent text-center text-4xl font-semibold tracking-tight text-fg tnum placeholder:text-subtle focus:outline-none sm:text-5xl"
            aria-invalid={!!error && !parseAmount(amount)}
          />
        </div>
      </div>

      {type !== 'transfer' && (
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-muted">Category</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Category">
            {sortedCats.map((c) => {
              const active = c.id === categoryId;
              return (
                <motion.button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  data-testid={'category-chip-' + c.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setCategoryId(c.id)}
                  className={cn('flex items-center gap-1.5 rounded-full border py-1 pr-3 pl-1 text-sm transition-colors', active ? 'border-transparent text-fg' : 'border-line text-muted hover:border-line-strong hover:text-fg')}
                  style={active ? { background: 'color-mix(in oklab, ' + c.color + ' 18%, transparent)', boxShadow: 'inset 0 0 0 1.5px ' + c.color } : undefined}
                >
                  <CategoryIcon category={c} size="sm" className="!h-6 !w-6 !rounded-full" />
                  {c.name}
                </motion.button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={type === 'transfer' ? 'From account' : 'Account'} htmlFor={idAccount}>
          <Select id={idAccount} value={accountId} onChange={(e) => setAccountId(e.target.value)} data-testid="account-select">
            {activeAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        {type === 'transfer' ? (
          <Field label="To account" htmlFor={idTo}>
            <div className="flex items-center gap-2">
              <ArrowRight className="hidden h-4 w-4 text-subtle" aria-hidden />
              <div className="flex-1">
                <Select id={idTo} value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} data-testid="to-account-select">
                  <option value="">Select…</option>
                  {activeAccounts
                    .filter((a) => a.id !== accountId)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </Select>
              </div>
            </div>
          </Field>
        ) : (
          <Field label="Date" htmlFor={idDate}>
            <Input id={idDate} type="date" value={date} onChange={(e) => setDate(e.target.value || todayISO())} data-testid="date-input" />
          </Field>
        )}
        <Field label={type === 'income' ? 'From / source' : type === 'transfer' ? 'Title' : 'Payee'} htmlFor={idPayee}>
          <Input id={idPayee} value={payee} onChange={(e) => setPayee(e.target.value)} placeholder={type === 'income' ? 'e.g. Acme Technologies' : 'e.g. Swiggy'} list={listId} data-testid="payee-input" autoComplete="off" />
          <datalist id={listId}>
            {payees.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Field>
        {type === 'transfer' && (
          <Field label="Date" htmlFor={idDate}>
            <Input id={idDate} type="date" value={date} onChange={(e) => setDate(e.target.value || todayISO())} data-testid="date-input" />
          </Field>
        )}
        <Field label="Tags" htmlFor={idTags} hint="Comma separated" className={type === 'transfer' ? 'sm:col-span-2' : ''}>
          <Input id={idTags} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="weekend, goa-trip" data-testid="tags-input" />
        </Field>
        <Field label="Note" htmlFor={idNote} className="sm:col-span-2">
          <Input id={idNote} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" data-testid="note-input" />
        </Field>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger" data-testid="form-error">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        {editing && (
          <Button
            variant="ghost"
            className="text-danger hover:text-danger"
            icon={<Trash2 className="h-4 w-4" aria-hidden />}
            onClick={() => {
              close();
              del(editing.id);
            }}
            data-testid="delete-transaction"
          >
            Delete
          </Button>
        )}
        <span className="ml-auto hidden text-xs text-subtle sm:inline">
          Press <kbd className="rounded border border-line px-1">Enter</kbd> to save
        </span>
        <Button type="submit" variant="primary" size="lg" data-testid="submit-transaction" className="min-w-32">
          {editing ? 'Save changes' : 'Add ' + type}
        </Button>
      </div>
    </form>
  );
}
