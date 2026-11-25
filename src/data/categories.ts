import type { Category } from '../store/types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat_food', name: 'Food & Dining', kind: 'expense', icon: 'utensils', color: '#f97316' },
  { id: 'cat_groceries', name: 'Groceries', kind: 'expense', icon: 'basket', color: '#22c55e' },
  { id: 'cat_transport', name: 'Transport', kind: 'expense', icon: 'car', color: '#3b82f6' },
  { id: 'cat_shopping', name: 'Shopping', kind: 'expense', icon: 'bag', color: '#ec4899' },
  { id: 'cat_bills', name: 'Bills & Utilities', kind: 'expense', icon: 'zap', color: '#eab308' },
  { id: 'cat_rent', name: 'Rent', kind: 'expense', icon: 'home', color: '#8b5cf6' },
  { id: 'cat_entertainment', name: 'Entertainment', kind: 'expense', icon: 'clapperboard', color: '#f43f5e' },
  { id: 'cat_subscriptions', name: 'Subscriptions', kind: 'expense', icon: 'repeat', color: '#a855f7' },
  { id: 'cat_health', name: 'Health', kind: 'expense', icon: 'heart', color: '#ef4444' },
  { id: 'cat_education', name: 'Education', kind: 'expense', icon: 'graduation', color: '#0ea5e9' },
  { id: 'cat_travel', name: 'Travel', kind: 'expense', icon: 'plane', color: '#06b6d4' },
  { id: 'cat_investments', name: 'Investments', kind: 'expense', icon: 'trending', color: '#14b8a6' },
  { id: 'cat_gifts', name: 'Gifts', kind: 'expense', icon: 'gift', color: '#d946ef' },
  { id: 'cat_personal', name: 'Personal care', kind: 'expense', icon: 'sparkles', color: '#84cc16' },
  { id: 'cat_other', name: 'Other', kind: 'expense', icon: 'more', color: '#64748b' },
  { id: 'cat_salary', name: 'Salary', kind: 'income', icon: 'briefcase', color: '#10b981' },
  { id: 'cat_freelance', name: 'Freelance', kind: 'income', icon: 'laptop', color: '#22d3ee' },
  { id: 'cat_interest', name: 'Interest', kind: 'income', icon: 'percent', color: '#a3e635' },
  { id: 'cat_refund', name: 'Refund', kind: 'income', icon: 'refund', color: '#60a5fa' },
  { id: 'cat_other_income', name: 'Other income', kind: 'income', icon: 'piggy', color: '#94a3b8' },
];

export const FALLBACK_EXPENSE_CATEGORY = 'cat_other';
export const FALLBACK_INCOME_CATEGORY = 'cat_other_income';
