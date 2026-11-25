import { differenceInCalendarMonths, parseISO } from 'date-fns';
import type { Goal } from '../store/types';

export function goalSaved(g: Goal): number {
  return g.contributions.reduce((s, c) => s + c.amount, 0);
}

/** Required monthly saving to hit target by targetDate (at least one month). */
export function requiredMonthly(g: Goal, today = new Date()): number | null {
  if (!g.targetDate) return null;
  const left = g.target - goalSaved(g);
  if (left <= 0) return 0;
  const months = Math.max(1, differenceInCalendarMonths(parseISO(g.targetDate), today));
  return Math.ceil(left / months);
}
