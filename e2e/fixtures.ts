import { expect, test as base, type Page } from '@playwright/test';

export const routes = {
  dashboard: { path: '/', heading: /Aarav/, primary: true },
  transactions: { path: '/transactions', heading: 'Transactions', primary: true },
  budgets: { path: '/budgets', heading: 'Budgets', primary: true },
  recurring: { path: '/recurring', heading: 'Recurring & subscriptions', primary: false },
  goals: { path: '/goals', heading: 'Savings goals', primary: false },
  insights: { path: '/insights', heading: 'Insights', primary: true },
  accounts: { path: '/accounts', heading: 'Accounts', primary: false },
  settings: { path: '/settings', heading: 'Settings', primary: false },
} as const;

export type Route = keyof typeof routes;

export const FIXED_NOW = new Date('2026-11-25T12:00:00+05:30');

/**
 * Freeze the calendar date (Date.now() / new Date()) in every document this page loads, leaving timers,
 * requestAnimationFrame and performance.now() real.
 *
 * Why not page.clock.setFixedTime(): Playwright's fake clock also fakes performance.now() and keeps it counting
 * from when the clock was installed, while document.timeline restarts at 0 on each document load. Motion starts its
 * WAAPI animations from performance.now(), so after every goto()/reload() exit animations begin "in the future" by
 * the time elapsed since clock install, and dialogs linger that long before unmounting. On slower hosts (the Vercel
 * deployment, or 4 busy workers) toBeHidden() waits then time out. Real browsers never have that skew.
 */
export async function freezeDate(page: Page, at: Date) {
  await page.addInitScript((fixed: number) => {
    const RealDate = Date;
    const FixedDate = function (this: unknown, ...args: unknown[]) {
      if (!new.target) return new RealDate(fixed).toString();
      return Reflect.construct(RealDate, args.length ? args : [fixed], new.target);
    } as unknown as DateConstructor;
    Object.setPrototypeOf(FixedDate, RealDate);
    Object.defineProperty(FixedDate, 'prototype', { value: RealDate.prototype });
    FixedDate.now = () => fixed;
    FixedDate.parse = RealDate.parse;
    FixedDate.UTC = RealDate.UTC;
    globalThis.Date = FixedDate;
  }, at.getTime());
}

export const test = base.extend({
  page: async ({ page }, use) => {
    // Stabilize the sample month and recurring due dates while leaving timers and animation timing real.
    await freezeDate(page, FIXED_NOW);
    await use(page);
  },
});

export async function ready(page: Page, route: Route) {
  await expect(page.getByRole('heading', { level: 1, name: routes[route].heading })).toBeVisible();
}

export async function open(page: Page, route: Route) {
  await page.goto(routes[route].path);
  await ready(page, route);
}

export async function navigate(page: Page, route: Route, mobile: boolean) {
  if (!mobile) {
    await page.getByTestId('nav-' + route).click();
  } else if (routes[route].primary) {
    await page.getByTestId('mnav-' + route).click();
  } else {
    await page.getByTestId('mnav-more').click();
    await page.getByTestId('more-' + route).click();
    await expect(page.getByTestId('more-sheet')).toBeHidden();
  }
  await expect(page).toHaveURL(url => url.pathname === routes[route].path);
  await ready(page, route);
}

export async function setLightTheme(page: Page) {
  await page.getByTestId('theme-toggle').click();
  await expect(page.getByTestId('theme-toggle')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
}

export function row(page: Page, payee: string) {
  return page.getByTestId('transaction-row').filter({ hasText: payee });
}

export async function expense(page: Page, payee: string, amount: string) {
  await expect(page.getByTestId('quick-add-modal')).toBeVisible();
  await page.getByTestId('type-expense').click();
  await page.getByTestId('amount-input').fill(amount);
  await page.getByTestId('category-chip-cat_food').click();
  await page.getByTestId('payee-input').fill(payee);
  await submitTransaction(page);
}

export async function submitTransaction(page: Page) {
  await page.getByTestId('submit-transaction').click();
  await expect(page.getByTestId('quick-add-modal')).toBeHidden();
}

export function rupees(text: string) {
  expect(text).toMatch(/₹/);
  return Number(text.replace('−', '-').replace(/[^0-9.-]/g, ''));
}
