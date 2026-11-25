import { LayoutDashboard, ArrowLeftRight, PieChart, Repeat, Target, Lightbulb, Wallet, Settings, type LucideIcon } from 'lucide-react';
import type { RoutePath } from '../../router';

export interface NavItem {
  path: RoutePath;
  label: string;
  icon: LucideIcon;
  id: string;
}
export const NAV: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, id: 'dashboard' },
  { path: '/transactions', label: 'Transactions', icon: ArrowLeftRight, id: 'transactions' },
  { path: '/budgets', label: 'Budgets', icon: PieChart, id: 'budgets' },
  { path: '/recurring', label: 'Recurring', icon: Repeat, id: 'recurring' },
  { path: '/goals', label: 'Goals', icon: Target, id: 'goals' },
  { path: '/insights', label: 'Insights', icon: Lightbulb, id: 'insights' },
  { path: '/accounts', label: 'Accounts', icon: Wallet, id: 'accounts' },
  { path: '/settings', label: 'Settings', icon: Settings, id: 'settings' },
];
export const MOBILE_PRIMARY: RoutePath[] = ['/', '/transactions', '/budgets', '/insights'];
