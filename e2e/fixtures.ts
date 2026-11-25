import { expect, test as base, type Browser, type Page, type TestInfo } from '@playwright/test';
import { stateFile, type UserKey } from './support/env';

export const routes = {
  dashboard: { path: '/', heading: /^(Good (morning|afternoon|evening)|Up late)/, primary: true },
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
 * requestAnimationFrame and performance.now() real (Playwright's fake clock skews Motion's animations).
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

export function signedOutState() {
  const state = process.env.E2E_VERCEL_STATE;
  return state ? JSON.parse(state) : undefined;
}

export const test = base.extend({
  storageState: async ({ storageState }, use) => {
    await use(storageState ?? signedOutState());
  },
  page: async ({ page }, use) => {
    await freezeDate(page, FIXED_NOW);
    await use(page);
  },
});

export const asUser = (u: UserKey) => ({
  storageState: process.env['E2E_PREVIEW_STATE_' + u]
    ? JSON.parse(process.env['E2E_PREVIEW_STATE_' + u]!)
    : stateFile(u),
});

/** A brand-new browser context for the same user (fresh memory and no local cache besides the session). */
export async function newUserContext(browser: Browser, info: TestInfo, user: UserKey, at: Date = FIXED_NOW) {
  const { baseURL, viewport, isMobile, hasTouch, colorScheme, reducedMotion, locale, timezoneId } = info.project.use;
  const context = await browser.newContext({ baseURL, viewport, isMobile, hasTouch, colorScheme, reducedMotion, locale, timezoneId, serviceWorkers: 'block', ...asUser(user) });
  const page = await context.newPage();
  await freezeDate(page, at);
  return { context, page };
}

export async function ready(page: Page, route: Route) {
  const heading = page.getByRole('heading', { level: 1, name: routes[route].heading });
  try {
    await expect(heading).toBeVisible({ timeout: 20_000 });
  } catch (e) {
    const splash = await page.getByTestId('splash').getAttribute('data-reason', { timeout: 500 }).catch(() => null);
    throw new Error('Page not ready (' + page.url() + ', splash=' + splash + '): ' + (e as Error).message);
  }
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
  await expect(page).toHaveURL((url) => url.pathname === routes[route].path);
  await ready(page, route);
}

/** Wait until every local change has reached Supabase. */
export async function synced(page: Page) {
  const pill = page.getByTestId('sync-status');
  try {
    await expect(pill).toHaveAttribute('data-state', 'synced', { timeout: 20_000 });
    await expect(pill).toHaveAttribute('data-pending', '0');
  } catch (e) {
    const queue = await page
      .evaluate(() => Object.entries(localStorage).filter(([k]) => k.endsWith(':queue')).map(([k, v]) => k.split(':').slice(-1)[0] + '=' + v))
      .catch(() => []);
    throw new Error('Not synced; queue: ' + JSON.stringify(queue) + '\n' + (e as Error).message);
  }
}

/** Cycle the theme toggle until the wanted theme is active (theme is part of the synced settings). */
export async function setTheme(page: Page, theme: 'dark' | 'light') {
  const toggle = page.getByTestId('theme-toggle');
  for (let i = 0; i < 3; i++) {
    if ((await toggle.getAttribute('data-theme')) === theme) break;
    await toggle.click();
  }
  await expect(toggle).toHaveAttribute('data-theme', theme);
  await expect(page.locator('html')).toHaveCSS('color-scheme', theme);
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

/** Collect console warnings/errors, page errors, failed requests and HTTP errors. */
export function watchProblems(page: Page) {
  const problems: string[] = [];
  page.on('console', (m) => {
    // Playwright's own notice for the serviceWorkers: 'block' option is not an app problem.
    if (m.text().includes('Service Worker registration blocked by Playwright')) return;
    if (['warning', 'error'].includes(m.type())) problems.push(m.type() + ': ' + m.text() + ' (' + m.location().url + ')');
  });
  page.on('pageerror', (e) => problems.push('page error: ' + e.message));
  page.on('requestfailed', (r) => problems.push('failed request: ' + r.url() + ' (' + r.failure()?.errorText + ')'));
  page.on('response', (r) => {
    if (r.status() >= 400) problems.push('HTTP ' + r.status() + ': ' + r.url());
  });
  return problems;
}

export async function expectNoOverflow(page: Page) {
  const layout = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    return {
      width,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      outside: [...document.querySelectorAll('main *')]
        .filter((el) => {
          const b = el.getBoundingClientRect();
          return b.width && b.right > width + 1;
        })
        .slice(0, 8)
        .map((el) => el.outerHTML.slice(0, 200)),
    };
  });
  expect.soft(Math.max(layout.documentWidth, layout.bodyWidth), JSON.stringify(layout)).toBeLessThanOrEqual(layout.width);
}
