import { expect } from '@playwright/test';
import { checkA11y } from './support/axe';
import { asUser, expectNoOverflow, navigate, open, routes, setTheme, synced, test, watchProblems, type Route } from './fixtures';

// User B is onboarded with default categories and nothing else: every page is in its empty state.
test.use(asUser('B'));

const pages = Object.keys(routes) as Route[];

const EMPTY: Partial<Record<Route, { title: RegExp; cta: RegExp }>> = {
  dashboard: { title: /A fresh start/, cta: /Add an account/ },
  transactions: { title: /No transactions yet/, cta: /Add transaction/ },
  budgets: { title: /No budgets yet/, cta: /Create your first budget/ },
  recurring: { title: /Nothing recurring yet/, cta: /Add an account first/ },
  goals: { title: /No goals yet/, cta: /Create a goal/ },
  insights: { title: /Insights need a little history/, cta: /Add an expense/ },
  accounts: { title: /No accounts yet/, cta: /Add your first account/ },
};

test('navigate through all eight pages using the viewport navigation', async ({ page, isMobile }) => {
  await open(page, 'dashboard');
  for (const route of [...pages.slice(1), 'dashboard'] as Route[]) {
    await test.step(route, () => navigate(page, route, isMobile));
  }
});

for (const route of pages) {
  test(route + ' empty state, no horizontal overflow, zero console errors', async ({ page }) => {
    const problems = watchProblems(page);
    await open(page, route);
    const empty = EMPTY[route];
    if (empty) {
      const state = page.getByTestId('empty-state').filter({ hasText: empty.title });
      await expect(state).toBeVisible();
      await expect(state.getByRole('button', { name: empty.cta })).toBeVisible();
    } else {
      await expect(page.getByTestId('account-panel')).toBeVisible();
    }
    await synced(page);
    await page.waitForLoadState('networkidle');
    await expectNoOverflow(page);
    expect.soft(problems, 'Browser console and network diagnostics').toEqual([]);
  });

  for (const theme of ['dark', 'light'] as const) {
    test(route + ' ' + theme + ' accessibility', async ({ page }, info) => {
      await open(page, route);
      await setTheme(page, theme);
      await synced(page);
      await page.waitForLoadState('networkidle');
      await checkA11y(page, info.project.name + '-' + route + '-' + theme);
    });
  }
}
