import { expect, type Page } from '@playwright/test';
import { asUser, expense, open, ready, row, setTheme, submitTransaction, synced, test } from './fixtures';

const desktop = { width: 1440, height: 900 };
const mobile = { width: 390, height: 844 };

async function capture(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.screenshot({
    path: 'test-artifacts/' + name + '.png',
    animations: 'disabled',
    style: '[data-testid="onb-step-0"] p > span, [data-testid="user-email"] { visibility: hidden; }',
  });
}

test('capture the signed-out login at both sizes and in both desktop themes', async ({ page, browser, baseURL }) => {
  await page.setViewportSize(desktop);
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await setTheme(page, 'dark');
  await capture(page, 'auth-login-desktop');
  await setTheme(page, 'light');
  await capture(page, 'auth-login-desktop-light');

  const context = await browser.newContext({
    baseURL, viewport: mobile, isMobile: true, hasTouch: true, colorScheme: 'dark',
    reducedMotion: 'reduce', serviceWorkers: 'block',
  });
  try {
    const phone = await context.newPage();
    await phone.goto('/login');
    await expect(phone.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await setTheme(phone, 'dark');
    await capture(phone, 'auth-login-mobile');
  } finally {
    await context.close();
  }
});

test.describe('empty dashboard captures', () => {
  test.use(asUser('B'));

  test('capture the onboarded empty dashboard at both sizes', async ({ page, browser, baseURL }) => {
    await page.setViewportSize(desktop);
    await open(page, 'dashboard');
    await expect(page.getByTestId('empty-state')).toContainText('A fresh start');
    await setTheme(page, 'dark');
    await synced(page);
    await capture(page, 'empty-dashboard-desktop');

    const context = await browser.newContext({
      ...asUser('B'), baseURL, viewport: mobile, isMobile: true, hasTouch: true,
      colorScheme: 'dark', reducedMotion: 'reduce', serviceWorkers: 'block',
    });
    try {
      const phone = await context.newPage();
      await open(phone, 'dashboard');
      await expect(phone.getByTestId('empty-state')).toContainText('A fresh start');
      await expect(phone.locator('html')).toHaveCSS('color-scheme', 'dark');
      await capture(phone, 'empty-dashboard-mobile');
    } finally {
      await context.close();
    }
  });
});

test.describe('fresh cloud account', () => {
  test.use(asUser('A'));

  test('capture first-run onboarding and verify transaction edits and deletions after reload', async ({ page }) => {
    await page.goto('/');
    const onboarding = page.getByTestId('onboarding');
    const dashboard = page.getByRole('heading', { level: 1, name: /^(Good |Up late)/ });
    await expect(onboarding.or(dashboard).first()).toBeVisible({ timeout: 20_000 });
    if (await onboarding.isVisible()) {
      await capture(page, 'onboarding-desktop');
      await page.getByTestId('onb-start').click();
      await page.getByTestId('onb-name').fill('QA reload');
      await page.getByTestId('onb-next').click();
      await expect(page.getByTestId('onb-currency-INR')).toHaveAttribute('aria-checked', 'true');
      await page.getByTestId('onb-next').click();
      await page.getByTestId('onb-type-bank').click();
      await page.getByTestId('onb-account-name').fill('QA reload account');
      await page.getByTestId('onb-next').click();
      await page.getByTestId('onb-finish').click();
      await ready(page, 'dashboard');
      await synced(page);
    }

    const original = 'QA reload original';
    const edited = 'QA reload edited';
    await open(page, 'transactions');
    await page.getByTestId('quick-add-button').click();
    await expense(page, original, '42');
    await synced(page);
    await row(page, original).getByRole('button', { name: /^Edit / }).click();
    await page.getByTestId('payee-input').fill(edited);
    await page.getByTestId('amount-input').fill('53');
    await submitTransaction(page);
    await synced(page);

    await page.reload();
    await ready(page, 'transactions');
    await expect(row(page, original)).toHaveCount(0);
    await expect(row(page, edited)).toContainText('₹53.00');
    await row(page, edited).getByTestId('transaction-delete').click();
    await synced(page);

    await page.reload();
    await ready(page, 'transactions');
    await page.getByTestId('tx-search').fill(edited);
    await expect(page.getByTestId('empty-state')).toBeVisible();
    await expect(row(page, edited)).toHaveCount(0);
  });
});
