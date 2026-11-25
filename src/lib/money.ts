/** All money is stored as integer paise (minor units) to avoid float errors. */
export type Paise = number;

export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

export const CURRENCY_META: Record<CurrencyCode, { locale: string; label: string; symbol: string }> = {
  INR: { locale: 'en-IN', label: 'Indian Rupee', symbol: '₹' },
  USD: { locale: 'en-US', label: 'US Dollar', symbol: '$' },
  EUR: { locale: 'en-IE', label: 'Euro', symbol: '€' },
  GBP: { locale: 'en-GB', label: 'British Pound', symbol: '£' },
  AED: { locale: 'en-AE', label: 'UAE Dirham', symbol: 'AED' },
  SGD: { locale: 'en-SG', label: 'Singapore Dollar', symbol: 'S$' },
};

export function isCurrency(v: unknown): v is CurrencyCode {
  return typeof v === 'string' && (CURRENCIES as readonly string[]).includes(v);
}

/** Convert a decimal major-unit value (e.g. 123.45) to integer paise. */
export function toPaise(major: number): Paise {
  if (!Number.isFinite(major)) return 0;
  return Math.round(major * 100);
}

const CURRENCY_PREFIX = /^(?:rs\.?|inr|usd|eur|gbp|aed|sgd|s\$|₹|\$|€|£)\s*/i;

/**
 * Normalise typed or imported amount text: removes a leading currency marker ("Rs.", "INR", "₹", "S$"…)
 * before stripping other characters, so "Rs. 500" is 500, not ".500" (0.50). Keeps a leading minus sign.
 */
export function cleanAmountText(input: string): string {
  let s = input.trim();
  let negative = false;
  for (let i = 0; i < 3; i++) {
    if (s.startsWith('-') || s.startsWith('−')) {
      negative = true;
      s = s.slice(1).trimStart();
    }
    const next = s.replace(CURRENCY_PREFIX, '');
    if (next === s) break;
    s = next;
  }
  s = s.replace(/[^0-9.]/g, '');
  return (negative ? '-' : '') + s;
}

/** Parse a user-entered amount string ("1,23,456.78", "₹ 500", "Rs.1,500", "-20") into paise. Returns null if invalid. */
export function parseAmount(input: string): Paise | null {
  const cleaned = cleanAmountText(input);
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  if (!/^-?\d*(\.\d{0,})?$/.test(cleaned)) return null;
  const negative = cleaned.startsWith('-');
  const [whole = '0', frac = ''] = cleaned.replace('-', '').split('.');
  const fracPadded = (frac + '00').slice(0, 2);
  // Round half-up on the third decimal
  const third = frac.length > 2 ? Number(frac[2]) : 0;
  let paise = Number(whole || '0') * 100 + Number(fracPadded);
  if (third >= 5) paise += 1;
  if (!Number.isFinite(paise)) return null;
  return negative ? -paise : paise;
}

export function fromPaise(p: Paise): number {
  return p / 100;
}

/** Format paise to a string for an input field ("1234.5" -> "1234.50"). */
export function paiseToInput(p: Paise): string {
  const abs = Math.abs(p);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const s = frac === 0 ? String(whole) : whole + '.' + String(frac).padStart(2, '0');
  return p < 0 ? '-' + s : s;
}

const fmtCache = new Map<string, Intl.NumberFormat>();
function getFormatter(currency: CurrencyCode, decimals: number, compact: boolean): Intl.NumberFormat {
  const key = currency + decimals + compact;
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(CURRENCY_META[currency].locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: compact ? 0 : decimals,
      maximumFractionDigits: compact ? 1 : decimals,
      notation: compact ? 'compact' : 'standard',
    });
    fmtCache.set(key, f);
  }
  return f;
}

export interface FormatOptions {
  decimals?: 0 | 2;
  compact?: boolean;
  signed?: boolean;
}

export function formatMoney(p: Paise, currency: CurrencyCode, opts: FormatOptions = {}): string {
  const decimals = opts.decimals ?? 2;
  const f = getFormatter(currency, decimals, !!opts.compact);
  const s = f.format(Math.abs(p) / 100);
  if (p < 0) return '−' + s;
  if (opts.signed && p > 0) return '+' + s;
  return s;
}

export function sumPaise(values: readonly Paise[]): Paise {
  let t = 0;
  for (const v of values) t += v;
  return t;
}

/** Percentage (0-100+) of part/whole, safe for zero. */
export function percent(part: Paise, whole: Paise): number {
  if (whole === 0) return 0;
  return (part / whole) * 100;
}

/** Percent change from prev to curr; null when prev is zero. */
export function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

/** Divide paise evenly, rounding down to whole paise. */
export function divPaise(p: Paise, by: number): Paise {
  if (by <= 0) return p;
  return Math.floor(p / by);
}
