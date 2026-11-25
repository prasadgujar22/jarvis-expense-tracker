import { addDays, subMonths, startOfMonth, format, getDay } from 'date-fns';
import type { Account, Budget, DataState, Goal, RecurringRule, Transaction } from '../store/types';
import { DEFAULT_CATEGORIES } from './categories';
import { mulberry32 } from '../lib/random';
import { toISODate, todayISO } from '../lib/dates';
import { generateDue } from '../store/engine';

const rupees = (n: number) => Math.round(n * 100);

export const SEED_ACCOUNTS: Account[] = [
  { id: 'acc_cash', name: 'Cash', type: 'cash', openingBalance: rupees(4500), color: '#84cc16', archived: false },
  { id: 'acc_hdfc', name: 'HDFC Savings', type: 'bank', openingBalance: rupees(185000), color: '#3b82f6', archived: false },
  { id: 'acc_icici', name: 'ICICI Credit Card', type: 'card', openingBalance: rupees(0), color: '#f97316', archived: false },
  { id: 'acc_gpay', name: 'GPay UPI', type: 'wallet', openingBalance: rupees(3200), color: '#14b8a6', archived: false },
];

export function buildSeed(today: Date = new Date()): DataState {
  const rand = mulberry32(20240401);
  const r = (min: number, max: number) => min + rand() * (max - min);
  const ri = (min: number, max: number) => Math.round(r(min, max));
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
  // Six full calendar months ending today (current month is partial up to today).
  const start = startOfMonth(subMonths(today, 5));
  // Goal contributions are anchored to the last ~3 months so they look recent.
  const recent = startOfMonth(subMonths(today, 3));
  const startISO = toISODate(start);
  const dayBefore = toISODate(addDays(start, -1));
  const todayStr = toISODate(today);

  const rule = (p: Omit<RecurringRule, 'id' | 'interval' | 'endDate' | 'postedThrough' | 'active'> & { id: string; day?: number }): RecurringRule => {
    const s = p.day ? format(start, 'yyyy-MM-') + String(p.day).padStart(2, '0') : p.startDate;
    const { day: _day, ...rest } = p;
    void _day;
    return { ...rest, startDate: s, interval: 1, endDate: null, postedThrough: dayBefore, active: true };
  };

  const recurring: RecurringRule[] = [
    rule({ id: 'rec_salary', title: 'Salary — Acme Technologies', type: 'income', amount: rupees(145000), categoryId: 'cat_salary', accountId: 'acc_hdfc', frequency: 'monthly', startDate: startISO, day: 1, autoPost: true, isSubscription: false }),
    rule({ id: 'rec_rent', title: 'House rent', type: 'expense', amount: rupees(32000), categoryId: 'cat_rent', accountId: 'acc_hdfc', frequency: 'monthly', startDate: startISO, day: 3, autoPost: true, isSubscription: false }),
    rule({ id: 'rec_sip', title: 'SIP — Parag Parikh Flexi Cap', type: 'expense', amount: rupees(15000), categoryId: 'cat_investments', accountId: 'acc_hdfc', frequency: 'monthly', startDate: startISO, day: 5, autoPost: true, isSubscription: false }),
    rule({ id: 'rec_netflix', title: 'Netflix', type: 'expense', amount: rupees(649), categoryId: 'cat_subscriptions', accountId: 'acc_icici', frequency: 'monthly', startDate: startISO, day: 8, autoPost: true, isSubscription: true }),
    rule({ id: 'rec_spotify', title: 'Spotify Premium', type: 'expense', amount: rupees(139), categoryId: 'cat_subscriptions', accountId: 'acc_icici', frequency: 'monthly', startDate: startISO, day: 12, autoPost: true, isSubscription: true }),
    rule({ id: 'rec_prime', title: 'Amazon Prime', type: 'expense', amount: rupees(299), categoryId: 'cat_subscriptions', accountId: 'acc_icici', frequency: 'monthly', startDate: startISO, day: 18, autoPost: true, isSubscription: true }),
    rule({ id: 'rec_jio', title: 'Jio recharge', type: 'expense', amount: rupees(349), categoryId: 'cat_bills', accountId: 'acc_gpay', frequency: 'monthly', startDate: startISO, day: 22, autoPost: false, isSubscription: false }),
    rule({ id: 'rec_electricity', title: 'Electricity — BESCOM', type: 'expense', amount: rupees(2150), categoryId: 'cat_bills', accountId: 'acc_gpay', frequency: 'monthly', startDate: startISO, day: 15, autoPost: false, isSubscription: false }),
    rule({ id: 'rec_airtel', title: 'Airtel Xstream Fiber', type: 'expense', amount: rupees(799), categoryId: 'cat_bills', accountId: 'acc_icici', frequency: 'monthly', startDate: startISO, day: 26, autoPost: false, isSubscription: true }),
    rule({ id: 'rec_gym', title: 'Cult.fit membership', type: 'expense', amount: rupees(1299), categoryId: 'cat_health', accountId: 'acc_icici', frequency: 'monthly', startDate: startISO, day: 2, autoPost: true, isSubscription: true }),
  ];

  const txs: Transaction[] = [];
  let n = 0;
  const add = (t: Omit<Transaction, 'id' | 'createdAt' | 'toAccountId' | 'recurringId' | 'note' | 'tags'> & Partial<Pick<Transaction, 'toAccountId' | 'note' | 'tags'>>) => {
    n++;
    txs.push({ toAccountId: null, note: '', tags: [], recurringId: null, ...t, id: 'seed_' + n, createdAt: Date.parse(t.date) + n });
  };

  const food = ['Swiggy', 'Zomato', 'Swiggy', 'Zomato', 'Chai Point', 'Third Wave Coffee', 'Meghana Foods', 'Truffles'];
  const groceries = ['Zepto', 'Blinkit', 'BigBasket', 'Zepto', 'Blinkit', 'DMart'];
  const rides = ['Uber', 'Ola', 'Rapido', 'Uber', 'Namma Metro'];
  const shopping = ['Amazon', 'Myntra', 'Flipkart', 'Decathlon', 'IKEA', 'Nykaa'];
  const fun = ['PVR Cinemas', 'BookMyShow', 'Steam', 'Toit Brewpub'];
  const personal = ['Urban Company salon', 'Nykaa', 'Barber'];
  const health = ['Apollo Pharmacy', 'PharmEasy', 'Practo consult'];

  for (let d = new Date(start); toISODate(d) <= todayStr; d = addDays(d, 1)) {
    const date = toISODate(d);
    const wd = getDay(d);
    const weekend = wd === 0 || wd === 6;
    // Food delivery / dining
    const foodCount = weekend ? ri(1, 2) : rand() < 0.65 ? 1 : 0;
    for (let i = 0; i < foodCount; i++) {
      const payee = pick(food);
      const big = payee === 'Meghana Foods' || payee === 'Truffles';
      add({ type: 'expense', amount: rupees(big ? ri(650, 1600) : payee.includes('Chai') || payee.includes('Coffee') ? ri(120, 420) : ri(220, 780)), categoryId: 'cat_food', accountId: rand() < 0.7 ? 'acc_gpay' : 'acc_icici', date, payee, tags: weekend && rand() < 0.3 ? ['weekend'] : [] });
    }
    if (rand() < 0.45) add({ type: 'expense', amount: rupees(ri(180, 1450)), categoryId: 'cat_groceries', accountId: 'acc_gpay', date, payee: pick(groceries) });
    if (!weekend && rand() < 0.55) add({ type: 'expense', amount: rupees(ri(90, 420)), categoryId: 'cat_transport', accountId: rand() < 0.8 ? 'acc_gpay' : 'acc_cash', date, payee: pick(rides), tags: ['commute'] });
    if (rand() < 0.1) add({ type: 'expense', amount: rupees(ri(1200, 2600)), categoryId: 'cat_transport', accountId: 'acc_icici', date, payee: pick(['Indian Oil', 'HP Petrol', 'Shell']), note: 'Petrol', tags: ['fuel'] });
    if (rand() < 0.09) add({ type: 'expense', amount: rupees(ri(499, 4999)), categoryId: 'cat_shopping', accountId: 'acc_icici', date, payee: pick(shopping) });
    if (weekend && rand() < 0.3) add({ type: 'expense', amount: rupees(ri(350, 1800)), categoryId: 'cat_entertainment', accountId: 'acc_icici', date, payee: pick(fun) });
    if (rand() < 0.04) add({ type: 'expense', amount: rupees(ri(250, 1500)), categoryId: 'cat_health', accountId: 'acc_gpay', date, payee: pick(health) });
    if (rand() < 0.035) add({ type: 'expense', amount: rupees(ri(300, 1400)), categoryId: 'cat_personal', accountId: 'acc_cash', date, payee: pick(personal) });
    if (rand() < 0.06) add({ type: 'expense', amount: rupees(ri(40, 260)), categoryId: 'cat_food', accountId: 'acc_cash', date, payee: pick(['Street food', 'Darshini', 'Juice centre']), note: 'Paid in cash' });
    if (d.getDate() === 10 || d.getDate() === 24) add({ type: 'transfer', amount: rupees(d.getDate() === 10 ? 15000 : 13000), categoryId: null, accountId: 'acc_hdfc', toAccountId: 'acc_gpay', date, payee: 'Top-up GPay', note: 'UPI float' });
    if (d.getDate() === 20) add({ type: 'transfer', amount: rupees(ri(22000, 30000)), categoryId: null, accountId: 'acc_hdfc', toAccountId: 'acc_icici', date, payee: 'ICICI card bill payment' });
    if (d.getDate() === 14) add({ type: 'transfer', amount: rupees(3000), categoryId: null, accountId: 'acc_hdfc', toAccountId: 'acc_cash', date, payee: 'ATM withdrawal' });
    if (d.getDate() === 17 && rand() < 0.85) add({ type: 'income', amount: rupees(ri(18000, 42000)), categoryId: 'cat_freelance', accountId: 'acc_hdfc', date, payee: pick(['Upwork client', 'Design project — Studio Nine', 'Toptal']), tags: ['freelance'] });
    if (d.getDate() === 25 && rand() < 0.5) add({ type: 'expense', amount: rupees(ri(500, 2500)), categoryId: 'cat_gifts', accountId: 'acc_gpay', date, payee: pick(['Birthday gift — Riya', 'Wedding shagun', 'Diwali sweets']), tags: ['family'] });
    if (rand() < 0.03) add({ type: 'expense', amount: rupees(ri(400, 3000)), categoryId: 'cat_education', accountId: 'acc_icici', date, payee: pick(['Udemy', 'Coursera', 'Amazon Kindle']) });
    if (rand() < 0.02) add({ type: 'income', amount: rupees(ri(150, 1800)), categoryId: 'cat_refund', accountId: 'acc_icici', date, payee: pick(['Amazon refund', 'Myntra return', 'Swiggy refund']) });
    if (rand() < 0.05) add({ type: 'expense', amount: rupees(ri(100, 2000)), categoryId: 'cat_other', accountId: 'acc_gpay', date, payee: pick(['UPI to Ramesh (maid)', 'UPI to Suresh', 'Laundry']), tags: ['upi'] });
  }
  // A trip in the second month
  const tripDay = toISODate(addDays(start, 40));
  if (tripDay <= todayStr) {
    add({ type: 'expense', amount: rupees(8640), categoryId: 'cat_travel', accountId: 'acc_icici', date: tripDay, payee: 'IndiGo — BLR → GOI', tags: ['goa-trip'] });
    add({ type: 'expense', amount: rupees(12400), categoryId: 'cat_travel', accountId: 'acc_icici', date: toISODate(addDays(start, 42)), payee: 'Airbnb — Assagao', tags: ['goa-trip'] });
  }
  // Quarterly savings interest
  for (const [offset, amt] of [[30, 1862], [121, 1945]] as const) {
    const d = toISODate(addDays(start, offset));
    if (d <= todayStr) add({ type: 'income', amount: rupees(amt), categoryId: 'cat_interest', accountId: 'acc_hdfc', date: d, payee: 'HDFC savings interest' });
  }

  const budgets: Budget[] = [
    { id: 'bud_overall', categoryId: null, amount: rupees(95000) },
    { id: 'bud_food', categoryId: 'cat_food', amount: rupees(9000) },
    { id: 'bud_groceries', categoryId: 'cat_groceries', amount: rupees(8000) },
    { id: 'bud_transport', categoryId: 'cat_transport', amount: rupees(6000) },
    { id: 'bud_shopping', categoryId: 'cat_shopping', amount: rupees(5000) },
    { id: 'bud_entertainment', categoryId: 'cat_entertainment', amount: rupees(3000) },
    { id: 'bud_bills', categoryId: 'cat_bills', amount: rupees(4500) },
  ];

  const g = (date: Date, amt: number, note = '') => ({ id: 'gc_' + Math.floor(rand() * 1e9).toString(36), date: toISODate(date), amount: rupees(amt), note });
  const goals: Goal[] = [
    { id: 'goal_emergency', name: 'Emergency fund', target: rupees(300000), targetDate: toISODate(addDays(today, 300)), emoji: '🛟', color: '#10b981', createdAt: recent.getTime(), contributions: [g(recent, 120000, 'Initial'), g(addDays(recent, 31), 15000), g(addDays(recent, 62), 15000), g(addDays(recent, 92), 15000)].filter((c) => c.date <= todayStr) },
    { id: 'goal_japan', name: 'Japan trip', target: rupees(250000), targetDate: toISODate(addDays(today, 200)), emoji: '🗾', color: '#f43f5e', createdAt: recent.getTime(), contributions: [g(addDays(recent, 5), 20000), g(addDays(recent, 50), 12000), g(addDays(recent, 85), 10000)].filter((c) => c.date <= todayStr) },
    { id: 'goal_macbook', name: 'New MacBook', target: rupees(160000), targetDate: toISODate(addDays(today, 120)), emoji: '💻', color: '#3b82f6', createdAt: recent.getTime(), contributions: [g(addDays(recent, 15), 45000), g(addDays(recent, 70), 25000)].filter((c) => c.date <= todayStr) },
  ];

  const base: DataState = {
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    accounts: SEED_ACCOUNTS.map((a) => ({ ...a })),
    transactions: txs,
    budgets,
    recurring,
    goals,
  };
  // Post the auto rules up to today; mark manual bills as paid until last month so a few are "due".
  const generated = generateDue(base, todayISO());
  const manualPaid: Transaction[] = [];
  const lastMonthEnd = toISODate(addDays(startOfMonth(today), -1));
  const withManual = generated.recurring.map((rr) => {
    if (rr.autoPost) return rr;
    const sub = generateDue({ ...generated, recurring: [{ ...rr, autoPost: true }] }, lastMonthEnd);
    manualPaid.push(...sub.transactions.filter((t) => t.recurringId === rr.id));
    return { ...rr, postedThrough: lastMonthEnd };
  });
  const all = [...generated.transactions, ...manualPaid.filter((t) => !generated.transactions.some((x) => x.id === t.id))];
  all.sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1));
  return { ...generated, recurring: withManual, transactions: all };
}
