import { addDays, addMonths, addWeeks, addYears, parseISO, getDate, setDate, getDaysInMonth, differenceInCalendarDays, differenceInCalendarMonths } from 'date-fns';
import type { ISODate } from './dates';
import { toISODate } from './dates';

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export const FREQUENCIES: readonly Frequency[] = ['daily', 'weekly', 'monthly', 'yearly'];

export interface RecurrenceSpec {
  frequency: Frequency;
  interval: number;
  startDate: ISODate;
  endDate?: ISODate | null;
}

/** Compute the n-th occurrence (0-based) of a recurrence. Monthly/yearly clamp to month end (e.g. 31st -> 30th). */
export function nthOccurrence(spec: RecurrenceSpec, n: number): ISODate {
  const start = parseISO(spec.startDate);
  const step = Math.max(1, Math.floor(spec.interval)) * n;
  switch (spec.frequency) {
    case 'daily':
      return toISODate(addDays(start, step));
    case 'weekly':
      return toISODate(addWeeks(start, step));
    case 'monthly': {
      const d = addMonths(start, step);
      const want = getDate(start);
      return toISODate(setDate(d, Math.min(want, getDaysInMonth(d))));
    }
    case 'yearly':
      return toISODate(addYears(start, step));
  }
}

/** Index of the first occurrence strictly after `after` (0 when after is null or before the start). Jumps ahead by estimate, so cost doesn't grow with the rule's age. */
export function firstIndexAfter(spec: RecurrenceSpec, after: ISODate | null): number {
  if (after === null || after < spec.startDate) return 0;
  const start = parseISO(spec.startDate);
  const target = parseISO(after);
  const interval = Math.max(1, Math.floor(spec.interval));
  let units: number;
  switch (spec.frequency) {
    case 'daily':
      units = differenceInCalendarDays(target, start);
      break;
    case 'weekly':
      units = Math.floor(differenceInCalendarDays(target, start) / 7);
      break;
    case 'monthly':
      units = differenceInCalendarMonths(target, start);
      break;
    case 'yearly':
      units = Math.floor(differenceInCalendarMonths(target, start) / 12);
      break;
  }
  let n = Math.max(0, Math.floor(units / interval) - 1);
  // Correct the estimate: never more than a couple of steps.
  while (n > 0 && nthOccurrence(spec, n) > after) n--;
  while (nthOccurrence(spec, n) <= after) n++;
  return n;
}

/** Occurrences in (after, until] — 'after' exclusive, 'until' inclusive. `limit` caps how many are returned. */
export function occurrencesBetween(spec: RecurrenceSpec, after: ISODate | null, until: ISODate, limit = 1000): ISODate[] {
  const out: ISODate[] = [];
  for (let n = firstIndexAfter(spec, after); out.length < limit; n++) {
    const d = nthOccurrence(spec, n);
    if (d > until) break;
    if (spec.endDate && d > spec.endDate) break;
    out.push(d);
  }
  return out;
}

export function nextOccurrence(spec: RecurrenceSpec, after: ISODate | null): ISODate | null {
  const d = nthOccurrence(spec, firstIndexAfter(spec, after));
  if (spec.endDate && d > spec.endDate) return null;
  return d;
}

/** Monthly-equivalent cost of a recurrence in paise. */
export function monthlyEquivalent(amount: number, frequency: Frequency, interval: number): number {
  const i = Math.max(1, interval);
  switch (frequency) {
    case 'daily':
      return Math.round((amount * 30.4375) / i);
    case 'weekly':
      return Math.round((amount * 52) / 12 / i);
    case 'monthly':
      return Math.round(amount / i);
    case 'yearly':
      return Math.round(amount / 12 / i);
  }
}

export function frequencyLabel(f: Frequency, interval: number): string {
  const unit = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[f];
  if (interval <= 1) return { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' }[f];
  return 'Every ' + interval + ' ' + unit + 's';
}
