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

export const test = base.extend({
  page: async ({ page }, use) => {
    // Stabilize the sample month and recurring due dates while leaving timers running.
    await page.clock.setFixedTime(new Date('2026-11-25T12:00:00+05:30'));
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
