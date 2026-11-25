import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, ArrowRight, Sun } from 'lucide-react';
import { Modal } from './ui/Modal';
import { NAV } from './layout/nav';
import { navigate } from '../router';
import { useUI } from '../store/ui';
import { useCategoryMap, useStore } from '../store/store';
import { CategoryIcon } from './ui/CategoryIcon';
import { useFormatMoney } from './ui/Money';
import { formatShort } from '../lib/dates';
import { cn } from '../lib/cn';

interface Item {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
  group: string;
}

export function CommandPalette() {
  const open = useUI((s) => s.paletteOpen);
  const setOpen = useUI((s) => s.setPalette);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Search and commands" hideTitle testId="command-palette" initialFocusRef={inputRef}>
      <PaletteBody inputRef={inputRef} onDone={() => setOpen(false)} />
    </Modal>
  );
}

function PaletteBody({ inputRef, onDone }: { inputRef: React.RefObject<HTMLInputElement | null>; onDone: () => void }) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const openQuickAdd = useUI((s) => s.openQuickAdd);
  const txs = useStore((s) => s.transactions);
  const theme = useStore((s) => s.settings.theme);
  const updateSettings = useStore((s) => s.updateSettings);
  const cats = useCategoryMap();
  const fmt = useFormatMoney();
  const listRef = useRef<HTMLUListElement>(null);

  const items = useMemo<Item[]>(() => {
    const needle = q.trim().toLowerCase();
    const actions: Item[] = [
      { id: 'a-expense', group: 'Actions', label: 'Add expense', icon: <Plus className="h-4 w-4" />, run: () => openQuickAdd({ type: 'expense' }) },
      { id: 'a-income', group: 'Actions', label: 'Add income', icon: <Plus className="h-4 w-4" />, run: () => openQuickAdd({ type: 'income' }) },
      { id: 'a-transfer', group: 'Actions', label: 'Add transfer', icon: <Plus className="h-4 w-4" />, run: () => openQuickAdd({ type: 'transfer' }) },
      { id: 'a-theme', group: 'Actions', label: 'Toggle theme', hint: theme, icon: <Sun className="h-4 w-4" />, run: () => updateSettings({ theme: theme === 'dark' ? 'light' : 'dark' }) },
    ];
    const nav: Item[] = NAV.map((n) => ({ id: 'n-' + n.id, group: 'Go to', label: n.label, icon: <n.icon className="h-4 w-4" />, run: () => navigate(n.path) }));
    const base = [...nav, ...actions].filter((i) => !needle || i.label.toLowerCase().includes(needle));
    if (!needle) return base;
    const matches: Item[] = [];
    for (let i = txs.length - 1; i >= 0 && matches.length < 8; i--) {
      const t = txs[i];
      const hay = (t.payee + ' ' + t.note + ' ' + t.tags.join(' ')).toLowerCase();
      if (!hay.includes(needle)) continue;
      const c = t.categoryId ? cats.get(t.categoryId) : null;
      matches.push({
        id: 't-' + t.id,
        group: 'Transactions',
        label: t.payee || 'Untitled',
        hint: formatShort(t.date) + ' · ' + fmt(t.amount),
        icon: <CategoryIcon category={c} size="sm" className="!h-5 !w-5" />,
        run: () => openQuickAdd({ editing: t }),
      });
    }
    const searchAll: Item = { id: 's-all', group: 'Transactions', label: 'Search all transactions for "' + q.trim() + '"', icon: <Search className="h-4 w-4" />, run: () => navigate('/transactions?q=' + encodeURIComponent(q.trim())) };
    return [...base, ...matches, searchAll];
  }, [q, txs, cats, fmt, openQuickAdd, theme, updateSettings]);

  useEffect(() => setIdx(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  const run = (i: Item) => {
    onDone();
    // let the palette close before opening another modal
    window.setTimeout(i.run, 10);
  };

  let lastGroup = '';
  return (
    <div className="-mx-5 -my-4">
      <div className="flex items-center gap-2 border-b border-line px-4">
        <Search className="h-4 w-4 text-subtle" aria-hidden />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search transactions, pages, actions…"
          aria-label="Search"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={items[idx] ? 'pi-' + items[idx].id : undefined}
          data-testid="command-input"
          className="h-14 flex-1 bg-transparent text-base text-fg placeholder:text-subtle focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setIdx((i) => Math.min(items.length - 1, i + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setIdx((i) => Math.max(0, i - 1));
            } else if (e.key === 'Enter' && items[idx]) {
              e.preventDefault();
              run(items[idx]);
            }
          }}
        />
        <kbd className="rounded-md border border-line px-1.5 py-0.5 text-[10px] text-muted">Esc</kbd>
      </div>
      <ul id="palette-list" role="listbox" ref={listRef} className="max-h-[50dvh] overflow-y-auto p-2" aria-label="Results">
        {items.map((it, i) => {
          const header = it.group !== lastGroup ? it.group : null;
          lastGroup = it.group;
          return (
            <li key={it.id} role="presentation">
              {header && <div className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-subtle uppercase">{header}</div>}
              <div
                id={'pi-' + it.id}
                role="option"
                aria-selected={i === idx}
                data-active={i === idx}
                onMouseMove={() => setIdx(i)}
                onClick={() => run(it)}
                className={cn('flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm', i === idx ? 'bg-surface-2 text-fg' : 'text-muted')}
              >
                <span className="text-subtle" aria-hidden>
                  {it.icon}
                </span>
                <span className="flex-1 truncate">{it.label}</span>
                {it.hint && <span className="text-xs text-subtle tnum">{it.hint}</span>}
                {i === idx && <ArrowRight className="h-3.5 w-3.5 text-subtle" aria-hidden />}
              </div>
            </li>
          );
        })}
        {items.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted">No results</li>}
      </ul>
    </div>
  );
}
