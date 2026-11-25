import { expect } from '@playwright/test';
import { asUser, open, test } from './fixtures';

// Regression: overflow-x: hidden on html/body made them scroll containers, so the sticky sidebar scrolled
// away and the user card floated mid-screen. The sidebar must stay pinned at any page length.
test.use(asUser('B'));

test('desktop sidebar stays pinned with the user card at the bottom while the page scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  await open(page, 'dashboard');

  // The bug is about scrolling, not empty-state height: make sure the document is well above the viewport.
  await page.evaluate(() => {
    const main = document.getElementById('main')!;
    main.style.minHeight = window.innerHeight * 3 + 'px';
  });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const scrollY = await page.evaluate(() => window.scrollY);
  expect(scrollY, 'the page should actually scroll').toBeGreaterThan(600);

  const sidebar = page.getByRole('complementary', { name: 'Sidebar' });
  const user = page.getByTestId('sidebar-user');
  await expect(user).toBeInViewport();
  const box = (await user.boundingBox())!;
  // The aside has py-5 (20px) of bottom padding; allow a few px of slack.
  expect(600 - (box.y + box.height), 'user card bottom gap').toBeLessThanOrEqual(28);
  expect(box.y, 'user card is near the bottom, not mid-screen').toBeGreaterThan(600 / 2);

  const asideBox = (await sidebar.boundingBox())!;
  expect(asideBox.y).toBeCloseTo(0, 0);
  expect(asideBox.height).toBeCloseTo(600, 0);
  await expect(page.getByTestId('sidebar-logo')).toBeInViewport();
  await expect(page.getByTestId('nav-dashboard')).toBeInViewport();

  const email = page.getByTestId('user-email');
  const text = (await email.textContent())!.trim();
  expect(text).toContain('@');
  await expect(email).toHaveAttribute('title', text);
  const nameEl = page.getByTestId('user-name');
  const name = (await nameEl.count()) ? (await nameEl.textContent())!.trim() : '';
  await expect(user).toHaveAccessibleName(['Signed in as', name, text].filter(Boolean).join(' '));
  await expect(page.getByTestId('sign-out')).toHaveAccessibleName('Sign out');

  // Still no horizontal scroll after switching overflow-x to clip.
  const widths = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(widths[0]).toBeLessThanOrEqual(widths[1]);
});

test('desktop sidebar stays pinned while Quick Add is open and the page is scrolled', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  await open(page, 'dashboard');
  await page.evaluate(() => {
    document.getElementById('main')!.style.minHeight = window.innerHeight * 3 + 'px';
    window.scrollTo(0, window.innerHeight);
  });

  await page.getByTestId('quick-add-button').click();
  await expect(page.getByTestId('quick-add-modal')).toBeVisible();
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.move(512, 300);
  await page.mouse.wheel(0, 1200);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.scrollY), 'background page is scroll-locked').toBe(before);
  // body must not have become a scroll container of its own
  expect(await page.evaluate(() => document.body.scrollTop)).toBe(0);

  const asideBox = (await page.getByRole('complementary', { name: 'Sidebar' }).boundingBox())!;
  expect(asideBox.y).toBeCloseTo(0, 0);
  expect(asideBox.height).toBeCloseTo(600, 0);
  const box = (await page.getByTestId('sidebar-user').boundingBox())!;
  expect(600 - (box.y + box.height)).toBeLessThanOrEqual(28);

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('quick-add-modal')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('');
});

test('at 390px the desktop sidebar is hidden and the bottom nav shows', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, 'dashboard');
  await expect(page.getByRole('complementary', { name: 'Sidebar' })).toBeHidden();
  await expect(page.getByTestId('mnav-dashboard')).toBeVisible();
});
