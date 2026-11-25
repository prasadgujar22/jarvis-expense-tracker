import { useStore } from '../../store/store';
import { useUI } from '../../store/ui';

export function useDeleteTransaction() {
  const del = useStore((s) => s.deleteTransaction);
  const restore = useStore((s) => s.restoreTransaction);
  const toast = useUI((s) => s.toast);
  return (id: string) => {
    const tx = del(id);
    if (!tx) return;
    toast({ message: 'Transaction deleted', action: { label: 'Undo', onClick: () => restore(tx) } });
  };
}
