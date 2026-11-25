import {
  Utensils, ShoppingBasket, Car, ShoppingBag, Zap, Home, Clapperboard, Repeat, HeartPulse, GraduationCap,
  Plane, TrendingUp, Gift, Sparkles, CircleEllipsis, Briefcase, Laptop, Percent, RotateCcw, PiggyBank,
  Coffee, Fuel, Smartphone, Dumbbell, PawPrint, Baby, Shirt, Wifi, Landmark, Wallet, CreditCard, Banknote,
  Music, Gamepad2, Book, Bus, Train, Stethoscope, Hammer, Tag,
  type LucideIcon,
} from 'lucide-react';
import type { AccountType } from '../store/types';

export const ICONS: Record<string, LucideIcon> = {
  utensils: Utensils, basket: ShoppingBasket, car: Car, bag: ShoppingBag, zap: Zap, home: Home,
  clapperboard: Clapperboard, repeat: Repeat, heart: HeartPulse, graduation: GraduationCap, plane: Plane,
  trending: TrendingUp, gift: Gift, sparkles: Sparkles, more: CircleEllipsis, briefcase: Briefcase,
  laptop: Laptop, percent: Percent, refund: RotateCcw, piggy: PiggyBank, coffee: Coffee, fuel: Fuel,
  phone: Smartphone, dumbbell: Dumbbell, paw: PawPrint, baby: Baby, shirt: Shirt, wifi: Wifi,
  landmark: Landmark, wallet: Wallet, card: CreditCard, banknote: Banknote, music: Music, gamepad: Gamepad2,
  book: Book, bus: Bus, train: Train, stethoscope: Stethoscope, hammer: Hammer, tag: Tag,
};
export const ICON_KEYS = Object.keys(ICONS);

export function iconFor(key: string): LucideIcon {
  return ICONS[key] ?? Tag;
}

export const ACCOUNT_ICONS: Record<AccountType, LucideIcon> = {
  cash: Banknote,
  bank: Landmark,
  card: CreditCard,
  wallet: Wallet,
};
export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  cash: 'Cash',
  bank: 'Bank account',
  card: 'Credit card',
  wallet: 'UPI / Wallet',
};

export const PALETTE = [
  '#f97316', '#22c55e', '#3b82f6', '#ec4899', '#eab308', '#a855f7', '#ef4444', '#14b8a6',
  '#06b6d4', '#84cc16', '#f43f5e', '#8b5cf6', '#0ea5e9', '#10b981', '#d946ef', '#64748b',
];
