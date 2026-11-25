import type { CurrencyCode, Paise } from '../lib/money';
import type { ISODate } from '../lib/dates';
import type { Frequency } from '../lib/recurring';

export type TxType = 'income' | 'expense' | 'transfer';
export type CategoryKind = 'expense' | 'income';
export type AccountType = 'cash' | 'bank' | 'card' | 'wallet';
export type ThemePref = 'dark' | 'light' | 'system';

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  icon: string;
  color: string;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  openingBalance: Paise;
  color: string;
  archived: boolean;
}

export interface Transaction {
  id: string;
  type: TxType;
  amount: Paise; // always positive
  categoryId: string | null; // null for transfers
  accountId: string;
  toAccountId: string | null; // transfers only
  date: ISODate;
  payee: string;
  note: string;
  tags: string[];
  recurringId: string | null;
  createdAt: number;
}

export interface Budget {
  id: string;
  categoryId: string | null; // null = overall monthly budget
  amount: Paise;
}

export interface RecurringRule {
  id: string;
  title: string;
  type: 'income' | 'expense';
  amount: Paise;
  categoryId: string;
  accountId: string;
  frequency: Frequency;
  interval: number;
  startDate: ISODate;
  endDate: ISODate | null;
  autoPost: boolean;
  isSubscription: boolean;
  /** Occurrences up to and including this date have been posted (or skipped). */
  postedThrough: ISODate | null;
  active: boolean;
}

export interface GoalContribution {
  id: string;
  date: ISODate;
  amount: Paise;
  note: string;
}

export interface Goal {
  id: string;
  name: string;
  target: Paise;
  targetDate: ISODate | null;
  emoji: string;
  color: string;
  contributions: GoalContribution[];
  createdAt: number;
}

export interface Settings {
  currency: CurrencyCode;
  theme: ThemePref;
  name: string;
  lastAccountId: string | null;
}

export interface DataState {
  categories: Category[];
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  recurring: RecurringRule[];
  goals: Goal[];
}

export interface Backup extends DataState {
  app: 'kosh';
  version: 1;
  exportedAt: string;
  settings: Settings;
}
