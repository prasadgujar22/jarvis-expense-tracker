import type { DataState, RecurringRule, Transaction } from './types';
import type { ISODate } from '../lib/dates';
import { occurrencesBetween } from '../lib/recurring';

export function occurrenceTxId(ruleId: string, date: ISODate): string {
  return 'rec:' + ruleId + ':' + date;
}

export function txFromRule(rule: RecurringRule, date: ISODate): Transaction {
  return {
    id: occurrenceTxId(rule.id, date),
    type: rule.type,
    amount: rule.amount,
    categoryId: rule.categoryId,
    accountId: rule.accountId,
    toAccountId: null,
    date,
    payee: rule.title,
    note: '',
    tags: rule.isSubscription ? ['subscription'] : ['recurring'],
    recurringId: rule.id,
    createdAt: Date.parse(date + 'T09:00:00') || Date.now(),
  };
}

/**
 * Auto-post due occurrences for rules with autoPost. Idempotent:
 * - only occurrences after postedThrough are considered
 * - deterministic ids prevent duplicates even if postedThrough was lost
 */
export function generateDue(state: DataState, today: ISODate): DataState {
  const existing = new Set(state.transactions.map((t) => t.id));
  const created: Transaction[] = [];
  let changed = false;
  const recurring = state.recurring.map((rule) => {
    if (!rule.active || !rule.autoPost) return rule;
    const due = occurrencesBetween(rule, rule.postedThrough, today);
    if (due.length === 0) return rule;
    for (const d of due) {
      const id = occurrenceTxId(rule.id, d);
      if (!existing.has(id)) {
        existing.add(id);
        created.push(txFromRule(rule, d));
      }
    }
    changed = true;
    return { ...rule, postedThrough: due[due.length - 1] };
  });
  if (!changed) return state;
  return { ...state, recurring, transactions: [...state.transactions, ...created] };
}
