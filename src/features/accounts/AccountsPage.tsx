import { useMemo, useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { Archive, ArchiveRestore, Pencil, Plus, Wallet } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button, IconButton } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Field, Input, Select, useFieldId } from '../../components/ui/Field';
import { EmptyState } from '../../components/ui/EmptyState';
import { AccountIcon } from '../../components/ui/CategoryIcon';
import { CountUp, useFormatMoney } from '../../components/ui/Money';
import { ColorPicker } from '../../components/ui/ColorPicker';
import { useStore } from '../../store/store';
import { useUI } from '../../store/ui';
import type { Account, AccountType } from '../../store/types';
import { accountBalances } from '../../lib/analytics';
import { ACCOUNT_TYPE_LABEL, PALETTE } from '../../data/icons';
import { parseAmount, paiseToInput } from '../../lib/money';
import { cn } from '../../lib/cn';

export default function AccountsPage() {
  const accounts = useStore((s) => s.accounts);
  const txs = useStore((s) => s.transactions);
  const setArchived = useStore((s) => s.setAccountArchived);
  const toast = useUI((s) => s.toast);
  const fmt = useFormatMoney();
  const [editing, setEditing] = useState<Account | null>(null);
  const [open, setOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const balances = useMemo(() => accountBalances(accounts, txs), [accounts, txs]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of txs) {
      m.set(t.accountId, (m.get(t.accountId) ?? 0) + 1);
      if (t.toAccountId) m.set(t.toAccountId, (m.get(t.toAccountId) ?? 0) + 1);
    }
    return m;
  }, [txs]);
  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);
  const total = accounts.reduce((s, a) => s + (balances.get(a.id) ?? 0), 0);
  const assets = accounts.reduce((s, a) => s + Math.max(0, balances.get(a.id) ?? 0), 0);
  const liabilities = accounts.reduce((s, a) => s + Math.min(0, balances.get(a.id) ?? 0), 0);
  const list = showArchived ? [...active, ...archived] : active;

  return (
    <div>
      <PageHeader
        title="Accounts"
        subtitle="Cash, bank accounts, cards and wallets"
        actions={<Button variant="primary" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => { setEditing(null); setOpen(true); }} data-testid="add-account">Add account</Button>}
      />
      {accounts.length === 0 ? (
        <Card>
          <EmptyState icon={Wallet} title="No accounts yet" description="Add where your money lives — cash, a savings account, a credit card or a UPI wallet." action={<Button variant="primary" onClick={() => { setEditing(null); setOpen(true); }}>Add your first account</Button>} />
        </Card>
      ) : (
        <>
          <Card className="mb-6 overflow-hidden bg-gradient-to-br from-accent-soft to-transparent p-5 sm:p-6" data-testid="net-worth">
            <div className="text-sm text-muted">Net worth</div>
            <div className={cn('mt-1 text-3xl font-semibold tracking-tight sm:text-4xl', total < 0 && 'text-danger')}>
              <CountUp value={total} format={(v) => fmt(v)} />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span className="text-muted">Assets <span className="font-medium text-fg tnum">{fmt(assets, { decimals: 0 })}</span></span>
              <span className="text-muted">Liabilities <span className="font-medium text-fg tnum">{fmt(-liabilities, { decimals: 0 })}</span></span>
            </div>
          </Card>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((a, i) => {
              const bal = balances.get(a.id) ?? 0;
              return (
                <motion.li key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <Card className={cn('relative overflow-hidden p-5', a.archived && 'opacity-60')} data-testid="account-card">
                    <div className="absolute inset-x-0 top-0 h-1" style={{ background: a.color }} aria-hidden />
                    <div className="flex items-center gap-3">
                      <AccountIcon type={a.type} color={a.color} />
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate font-semibold">{a.name}</h2>
                        <p className="text-xs text-subtle">{ACCOUNT_TYPE_LABEL[a.type]}{a.archived ? ' · Archived' : ''}</p>
                      </div>
                      <IconButton label={'Edit ' + a.name} size="icon-sm" onClick={() => { setEditing(a); setOpen(true); }}><Pencil className="h-4 w-4" /></IconButton>
                      <IconButton label={(a.archived ? 'Unarchive ' : 'Archive ') + a.name} size="icon-sm" onClick={() => { setArchived(a.id, !a.archived); toast({ message: a.name + (a.archived ? ' restored' : ' archived') }); }}>
                        {a.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                      </IconButton>
                    </div>
                    <div className={cn('mt-5 text-2xl font-semibold tracking-tight tnum', bal < 0 && 'text-danger')} data-testid="account-balance">{fmt(bal)}</div>
                    <div className="mt-1 text-xs text-subtle">
                      {a.type === 'card' && bal < 0 ? 'Outstanding · ' : ''}
                      {counts.get(a.id) ?? 0} transactions · opening {fmt(a.openingBalance, { decimals: 0 })}
                    </div>
                  </Card>
                </motion.li>
              );
            })}
          </ul>
          {archived.length > 0 && (
            <div className="mt-4 flex justify-center">
              <Button variant="ghost" onClick={() => setShowArchived((v) => !v)}>{showArchived ? 'Hide' : 'Show'} archived ({archived.length})</Button>
            </div>
          )}
        </>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit account' : 'New account'} size="sm" testId="account-modal">
        <AccountForm key={(editing?.id ?? 'new') + String(open)} account={editing} onClose={() => setOpen(false)} />
      </Modal>
    </div>
  );
}

function AccountForm({ account, onClose }: { account: Account | null; onClose: () => void }) {
  const save = useStore((s) => s.saveAccount);
  const toast = useUI((s) => s.toast);
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? 'bank');
  const [opening, setOpening] = useState(account ? paiseToInput(account.openingBalance) : '');
  const [color, setColor] = useState(account?.color ?? PALETTE[2]);
  const [err, setErr] = useState('');
  const ids = { n: useFieldId('an'), t: useFieldId('at'), o: useFieldId('ao') };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setErr('Name the account.');
    const ob = opening.trim() === '' ? 0 : parseAmount(opening);
    if (ob === null) return setErr('Opening balance must be a number.');
    save({ id: account?.id, name: name.trim(), type, openingBalance: ob, color, archived: account?.archived ?? false });
    toast({ message: 'Account saved', tone: 'success' });
    onClose();
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Name" htmlFor={ids.n}><Input id={ids.n} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HDFC Savings" data-autofocus data-testid="account-name" /></Field>
      <Field label="Type" htmlFor={ids.t}>
        <Select id={ids.t} value={type} onChange={(e) => setType(e.target.value as AccountType)} data-testid="account-type">
          {(Object.keys(ACCOUNT_TYPE_LABEL) as AccountType[]).map((t) => <option key={t} value={t}>{ACCOUNT_TYPE_LABEL[t]}</option>)}
        </Select>
      </Field>
      <Field label="Opening balance" htmlFor={ids.o} hint={type === 'card' ? 'Use a negative number for an outstanding card balance' : undefined}>
        <Input id={ids.o} inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value)} placeholder="0" data-testid="account-opening" />
      </Field>
      <ColorPicker value={color} onChange={setColor} />
      {err && <p role="alert" className="text-sm text-danger">{err}</p>}
      <div className="flex justify-end"><Button type="submit" variant="primary" data-testid="account-submit">Save account</Button></div>
    </form>
  );
}
