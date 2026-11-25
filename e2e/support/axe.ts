import { expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';

/** Fails on any serious/critical violation and on any color-contrast violation. */
export async function checkA11y(page: Page, artifact: string) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await mkdir('test-artifacts/axe', { recursive: true });
  await page.screenshot({ path: 'test-artifacts/' + artifact + '.png', fullPage: true, animations: 'disabled', style: '[data-testid="user-email"] { visibility: hidden; }' });
  const results = await new AxeBuilder({ page }).analyze();
  const contrast = results.violations.filter((r) => r.id === 'color-contrast');
  const severe = results.violations.filter(
    (r) => r.id !== 'color-contrast' && (['serious', 'critical'].includes(r.impact ?? '') || r.nodes.some((n) => ['serious', 'critical'].includes(n.impact ?? ''))),
  );
  await writeFile('test-artifacts/axe/' + artifact + '.json', JSON.stringify({ contrast, severe }, null, 2));
  const details = (rules: typeof contrast) => rules.flatMap((r) => r.nodes.map((n) => ({ rule: r.id, target: n.target, detail: n.failureSummary })));
  expect.soft(contrast, JSON.stringify(details(contrast), null, 2)).toHaveLength(0);
  expect.soft(severe, JSON.stringify(details(severe), null, 2)).toHaveLength(0);
}
