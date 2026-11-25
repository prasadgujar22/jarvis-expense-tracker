import { expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { navigate, open, routes, setLightTheme, test, type Route } from './fixtures';

const pages = Object.keys(routes) as Route[];

test('navigate through all eight pages using the viewport navigation', async ({ page, isMobile }) => {
  await open(page, 'dashboard');
  for (const route of [...pages.slice(1), 'dashboard'] as Route[]) {
    await test.step(route, () => navigate(page, route, isMobile));
  }
});

for (const route of pages) {
  test(`${route} has no horizontal overflow or browser errors`, async ({ page }) => {
    const problems: string[] = [];
    page.on('console', message => {
      if (['warning', 'error'].includes(message.type())) {
        const { url, lineNumber } = message.location();
        problems.push(`${message.type()}: ${message.text()} (${url}:${lineNumber + 1})`);
      }
    });
    page.on('pageerror', error => problems.push(`page error: ${error.message}`));
    page.on('requestfailed', request => problems.push(`failed request: ${request.url()} (${request.failure()?.errorText})`));
    page.on('response', response => {
      if (response.status() >= 400) problems.push(`HTTP ${response.status()}: ${response.url()}`);
    });

    await open(page, route);
    await page.waitForLoadState('networkidle');
    const layout = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      return {
        width,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        outside: [...document.querySelectorAll('main *')].filter(element => {
          const bounds = element.getBoundingClientRect();
          return bounds.width && bounds.right > width + 1;
        }).slice(0, 8).map(element => element.outerHTML.slice(0, 220)),
      };
    });
    expect.soft(Math.max(layout.documentWidth, layout.bodyWidth), JSON.stringify(layout)).toBeLessThanOrEqual(layout.width);
    expect.soft(problems, 'Browser console and network diagnostics').toEqual([]);
  });

  for (const theme of ['dark', 'light'] as const) {
    test(`${route} ${theme} accessibility and screenshot`, async ({ page }, info) => {
      if (theme === 'light') {
        await open(page, 'dashboard');
        await setLightTheme(page);
      }
      await open(page, route);
      await expect(page.locator('html')).toHaveCSS('color-scheme', theme);
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => document.fonts.ready.then(() => undefined));

      const artifact = `${info.project.name}-${route}-${theme}`;
      await mkdir('test-artifacts/axe', { recursive: true });
      await page.screenshot({ path: `test-artifacts/${artifact}.png`, fullPage: true, animations: 'disabled' });
      const results = await new AxeBuilder({ page }).analyze();
      const contrast = results.violations.filter(rule => rule.id === 'color-contrast');
      const severe = results.violations.filter(rule => rule.id !== 'color-contrast' && (
        ['serious', 'critical'].includes(rule.impact ?? '') ||
        rule.nodes.some(node => ['serious', 'critical'].includes(node.impact ?? ''))
      ));
      const review = results.incomplete.filter(rule => rule.id === 'color-contrast');
      await writeFile(`test-artifacts/axe/${artifact}.json`, JSON.stringify({ contrast, severe, review }, null, 2));
      const details = (rules: typeof contrast) => rules.flatMap(rule => rule.nodes.map(node => ({
        rule: rule.id, target: node.target, detail: node.failureSummary,
      })));
      expect.soft(contrast, JSON.stringify(details(contrast), null, 2)).toHaveLength(0);
      expect.soft(severe, JSON.stringify(details(severe), null, 2)).toHaveLength(0);
    });
  }
}
