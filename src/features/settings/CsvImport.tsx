import { useMemo, useState } from 'react';
import { FileUp } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Field, Select, useFieldId } from '../../components/ui/Field';
import { Segmented } from '../../components/ui/Segmented';
import { useStore, type NewTransaction } from '../../store/store';
import { useUI } from '../../store/ui';
import { parseCSVRows, unguardFormula, type CSVRow } from '../../lib/csv';
import { parseLooseDate } from '../../lib/dates';
import { parseAmount } from '../../lib/money';
import { PALETTE } from '../../data/icons';
import { FALLBACK_EXPENSE_CATEGORY, FALLBACK_INCOME_CATEGORY } from '../../data/categories';
import { useFormatMoney } from '../../components/ui/Money';
import { cn } from '../../lib/cn';

const FIELDS = [
  { key: 'date', label: 'Date', required: true, guess: ['date', 'txn date', 'transaction date', 'value date'] },
  { key: 'amount', label: 'Amount', required: true, guess: ['amount', 'amt', 'value', 'inr'] },
  { key: 'payee', label: 'Description / payee', required: false, guess: ['payee', 'description', 'narration', 'title', 'details', 'merchant'] },
  { key: 'category', label: 'Category', required: false, guess: ['category'] },
  { key: 'type', label: 'Type', required: false, guess: ['type', 'dr/cr', 'cr/dr', 'kind'] },
  { key: 'account', label: 'Account', required: false, guess: ['account', 'from account'] },
  { key: 'to_account', label: 'To account', required: false, guess: ['to_account', 'to account'] },
  { key: 'note', label: 'Note', required: false, guess: ['note', 'notes', 'memo', 'remarks'] },
  { key: 'tags', label: 'Tags', required: false, guess: ['tags', 'labels'] },
] as const;
type FieldKey = (typeof FIELDS)[number]['key'];

interface Parsed {
  ok: boolean;
  line: number;
  duplicate?: boolean;
  error?: string;
  tx?: NewTransaction;
  newCategory?: { name: string; kind: 'income' | 'expense' };
}

export function CsvImport({ onDone }: { onDone: () => void }) {
  const [rows, setRows] = useState<CSVRow[] | null>(null);
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const transactions = useStore((s) => s.transactions);
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState<Record<FieldKey, number>>({} as Record<FieldKey, number>);
  const [positiveIs, setPositiveIs] = useState<'expense' | 'income'>('expense');
  const accounts = useStore((s) => s.accounts);
  const categories = useStore((s) => s.categories);
  const [defaultAccount, setDefaultAccount] = useState(accounts.find((a) => !a.archived)?.id ?? '');
  const importTransactions = useStore((s) => s.importTransactions);
  const saveCategory = useStore((s) => s.saveCategory);
  const toast = useUI((s) => s.toast);
  const fmt = useFormatMoney();
  const fileId = useFieldId('csv');
  const accId = useFieldId('csvacc');
  const header = rows?.[0]?.cells ?? [];
  const body = useMemo(() => rows?.slice(1) ?? [], [rows]);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const text = await f.text();
    const parsed = parseCSVRows(text);
    if (parsed.length < 2) {
      toast({ message: 'That file has no data rows', tone: 'danger' });
      return;
    }
    setFileName(f.name);
    setRows(parsed);
    setIncludeDuplicates(false);
    const h = parsed[0].cells.map((x) => x.trim().toLowerCase());
    const m = {} as Record<FieldKey, number>;
    for (const fd of FIELDS) m[fd.key] = h.findIndex((x) => (fd.guess as readonly string[]).includes(x));
    setMapping(m);
    const amtCol = m.amount;
    const hasNeg = amtCol >= 0 && parsed.slice(1).some((r) => /^\s*[-−]/.test(r.cells[amtCol] ?? ''));
    setPositiveIs(hasNeg ? 'income' : 'expense');
  };

  const catByName = useMemo(() => new Map(categories.map((c) => [c.name.toLowerCase() + '|' + c.kind, c])), [categories]);
  const accByName = useMemo(() => new Map(accounts.map((a) => [a.name.toLowerCase(), a])), [accounts]);

  // Existing transactions, keyed loosely, to flag rows that were already imported or entered.
  const existingKeys = useMemo(() => {
    const s = new Set<string>();
    for (const t of transactions) s.add(dupKey(t.date, t.type, t.amount, t.payee, t.accountId));
    return s;
  }, [transactions]);

  const parsed: Parsed[] = useMemo(() => {
    const get = (r: string[], k: FieldKey) => (mapping[k] >= 0 ? unguardFormula((r[mapping[k]] ?? '').trim()) : '');
    return body.map(({ cells: r, line }): Parsed => {
      const date = parseLooseDate(get(r, 'date'));
      if (!date) return { ok: false, line, error: 'Invalid date' };
      const raw = parseAmount(get(r, 'amount'));
      if (raw === null || raw === 0) return { ok: false, line, error: 'Invalid amount' };
      const typeRaw = get(r, 'type').toLowerCase();
      let type: NewTransaction['type'];
      if (typeRaw === 'income' || typeRaw === 'credit' || typeRaw === 'cr') type = 'income';
      else if (typeRaw === 'expense' || typeRaw === 'debit' || typeRaw === 'dr') type = 'expense';
      else if (typeRaw === 'transfer') type = 'transfer';
      else type = raw < 0 ? (positiveIs === 'income' ? 'expense' : 'income') : positiveIs;
      const accName = get(r, 'account').toLowerCase();
      const acc = (accName && accByName.get(accName)?.id) || defaultAccount;
      if (!acc) return { ok: false, line, error: 'No account' };
      let toAccountId: string | null = null;
      if (type === 'transfer') {
        toAccountId = accByName.get(get(r, 'to_account').toLowerCase())?.id ?? null;
        if (!toAccountId || toAccountId === acc) return { ok: false, line, error: 'Unknown to-account' };
      }
      const kind = type === 'income' ? 'income' : 'expense';
      const catName = get(r, 'category');
      let categoryId: string | null = null;
      let newCategory: Parsed['newCategory'];
      if (type !== 'transfer') {
        const found = catName ? catByName.get(catName.toLowerCase() + '|' + kind) : undefined;
        if (found) categoryId = found.id;
        else if (catName) {
          categoryId = 'new:' + kind + ':' + catName.toLowerCase();
          newCategory = { name: catName, kind };
        } else categoryId = kind === 'income' ? FALLBACK_INCOME_CATEGORY : FALLBACK_EXPENSE_CATEGORY;
      }
      const payee = get(r, 'payee');
      return {
        ok: true,
        line,
        duplicate: existingKeys.has(dupKey(date, type, Math.abs(raw), payee, acc)),
        newCategory,
        tx: {
          type, amount: Math.abs(raw), date, accountId: acc, toAccountId, categoryId,
          payee, note: get(r, 'note'),
          tags: get(r, 'tags').split(/[;,]/).map((t) => t.trim()).filter(Boolean),
          recurringId: null,
        },
      };
    });
  }, [body, mapping, positiveIs, defaultAccount, accByName, catByName, existingKeys]);

  const duplicates = parsed.filter((p) => p.ok && p.duplicate).length;
  const valid = parsed.filter((p) => p.ok && (includeDuplicates || !p.duplicate));
  const canImport = valid.length > 0 && mapping.date >= 0 && mapping.amount >= 0;

  const doImport = () => {
    const created = new Map<string, string>();
    let ci = 0;
    for (const p of valid) {
      if (p.newCategory && p.tx?.categoryId && !created.has(p.tx.categoryId)) {
        const c = saveCategory({ name: p.newCategory.name, kind: p.newCategory.kind, icon: 'tag', color: PALETTE[ci++ % PALETTE.length] });
        created.set(p.tx.categoryId, c.id);
      }
    }
    const txs = valid.map((p) => {
      const t = p.tx!;
      return t.categoryId && created.has(t.categoryId) ? { ...t, categoryId: created.get(t.categoryId)! } : t;
    });
    const n = importTransactions(txs);
    const skipped = includeDuplicates ? 0 : duplicates;
    toast({ message: 'Imported ' + n + ' transactions' + (created.size ? ' · ' + created.size + ' new categories' : '') + (skipped ? ' · skipped ' + skipped + ' duplicates' : ''), tone: 'success' });
    onDone();
  };

  if (accounts.length === 0) return <p className="text-sm text-muted">Add an account before importing transactions.</p>;

  return (
    <div className="space-y-5">
      <label htmlFor={fileId} className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong px-4 py-8 text-center hover:border-accent hover:bg-accent-soft">
        <FileUp className="h-6 w-6 text-accent" aria-hidden />
        <span className="text-sm font-medium">{fileName || 'Choose a CSV file'}</span>
        <span className="text-xs text-subtle">Kosh export format, or any CSV with date, amount, description, category</span>
        <input id={fileId} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} data-testid="csv-file-input" />
      </label>
      {rows && (
        <>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Column mapping</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {FIELDS.map((fd) => (
                <MapSelect key={fd.key} label={fd.label + (fd.required ? ' *' : '')} header={header} value={mapping[fd.key] ?? -1} onChange={(v) => setMapping((m) => ({ ...m, [fd.key]: v }))} />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Default account" htmlFor={accId}>
              <Select id={accId} value={defaultAccount} onChange={(e) => setDefaultAccount(e.target.value)}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
            {mapping.type < 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted">Positive amounts are</span>
                <Segmented label="Positive amounts are" value={positiveIs} onChange={setPositiveIs} options={[{ value: 'expense', label: 'Expenses' }, { value: 'income', label: 'Income' }]} />
              </div>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Preview <span className="font-normal text-muted" data-testid="csv-summary">· {valid.length} of {parsed.length} rows will be imported</span></h3>
            {duplicates > 0 && (
              <div role="status" className="mb-3 flex flex-col gap-2 rounded-xl bg-warning-soft px-3 py-2 text-sm text-fg sm:flex-row sm:items-center sm:justify-between" data-testid="csv-duplicates">
                <span>{duplicates} row{duplicates === 1 ? ' looks' : 's look'} like {duplicates === 1 ? 'a transaction' : 'transactions'} you already have (same date, type, amount, payee and account).</span>
                <label className="flex shrink-0 items-center gap-2 text-muted">
                  <input type="checkbox" checked={includeDuplicates} onChange={(e) => setIncludeDuplicates(e.target.checked)} className="h-4 w-4 accent-[var(--k-accent)]" data-testid="csv-include-duplicates" />
                  Import them anyway
                </label>
              </div>
            )}
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[480px] text-xs" data-testid="csv-preview">
                <thead className="bg-surface-2 text-left text-muted">
                  <tr><th className="px-3 py-2 font-medium">Date</th><th className="px-3 py-2 font-medium">Type</th><th className="px-3 py-2 font-medium">Description</th><th className="px-3 py-2 font-medium">Category</th><th className="px-3 py-2 text-right font-medium">Amount</th></tr>
                </thead>
                <tbody>
                  {parsed.slice(0, 6).map((p, i) => (
                    <tr key={i} className={cn('border-t border-line', !p.ok && 'text-danger', p.ok && p.duplicate && !includeDuplicates && 'text-subtle line-through')} data-testid="csv-preview-row" data-duplicate={p.duplicate ? 'true' : undefined}>
                      {p.ok && p.tx ? (
                        <>
                          <td className="px-3 py-2 tnum">{p.tx.date}</td>
                          <td className="px-3 py-2 capitalize">{p.tx.type}</td>
                          <td className="max-w-40 truncate px-3 py-2">{p.tx.payee || '—'}</td>
                          <td className="px-3 py-2">{p.newCategory ? p.newCategory.name + ' (new)' : categories.find((c) => c.id === p.tx?.categoryId)?.name ?? '—'}</td>
                          <td className="px-3 py-2 text-right tnum">{fmt(p.tx.amount)}</td>
                        </>
                      ) : (
                        <td colSpan={5} className="px-3 py-2">Line {p.line}: {p.error} — will be skipped</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="primary" disabled={!canImport} onClick={doImport} data-testid="csv-import-confirm">Import {valid.length} transactions</Button>
          </div>
        </>
      )}
    </div>
  );
}

function dupKey(date: string, type: string, amount: number, payee: string, accountId: string): string {
  return [date, type, amount, payee.trim().toLowerCase(), accountId].join('|');
}

function MapSelect({ label, header, value, onChange }: { label: string; header: string[]; value: number; onChange: (v: number) => void }) {
  const id = useFieldId('map');
  return (
    <Field label={label} htmlFor={id}>
      <Select id={id} value={value} onChange={(e) => onChange(Number(e.target.value))}>
        <option value={-1}>— Not mapped —</option>
        {header.map((h, i) => <option key={i} value={i}>{h || 'Column ' + (i + 1)}</option>)}
      </Select>
    </Field>
  );
}
