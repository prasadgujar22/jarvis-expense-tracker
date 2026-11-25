import { expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { expense, open, ready, row, test } from './fixtures';

/** Number of transactions whose payee/note/tags match `query` on the Transactions page. */
async function countMatching(page: Page, query: string) {
  await open(page, 'transactions');
  await page.getByTestId('tx-search').fill(query);
  await expect(page.getByTestId('transaction-list').or(page.getByTestId('empty-state'))).toBeVisible();
  return page.getByTestId('transaction-row').filter({ hasText: query }).count();
}

async function editRecurring(page: Page, title: string, change: (dialog: ReturnType<Page['getByTestId']>) => Promise<void>) {
  await open(page, 'recurring');
  await page.getByRole('button', { name: 'Edit ' + title, exact: true }).click();
  const dialog = page.getByTestId('recurring-modal');
  await expect(dialog).toBeVisible();
  await change(dialog);
  await dialog.getByTestId('recurring-submit').click();
  await expect(dialog).toBeHidden();
}

async function openCsvImport(page: Page, name: string, csv: string) {
  await open(page, 'settings');
  await page.getByTestId('settings-import-csv').click();
  const dialog = page.getByTestId('csv-import-modal');
  await expect(dialog).toBeVisible();
  await dialog.getByTestId('csv-file-input').setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(dialog.getByTestId('csv-preview')).toBeVisible();
  return dialog;
}

test.describe('recurring rules', () => {
  test('changing a rule start date does not duplicate its posted transactions', async ({ page }) => {
    const before = await countMatching(page, 'Netflix');
    expect(before).toBeGreaterThan(3);
    await editRecurring(page, 'Netflix', async (dialog) => {
      const start = dialog.getByLabel('Starts / first due');
      const value = await start.inputValue();
      // Shift the day of month by one (e.g. 2026-06-08 → 2026-06-09).
      const day = Number(value.slice(8, 10));
      await start.fill(value.slice(0, 8) + String(day === 28 ? 27 : day + 1).padStart(2, '0'));
    });
    await expect(page.getByTestId('toast')).toContainText('Recurring saved');
    expect(await countMatching(page, 'Netflix')).toBe(before);
    // And reloading (which re-runs auto-posting) still adds nothing.
    await page.reload();
    await ready(page, 'transactions');
    await page.getByTestId('tx-search').fill('Netflix');
    await expect(row(page, 'Netflix')).toHaveCount(before);
  });

  test('moving a rule to an earlier day keeps the next payment due', async ({ page }) => {
    await editRecurring(page, 'Netflix', async (dialog) => {
      const start = dialog.getByLabel('Starts / first due');
      const value = await start.inputValue();
      await start.fill(value.slice(0, 8) + '07');
    });
    await open(page, 'recurring');
    // Nov 8 was paid under the old schedule; the new schedule's next charge is 7 Dec.
    await expect(page.getByTestId('recurring-rule').filter({ hasText: 'Netflix' })).toContainText('next 7 Dec');
  });

  test('resuming a paused rule does not back-post the payments missed while paused', async ({ page }) => {
    await editRecurring(page, 'Netflix', async (dialog) => {
      await dialog.getByRole('switch', { name: 'Active' }).click();
    });
    // Three months pass while Netflix is paused.
    await page.clock.setFixedTime(new Date('2027-02-25T12:00:00+05:30'));
    const paused = await countMatching(page, 'Netflix');
    await editRecurring(page, 'Netflix', async (dialog) => {
      await expect(dialog.getByRole('switch', { name: 'Active' })).toHaveAttribute('aria-checked', 'false');
      await dialog.getByRole('switch', { name: 'Active' }).click();
    });
    expect(await countMatching(page, 'Netflix')).toBe(paused);
  });
});

test.describe('amount parsing', () => {
  test('quick add reads "Rs. 500" as five hundred rupees', async ({ page }) => {
    await open(page, 'transactions');
    await page.keyboard.press('n');
    await expense(page, 'QA rupee prefix', 'Rs. 500');
    await page.getByTestId('tx-search').fill('QA rupee prefix');
    await expect(row(page, 'QA rupee prefix')).toContainText('₹500.00');
  });

  test('CSV import parses Rs.-prefixed amounts and reports the real line of bad rows', async ({ page }) => {
    const csv = [
      'date,amount,description,category',
      '2026-11-20,Rs.1500,QA Rs import one,Groceries',
      '',
      '2026-11-21,"Rs. 1,250.50",QA Rs import two,Food & Dining',
      'not-a-date,100,QA bad row,Other',
    ].join('\n');
    const dialog = await openCsvImport(page, 'bank.csv', csv);
    const preview = dialog.getByTestId('csv-preview');
    await expect(preview).toContainText('₹1,500.00');
    await expect(preview).toContainText('₹1,250.50');
    // Header is line 1 and line 3 is blank, so the bad row is line 5 of the file.
    await expect(preview).toContainText('Line 5: Invalid date');
    await dialog.getByTestId('csv-import-confirm').click();
    await expect(page.getByTestId('toast')).toContainText('Imported 2 transactions');
    await open(page, 'transactions');
    await page.getByTestId('tx-search').fill('QA Rs import');
    await expect(row(page, 'QA Rs import one')).toContainText('₹1,500.00');
    await expect(row(page, 'QA Rs import two')).toContainText('₹1,250.50');
  });
});

test.describe('CSV export safety and re-import', () => {
  test('formula-like payees are neutralised on export and recognised as duplicates on re-import', async ({ page }) => {
    const payee = '=HYPERLINK("http://evil.example","x")';
    await open(page, 'transactions');
    await page.keyboard.press('n');
    await expense(page, payee, '42');
    await page.getByTestId('tx-search').fill('HYPERLINK');
    await expect(page.getByTestId('transaction-row')).toHaveCount(1);

    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-csv').click()]);
    const data = await readFile(await download.path(), 'utf8');
    const [, line] = data.trim().split(/\r?\n/);
    // Quoted (it contains commas and quotes) AND guarded with a leading apostrophe.
    expect(line).toContain('"\'=HYPERLINK(""http://evil.example"",""x"")"');
    // No field may start with a formula trigger once the CSV quoting is removed.
    expect(line).not.toMatch(/(^|,)"?[=+@]/);

    const dialog = await openCsvImport(page, download.suggestedFilename(), data);
    // Apostrophe is stripped again, and the row is flagged as already present.
    await expect(dialog.getByTestId('csv-preview')).toContainText(payee);
    await expect(dialog.getByTestId('csv-duplicates')).toBeVisible();
    await expect(dialog.getByTestId('csv-preview-row').first()).toHaveAttribute('data-duplicate', 'true');
    await expect(dialog.getByTestId('csv-import-confirm')).toBeDisabled();
    await dialog.getByTestId('csv-include-duplicates').check();
    await expect(dialog.getByTestId('csv-import-confirm')).toHaveText('Import 1 transactions');
  });
});

test('command palette "Search all transactions" works while already on Transactions', async ({ page }) => {
  await open(page, 'transactions');
  await page.keyboard.press('Control+k');
  await page.getByTestId('command-input').fill('Swiggy');
  await page.getByRole('option', { name: /Search all transactions/ }).click();
  await expect(page).toHaveURL(/\/transactions\?q=Swiggy/);
  await expect(page.getByTestId('tx-search')).toHaveValue('Swiggy');
  await expect(page.getByTestId('transaction-row').first()).toContainText('Swiggy');
});

test('a goal can be saved with a target date in the past', async ({ page }) => {
  await open(page, 'goals');
  await page.getByRole('button', { name: 'Edit Emergency fund', exact: true }).click();
  const dialog = page.getByTestId('goal-modal');
  await dialog.getByLabel('Target date').fill('2026-10-01');
  await dialog.getByTestId('goal-submit').click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('goal-card').filter({ hasText: 'Emergency fund' })).toContainText('1 Oct 2026');
});

test('changes made in one tab appear in another without losing either', async ({ page, context, isMobile }) => {
  await open(page, 'transactions');
  const other = await context.newPage();
  await other.clock.setFixedTime(new Date('2026-11-25T12:00:00+05:30'));
  await other.goto('/transactions');
  await ready(other, 'transactions');

  await page.bringToFront();
  await page.keyboard.press('n');
  await expense(page, 'QA tab one', '11');
  // The other tab picks the new transaction up from the storage event, without a reload.
  await other.getByTestId('tx-search').fill('QA tab');
  await expect(row(other, 'QA tab one')).toHaveCount(1);

  await other.bringToFront();
  // The search box has focus, where N is just typed text, so use the visible quick-add control.
  await other.getByTestId(isMobile ? 'quick-add-fab' : 'quick-add-button').click();
  await expense(other, 'QA tab two', '22');
  await page.reload();
  await ready(page, 'transactions');
  await page.getByTestId('tx-search').fill('QA tab');
  await expect(row(page, 'QA tab one')).toHaveCount(1);
  await expect(row(page, 'QA tab two')).toHaveCount(1);
});
