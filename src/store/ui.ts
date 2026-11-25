import { create } from 'zustand';
import type { Transaction, TxType } from './types';

export interface Toast {
  id: number;
  message: string;
  tone?: 'default' | 'success' | 'danger';
  action?: { label: string; onClick: () => void };
  duration?: number;
}

interface QuickAddState {
  open: boolean;
  editing: Transaction | null;
  presetType: TxType;
}

interface UIStore {
  toasts: Toast[];
  quickAdd: QuickAddState;
  paletteOpen: boolean;
  toast(t: Omit<Toast, 'id'>): number;
  dismiss(id: number): void;
  openQuickAdd(opts?: { editing?: Transaction | null; type?: TxType }): void;
  closeQuickAdd(): void;
  setPalette(open: boolean): void;
}

let nextId = 1;
export const useUI = create<UIStore>()((set) => ({
  toasts: [],
  quickAdd: { open: false, editing: null, presetType: 'expense' },
  paletteOpen: false,
  toast(t) {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }));
    return id;
  },
  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
  openQuickAdd(opts) {
    set({ quickAdd: { open: true, editing: opts?.editing ?? null, presetType: opts?.editing?.type ?? opts?.type ?? 'expense' } });
  },
  closeQuickAdd() {
    set((s) => ({ quickAdd: { ...s.quickAdd, open: false } }));
  },
  setPalette(open) {
    set({ paletteOpen: open });
  },
}));
