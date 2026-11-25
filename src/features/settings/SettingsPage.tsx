import { useRef, useState, type FormEvent } from 'react';
import { Database, Download, FileJson, FileUp, Pencil, Plus, RotateCcw, Trash2, Upload } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button, IconButton } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Field, Input, Select, useFieldId } from '../../components/ui/Field';
import { Segmented } from '../../components/ui/Segmented';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { ColorPicker } from '../../components/ui/ColorPicker';
import { useAccountMap, useCategoryMap, useStore } from '../../store/store';
import { useUI } from '../../store/ui';
import type { Category, CategoryKind, ThemePref } from '../../store/types';
import { CURRENCIES, CURRENCY_META, formatMoney, type CurrencyCode } from '../../lib/money';
import { ICON_KEYS, iconFor, PALETTE } from '../../data/icons';
import { FALLBACK_EXPENSE_CATEGORY, FALLBACK_INCOME_CATEGORY } from '../../data/categories';
import { exportTransactionsCSV } from '../data/csvExport';
import { downloadFile } from '../../lib/csv';
import { todayISO } from '../../lib/dates';
import { validBackup } from '../../store/validate';
import { CsvImport } from './CsvImport';
import { cn } from '../../lib/cn';

export default function SettingsPage() {
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const ids = { name: useFieldId('sn'), cur: useFieldId('sc') };
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Preferences, categories and your data" />
      <Card aria-labelledby="pref-h">
        <CardHeader id="pref-h" title="Preferences" />
        <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-3">
          <Field label="Your name" htmlFor={ids.name} hint="Used for the dashboard greeting">
            <Input id={ids.name} value={settings.name} onChange={(e) => update({ name: e.target.value.slice(0, 40) })} placeholder="Name" data-testid="settings-name" />
          </Field>
          <Field label="Display currency" htmlFor={ids.cur} hint={'Preview: ' + formatMoney(12345678, settings.currency)}>
            <Select id={ids.cur} value={settings.currency} onChange={(e) => update({ currency: e.target.value as CurrencyCode })} data-testid="settings-currency">
              {CURRENCIES.map((c) => <option key={c} value={c}>{c} — {CURRENCY_META[c].label}</option>)}
            </Select>
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted" id="theme-label">Theme</span>
            <Segmented<ThemePref>
              label="Theme"
              value={settings.theme}
              onChange={(v) => update({ theme: v })}
              options={[{ value: 'dark', label: 'Dark', testId: 'theme-dark' }, { value: 'light', label: 'Light', testId: 'theme-light' }, { value: 'system', label: 'System', testId: 'theme-system' }]}
            />
          </div>
        </div>
      </Card>
      <CategoriesCard />
      <DataCard />
      <p className="pb-4 text-center text-xs text-subtle">Kosh v1.0 · Every rupee, accounted for. · Data stored locally on this device.</p>
    </div>
  );
}

function CategoriesCard() {
  const categories = useStore((s) => s.categories);
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [editing, setEditing] = useState<Category | null>(null);
  const [open, setOpen] = useState(false);
  const list = categories.filter((c) => c.kind === kind);
  return (
    <Card aria-labelledby="cat-h">
      <CardHeader
        id="cat-h"
        title="Categories"
        subtitle={categories.length + ' categories'}
        action={<Button size="sm" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => { setEditing(null); setOpen(true); }} data-testid="add-category">Add</Button>}
      />
      <div className="p-5">
        <Segmented label="Category type" value={kind} onChange={setKind} size="sm" options={[{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }]} />
        <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2" data-testid="category-item">
              <CategoryIcon category={c} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
              <IconButton label={'Edit ' + c.name} size="icon-sm" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></IconButton>
            </li>
          ))}
        </ul>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit category' : 'New category'} testId="category-modal">
        <CategoryForm key={(editing?.id ?? 'new') + String(open)} cat={editing} defaultKind={kind} onClose={() => setOpen(false)} />
      </Modal>
    </Card>
  );
}

function CategoryForm({ cat, defaultKind, onClose }: { cat: Category | null; defaultKind: CategoryKind; onClose: () => void }) {
  const save = useStore((s) => s.saveCategory);
  const del = useStore((s) => s.deleteCategory);
  const toast = useUI((s) => s.toast);
  const [name, setName] = useState(cat?.name ?? '');
  const [kind, setKind] = useState<CategoryKind>(cat?.kind ?? defaultKind);
  const [color, setColor] = useState(cat?.color ?? PALETTE[0]);
  const [icon, setIcon] = useState(cat?.icon ?? 'tag');
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState('');
  const nameId = useFieldId('cn');
  const protectedCat = cat && (cat.id === FALLBACK_EXPENSE_CATEGORY || cat.id === FALLBACK_INCOME_CATEGORY);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setErr('Name is required.');
    save({ id: cat?.id, name: name.trim(), kind, color, icon });
    toast({ message: 'Category saved', tone: 'success' });
    onClose();
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-end gap-3">
        <CategoryIcon category={{ icon, color }} size="lg" />
        <Field label="Name" htmlFor={nameId} className="flex-1">
          <Input id={nameId} value={name} onChange={(e) => setName(e.target.value)} data-autofocus data-testid="category-name" />
        </Field>
      </div>
      {!cat && <Segmented label="Kind" value={kind} onChange={setKind} options={[{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }]} />}
      <ColorPicker value={color} onChange={setColor} />
      <fieldset>
        <legend className="mb-2 text-xs font-medium text-muted">Icon</legend>
        <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
          {ICON_KEYS.map((k) => {
            const I = iconFor(k);
            return (
              <button key={k} type="button" aria-label={'Icon ' + k} aria-pressed={icon === k} onClick={() => setIcon(k)} className={cn('flex h-9 w-9 items-center justify-center rounded-lg border', icon === k ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:text-fg')}>
                <I className="h-4 w-4" aria-hidden />
              </button>
            );
          })}
        </div>
      </fieldset>
      {err && <p role="alert" className="text-sm text-danger">{err}</p>}
      <div className="flex items-center justify-between gap-2">
        {cat && !protectedCat ? <Button variant="ghost" className="text-danger" onClick={() => setConfirm(true)}>Delete</Button> : <span />}
        <Button type="submit" variant="primary" data-testid="category-submit">Save</Button>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title="Delete category?" description={'Transactions in "' + (cat?.name ?? '') + '" will move to Other.'} confirmLabel="Delete" onConfirm={() => { if (cat) { del(cat.id); toast({ message: 'Category deleted' }); onClose(); } }} />
    </form>
  );
}

function DataCard() {
  const txs = useStore((s) => s.transactions);
  const exportBackup = useStore((s) => s.exportBackup);
  const restoreBackup = useStore((s) => s.restoreBackup);
  const resetDemo = useStore((s) => s.resetDemo);
  const clearAll = useStore((s) => s.clearAll);
  const cats = useCategoryMap();
  const accs = useAccountMap();
  const toast = useUI((s) => s.toast);
  const [importOpen, setImportOpen] = useState(false);
  const [confirm, setConfirm] = useState<'reset' | 'clear' | null>(null);
  const [pendingRestore, setPendingRestore] = useState<ReturnType<typeof validBackup>>(null);
  const jsonRef = useRef<HTMLInputElement>(null);

  const onJson = async (f: File | undefined) => {
    if (!f) return;
    try {
      const b = validBackup(JSON.parse(await f.text()) as unknown);
      if (!b) throw new Error('invalid');
      setPendingRestore(b);
    } catch {
      toast({ message: 'That file is not a valid Kosh backup', tone: 'danger' });
    } finally {
      if (jsonRef.current) jsonRef.current.value = '';
    }
  };

  const rows = [
    { icon: Download, title: 'Export transactions (CSV)', desc: 'All ' + txs.length + ' transactions. Filtered export is on the Transactions page.', action: <Button size="sm" disabled={!txs.length} onClick={() => { exportTransactionsCSV([...txs].sort((a, b) => (a.date < b.date ? 1 : -1)), cats, accs); toast({ message: 'CSV exported', tone: 'success' }); }} data-testid="settings-export-csv">Export</Button> },
    { icon: FileUp, title: 'Import transactions (CSV)', desc: 'Map columns and preview before importing.', action: <Button size="sm" onClick={() => setImportOpen(true)} data-testid="settings-import-csv">Import</Button> },
    { icon: FileJson, title: 'Full backup (JSON)', desc: 'Everything: accounts, budgets, goals, recurring and settings.', action: <Button size="sm" onClick={() => { downloadFile('kosh-backup-' + todayISO() + '.json', JSON.stringify(exportBackup(), null, 2), 'application/json'); toast({ message: 'Backup downloaded', tone: 'success' }); }} data-testid="backup-json">Download</Button> },
    {
      icon: Upload, title: 'Restore from backup', desc: 'Replaces all current data with the backup file.',
      action: (
        <>
          <input ref={jsonRef} type="file" accept="application/json,.json" className="sr-only" aria-label="Choose backup file" onChange={(e) => void onJson(e.target.files?.[0])} data-testid="restore-json-input" tabIndex={-1} />
          <Button size="sm" onClick={() => jsonRef.current?.click()} data-testid="restore-json">Restore</Button>
        </>
      ),
    },
    { icon: RotateCcw, title: 'Reset to demo data', desc: 'Replace everything with fresh sample data ending today.', action: <Button size="sm" onClick={() => setConfirm('reset')} data-testid="reset-demo">Reset</Button> },
    { icon: Trash2, title: 'Clear all data', desc: 'Delete every account, transaction, budget and goal on this device.', action: <Button size="sm" variant="danger" onClick={() => setConfirm('clear')} data-testid="clear-all">Clear</Button>, danger: true },
  ];

  return (
    <Card aria-labelledby="data-h">
      <CardHeader id="data-h" title="Your data" subtitle="Stored only in this browser. Back it up regularly." action={<Database className="h-5 w-5 text-subtle" aria-hidden />} />
      <ul className="divide-y divide-line p-2">
        {rows.map((r) => (
          <li key={r.title} className="flex items-center gap-3 px-3 py-3">
            <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', r.danger ? 'bg-danger-soft text-danger' : 'bg-surface-2 text-muted')} aria-hidden><r.icon className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{r.title}</div>
              <div className="text-xs text-subtle">{r.desc}</div>
            </div>
            {r.action}
          </li>
        ))}
      </ul>
      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Import CSV" description="Supports Kosh exports and simple bank CSVs (date, amount, description, category)." size="lg" testId="csv-import-modal">
        <CsvImport onDone={() => setImportOpen(false)} />
      </Modal>
      <ConfirmDialog open={confirm === 'reset'} onClose={() => setConfirm(null)} title="Reset to demo data?" description="All your current data will be replaced with sample data. This can't be undone." confirmLabel="Reset" onConfirm={() => { resetDemo(); toast({ message: 'Demo data restored', tone: 'success' }); }} />
      <ConfirmDialog open={confirm === 'clear'} onClose={() => setConfirm(null)} title="Clear all data?" description="This permanently deletes all accounts, transactions, budgets, recurring rules and goals from this device." confirmLabel="Clear everything" onConfirm={() => { clearAll(); toast({ message: 'All data cleared' }); }} />
      <ConfirmDialog open={!!pendingRestore} onClose={() => setPendingRestore(null)} title="Restore backup?" description={pendingRestore ? 'Replace current data with ' + pendingRestore.transactions.length + ' transactions and ' + pendingRestore.accounts.length + ' accounts from the backup.' : ''} confirmLabel="Restore" danger={false} onConfirm={() => { if (pendingRestore) { restoreBackup(pendingRestore); toast({ message: 'Backup restored', tone: 'success' }); } }} />
    </Card>
  );
}
