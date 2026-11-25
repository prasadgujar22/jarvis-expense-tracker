import { format, parseISO, startOfMonth, endOfMonth, addMonths, isValid, differenceInCalendarDays, parse } from 'date-fns';

/** Dates are stored as local 'yyyy-MM-dd' strings. */
export type ISODate = string;
/** Months are 'yyyy-MM'. */
export type MonthKey = string;

export function toISODate(d: Date): ISODate {
  return format(d, 'yyyy-MM-dd');
}
export function todayISO(): ISODate {
  return toISODate(new Date());
}
export function fromISODate(s: ISODate): Date {
  return parseISO(s);
}
export function isISODate(s: unknown): s is ISODate {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && isValid(parseISO(s));
}
export function monthKey(d: Date | ISODate): MonthKey {
  const date = typeof d === 'string' ? parseISO(d) : d;
  return format(date, 'yyyy-MM');
}
export function currentMonth(): MonthKey {
  return monthKey(new Date());
}
export function monthStart(m: MonthKey): Date {
  return startOfMonth(parseISO(m + '-01'));
}
export function monthEnd(m: MonthKey): Date {
  return endOfMonth(parseISO(m + '-01'));
}
export function shiftMonth(m: MonthKey, by: number): MonthKey {
  return monthKey(addMonths(monthStart(m), by));
}
export function monthLabel(m: MonthKey, style: 'long' | 'short' = 'long'): string {
  return format(monthStart(m), style === 'long' ? 'MMMM yyyy' : 'MMM');
}
export function daysInMonth(m: MonthKey): number {
  return monthEnd(m).getDate();
}
/** Days remaining in month including today; 0 for past months, full for future. */
export function daysLeftInMonth(m: MonthKey, today = new Date()): number {
  const cur = monthKey(today);
  if (m < cur) return 0;
  if (m > cur) return daysInMonth(m);
  return differenceInCalendarDays(monthEnd(m), today) + 1;
}
export function formatDay(s: ISODate): string {
  const d = parseISO(s);
  const diff = differenceInCalendarDays(new Date(), d);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff === -1) return 'Tomorrow';
  return format(d, diff > -7 && diff < 7 ? 'EEEE, d MMM' : 'EEE, d MMM yyyy');
}
export function formatShort(s: ISODate): string {
  return format(parseISO(s), 'd MMM');
}

const IMPORT_FORMATS = ['yyyy-MM-dd', 'dd/MM/yyyy', 'dd-MM-yyyy', 'd/M/yyyy', 'dd/MM/yy', 'MM/dd/yyyy', 'd MMM yyyy', 'dd MMM yyyy', 'yyyy/MM/dd'];
/** Parse a date string from an imported file, trying common formats (Indian dd/MM first). */
export function parseLooseDate(s: string): ISODate | null {
  const t = s.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
    const d = parseISO(t.slice(0, 10));
    return isValid(d) ? toISODate(d) : null;
  }
  for (const f of IMPORT_FORMATS) {
    const d = parse(t, f, new Date());
    if (isValid(d) && d.getFullYear() > 1900 && d.getFullYear() < 2200) return toISODate(d);
  }
  return null;
}
