import type { Account, Category, Transaction } from '../../store/types';
import { toCSV, downloadFile } from '../../lib/csv';
import { paiseToInput } from '../../lib/money';
import { todayISO } from '../../lib/dates';

export const EXPORT_HEADER = ['date', 'type', 'amount', 'category', 'account', 'to_account', 'payee', 'note', 'tags'];

export function exportTransactionsCSV(txs: Transaction[], cats: Map<string, Category>, accs: Map<string, Account>, name = 'kosh-transactions'): void {
  const rows = [EXPORT_HEADER];
  for (const t of txs) {
    rows.push([
      t.date,
      t.type,
      paiseToInput(t.amount),
      t.categoryId ? cats.get(t.categoryId)?.name ?? '' : '',
      accs.get(t.accountId)?.name ?? '',
      t.toAccountId ? accs.get(t.toAccountId)?.name ?? '' : '',
      t.payee,
      t.note,
      t.tags.join(';'),
    ]);
  }
  downloadFile(name + '-' + todayISO() + '.csv', toCSV(rows), 'text/csv;charset=utf-8');
}
