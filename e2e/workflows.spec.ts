import { expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { expense, navigate, open, ready, row, rupees, setLightTheme, submitTransaction, test } from './fixtures';

test('seeded INR dashboard shows all KPIs, charts, and recent transactions', async ({ page }) => {
  await open(page, 'dashboard');
  for (const id of ['networth', 'income', 'expenses', 'savings']) {
    await expect(page.getByTestId('kpi-' + id)).toBeVisible();
  }
  await expect(page.getByTestId('kpi-networth')).toContainText('₹');
  for (const heading of ['donut-h', 'ie-h', 'daily-h']) {
    await expect(page.locator(`[aria-labelledby="${heading}"] svg.recharts-surface`).first()).toBeVisible();
  }
  await expect(page.getByTestId('transaction-row').first()).toBeVisible();
});

test('quick add saves an expense and increases the dashboard total', async ({ page, isMobile }) => {
  await open(page, 'dashboard');
  const total = page.getByTestId('kpi-expenses').locator('[aria-label^="₹"]');
  const before = rupees(await total.getAttribute('aria-label') ?? '');
  if (isMobile) await page.getByTestId('quick-add-fab').click();
  else await page.keyboard.press('n');
  const payee = isMobile ? 'QA FAB lunch' : 'QA shortcut lunch';
  await expense(page, payee, '123');
  await expect.poll(async () => rupees(await total.getAttribute('aria-label') ?? '')).toBe(before + 123);
  await navigate(page, 'transactions', isMobile);
  await expect(row(page, payee)).toContainText('123');
});

test('edit a transaction, delete it, and undo the deletion', async ({ page, isMobile }) => {
  await open(page, 'transactions');
  await page.keyboard.press('n');
  await expense(page, 'QA edit original', '50');
  await row(page, 'QA edit original').getByRole('button', { name: /^Edit / }).click();
  await page.getByTestId('payee-input').fill('QA edit updated');
  await page.getByTestId('amount-input').fill('75');
  await submitTransaction(page);
  const updated = row(page, 'QA edit updated');
  await expect(row(page, 'QA edit original')).toHaveCount(0);
  await expect(updated).toContainText('75');
  if (isMobile) {
    await updated.getByRole('button', { name: /^Edit / }).click();
    await page.getByTestId('delete-transaction').click();
    await expect(page.getByTestId('quick-add-modal')).toBeHidden();
  } else {
    await updated.getByTestId('transaction-delete').click();
  }
  await expect(updated).toHaveCount(0);
  await page.getByTestId('toast-action').click();
  await expect(updated).toContainText('75');
});

test('transfer debits the source, credits the destination, and preserves net worth', async ({ page, isMobile }) => {
  await open(page, 'accounts');
  const balance = (name: string) => page.getByTestId('account-card')
    .filter({ has: page.getByRole('heading', { name, exact: true }) }).getByTestId('account-balance');
  const cash = balance('Cash');
  const hdfc = balance('HDFC Savings');
  const cashBefore = rupees(await cash.innerText());
  const hdfcBefore = rupees(await hdfc.innerText());
  const worth = page.getByTestId('net-worth');
  const worthBefore = await worth.innerText();
  await page.keyboard.press('n');
  await page.getByTestId('type-transfer').click();
  await page.getByTestId('amount-input').fill('120');
  await page.getByTestId('account-select').selectOption({ label: 'HDFC Savings' });
  await page.getByTestId('to-account-select').selectOption({ label: 'Cash' });
  await page.getByTestId('note-input').fill('QA account transfer');
  await submitTransaction(page);
  await expect.poll(async () => rupees(await cash.innerText())).toBe(cashBefore + 120);
  await expect.poll(async () => rupees(await hdfc.innerText())).toBe(hdfcBefore - 120);
  await expect(worth).toHaveText(worthBefore, { useInnerText: true });
  await navigate(page, 'transactions', isMobile);
  await page.getByTestId('tx-search').fill('QA account transfer');
  const transfer = row(page, 'Transfer');
  await expect(transfer).toContainText('HDFC Savings');
  await expect(transfer).toContainText('Cash');
});

test('search text and combine category and date presets', async ({ page }) => {
  await open(page, 'transactions');
  await page.keyboard.press('n');
  await expense(page, 'QA filter lunch', '101');
  const created = row(page, 'QA filter lunch');
  await page.getByTestId('tx-search').fill('qA fIlTeR');
  await expect(page.getByTestId('transaction-row')).toHaveCount(1);
  await expect(created).toBeVisible();

  await page.getByTestId('toggle-filters').click();
  const groceries = page.getByTestId('filter-cat-cat_groceries');
  await groceries.click();
  await expect(created).toHaveCount(0);
  await expect(page.getByTestId('empty-state')).toBeVisible();
  await groceries.click();
  await page.getByTestId('filter-cat-cat_food').click();
  await expect(created).toBeVisible();

  const date = page.getByTestId('filter-preset');
  await date.selectOption('last-month');
  await expect(created).toHaveCount(0);
  await date.selectOption('this-month');
  await expect(created).toBeVisible();
});

test('budget shows progress and switches to over budget when the limit is lowered', async ({ page }) => {
  await open(page, 'budgets');
  const overall = page.locator('[data-testid="budget-card"][data-budget="overall"]');
  await expect(overall.getByRole('progressbar')).toBeVisible();
  await expect(overall).toContainText(/\d+%/);
  await overall.getByRole('button', { name: 'Edit overall budget' }).click();
  await page.getByTestId('budget-amount').fill('1');
  await page.getByTestId('budget-submit').click();
  await expect(overall).toHaveAttribute('data-state', 'over');
  await expect(overall).toContainText('Over budget');
  await expect(overall).toContainText('Over by');
  const progress = overall.getByRole('progressbar');
  const maximum = Number(await progress.getAttribute('aria-valuemax'));
  const current = Number(await progress.getAttribute('aria-valuenow'));
  expect(current, 'The over-budget progressbar must report a value in its declared range').toBeLessThanOrEqual(maximum);
});

test('mark a recurring bill paid and reload without duplicate transactions', async ({ page, isMobile }) => {
  await open(page, 'transactions');
  const findPayment = () => page.getByTestId('tx-search').fill('Jio recharge');
  const bills = row(page, 'Jio recharge');
  const billIds = () => bills.evaluateAll(elements => elements.map(element => element.getAttribute('data-tx-id')));
  await findPayment();
  await expect(bills.first()).toBeVisible();
  const before = await billIds();
  await navigate(page, 'recurring', isMobile);
  await page.getByRole('button', { name: 'Mark Jio recharge as paid' }).click();
  await expect(page.getByTestId('toast')).toContainText('Jio recharge recorded');
  await navigate(page, 'transactions', isMobile);
  await findPayment();
  await expect(bills).toHaveCount(before.length + 1);
  const after = await billIds();
  expect(after).toEqual(expect.arrayContaining(before));
  const added = after.filter(id => !before.includes(id));
  expect(added).toHaveLength(1);
  await expect(page.locator(`[data-tx-id="${added[0]}"]`)).toContainText('349');
  await page.reload();
  await ready(page, 'transactions');
  await findPayment();
  await expect.poll(billIds).toEqual(after);
});

test('a contribution updates the savings goal progress', async ({ page }) => {
  await open(page, 'goals');
  const goal = page.getByTestId('goal-card').filter({ hasText: 'Emergency fund' });
  const progress = goal.getByRole('progressbar');
  const before = Number(await progress.getAttribute('aria-valuenow'));
  await goal.getByTestId('add-contribution').click();
  await page.getByTestId('contribution-amount').fill('30000');
  await page.getByTestId('contribution-submit').click();
  await expect(progress).toHaveAttribute('aria-valuenow', String(before + 10));
});

test('theme toggle persists after reload', async ({ page }) => {
  await open(page, 'dashboard');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
  await setLightTheme(page);
  await page.reload();
  await ready(page, 'dashboard');
  await expect(page.getByTestId('theme-toggle')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
});

async function download(page: Page, button: string) {
  const [file] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId(button).click(),
  ]);
  return { name: file.suggestedFilename(), data: await readFile(await file.path(), 'utf8') };
}

test('CSV export downloads a filtered transaction file', async ({ page }) => {
  await open(page, 'transactions');
  await page.keyboard.press('n');
  await expense(page, 'QA CSV lunch', '180');
  await page.getByTestId('tx-search').fill('QA CSV lunch');
  await expect(page.getByTestId('transaction-row')).toHaveCount(1);
  const { name, data } = await download(page, 'export-csv');
  expect(name).toMatch(/^kosh-transactions-.*\.csv$/);
  const [header, ...rows] = data.trim().split(/\r?\n/);
  expect(header.replace(/^\uFEFF/, '')).toBe('date,type,amount,category,account,to_account,payee,note,tags');
  expect(rows).toHaveLength(1);
  expect(rows[0]).toContain(',expense,180,');
  expect(rows[0]).toContain('QA CSV lunch');
});

async function confirm(page: Page, trigger: string, title: string) {
  await page.getByTestId(trigger).click();
  const dialog = page.getByRole('dialog', { name: title });
  await dialog.getByTestId('confirm-dialog-confirm').click();
  await expect(dialog).toBeHidden();
}

async function clearData(page: Page) {
  await confirm(page, 'clear-all', 'Clear all data?');
  await expect(page.getByTestId('settings-export-csv')).toBeDisabled();
}

test('a JSON backup restores all data slices and preferences after clearing', async ({ page }) => {
  await open(page, 'settings');
  await page.getByTestId('settings-name').fill('QA Backup');
  await setLightTheme(page);
  await page.keyboard.press('n');
  await expense(page, 'QA backup lunch', '212');
  const { name, data } = await download(page, 'backup-json');
  expect(name).toMatch(/^kosh-backup-.*\.json$/);
  const backup = JSON.parse(data);
  expect(backup.app).toBe('kosh');
  expect(backup.transactions).toEqual(expect.arrayContaining([expect.objectContaining({ payee: 'QA backup lunch' })]));
  await clearData(page);
  await page.getByTestId('settings-name').fill('Replacement');
  await page.getByTestId('restore-json-input').setInputFiles({
    name, mimeType: 'application/json', buffer: Buffer.from(data),
  });
  await page.getByRole('dialog', { name: 'Restore backup?' }).getByTestId('confirm-dialog-confirm').click();
  await expect(page.getByTestId('settings-name')).toHaveValue('QA Backup');
  await expect(page.getByTestId('settings-export-csv')).toBeEnabled();
  await page.reload();
  await ready(page, 'settings');
  const restored = JSON.parse((await download(page, 'backup-json')).data);
  expect(restored).toEqual({ ...backup, exportedAt: restored.exportedAt });
});

test('clear data shows a persistent empty state and reset restores the demo', async ({ page, isMobile }) => {
  await open(page, 'settings');
  await clearData(page);
  await navigate(page, 'dashboard', isMobile);
  await expect(page.getByTestId('empty-state')).toContainText('A fresh start');
  await expect(page.getByTestId('kpi-networth')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('empty-state')).toContainText('A fresh start');
  await navigate(page, 'settings', isMobile);
  await confirm(page, 'reset-demo', 'Reset to demo data?');
  await expect(page.getByTestId('settings-export-csv')).toBeEnabled();
  await navigate(page, 'dashboard', isMobile);
  await expect(page.getByTestId('kpi-networth')).toBeVisible();
  await expect(page.getByTestId('transaction-row').first()).toBeVisible();
});

test('Ctrl+K opens the command palette and Enter navigates to a result', async ({ page }) => {
  await open(page, 'dashboard');
  await page.keyboard.press('Control+k');
  const input = page.getByTestId('command-input');
  await expect(input).toBeFocused();
  await input.fill('settings');
  await expect(page.getByRole('option', { name: /Settings/ })).toBeVisible();
  await input.press('Enter');
  await expect(input).toBeHidden();
  await expect(page).toHaveURL(url => url.pathname === '/settings');
  await ready(page, 'settings');
});
