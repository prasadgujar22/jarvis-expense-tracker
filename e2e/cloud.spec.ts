import { expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { apiAs, rows } from './support/api';
import { asUser, expense, navigate, newUserContext, open, ready, row, submitTransaction, synced, test, type Route } from './fixtures';

// Every flow here runs as user A against the real Supabase project, in order, starting from an empty account.
test.use(asUser('A'));
test.describe.configure({ mode: 'serial' });

async function completeOnboarding(page: Page, name: string, account: string, opening: string) {
  await expect(page.getByTestId('onboarding')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('onb-start').click();
  await page.getByTestId('onb-name').fill(name);
  await page.getByTestId('onb-next').click();
  await expect(page.getByTestId('onb-currency-INR')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('onb-next').click();
  await page.getByTestId('onb-type-bank').click();
  await page.getByTestId('onb-account-name').fill(account);
  await page.getByTestId('onb-opening').fill(opening);
  await page.getByTestId('onb-next').click();
  await expect(page.getByTestId('onb-step-4')).toContainText(account);
  await page.getByTestId('onb-finish').click();
  await ready(page, 'dashboard');
}

async function go(page: Page, route: Route) {
  if (page.url() === 'about:blank') await open(page, route);
  else await navigate(page, route, false);
}

async function countMatching(page: Page, query: string) {
  await go(page, 'transactions');
  await page.getByTestId('tx-search').fill(query);
  await expect(page.getByTestId('transaction-list').or(page.getByTestId('empty-state'))).toBeVisible();
  return page.getByTestId('transaction-row').filter({ hasText: query }).count();
}

async function editRecurring(page: Page, title: string, change: (dialog: ReturnType<Page['getByTestId']>) => Promise<void>) {
  await go(page, 'recurring');
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

async function download(page: Page, button: string) {
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByTestId(button).click()]);
  return { name: file.suggestedFilename(), data: await readFile(await file.path(), 'utf8') };
}

async function accountId() {
  const accs = await rows('A', 'accounts');
  return String(accs.find((a) => a.name === 'HDFC Savings')?.id);
}

test('a new user starts with an empty account and onboarding creates the first account', async ({ page }) => {
  expect(await rows('A', 'transactions')).toHaveLength(0);
  await page.goto('/');
  await completeOnboarding(page, 'QA Asha', 'HDFC Savings', '50,000');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('QA Asha');
  await synced(page);
  const accs = await rows('A', 'accounts');
  expect(accs).toHaveLength(1);
  expect(accs[0]).toMatchObject({ name: 'HDFC Savings', type: 'bank', opening_balance: 5000000 });
  const [settings] = await rows('A', 'settings');
  expect(settings).toMatchObject({ onboarded: true, name: 'QA Asha', currency: 'INR' });
  expect((await rows('A', 'categories')).length).toBe(20);
  // No demo data anywhere.
  expect(await rows('A', 'transactions')).toHaveLength(0);
  await page.reload();
  await ready(page, 'dashboard');
});

test('add, edit and delete a transaction persists across reload and a brand-new context', async ({ page, browser }, info) => {
  await open(page, 'transactions');
  await page.keyboard.press('n');
  await expense(page, 'QA cloud lunch', '250');
  await expect(row(page, 'QA cloud lunch')).toContainText('₹250.00');
  await synced(page);
  await page.reload();
  await ready(page, 'transactions');
  await expect(row(page, 'QA cloud lunch')).toContainText('₹250.00');

  const other = await newUserContext(browser, info, 'A');
  try {
    await open(other.page, 'transactions');
    await expect(row(other.page, 'QA cloud lunch')).toContainText('₹250.00');
  } finally {
    await other.context.close();
  }

  await row(page, 'QA cloud lunch').getByRole('button', { name: /^Edit / }).click();
  await page.getByTestId('payee-input').fill('QA cloud dinner');
  await page.getByTestId('amount-input').fill('300');
  await submitTransaction(page);
  await expect(row(page, 'QA cloud dinner')).toContainText('₹300.00');
  await synced(page);
  const tx = (await rows('A', 'transactions')).find((t) => t.payee === 'QA cloud dinner');
  expect(tx).toMatchObject({ amount: 30000, type: 'expense', category_id: 'cat_food' });

  const second = await newUserContext(browser, info, 'A');
  try {
    await open(second.page, 'transactions');
    await expect(row(second.page, 'QA cloud dinner')).toContainText('₹300.00');
    await expect(row(second.page, 'QA cloud lunch')).toHaveCount(0);
  } finally {
    await second.context.close();
  }

  await row(page, 'QA cloud dinner').getByTestId('transaction-delete').click();
  await expect(row(page, 'QA cloud dinner')).toHaveCount(0);
  await synced(page);
  expect((await rows('A', 'transactions')).filter((t) => String(t.payee).startsWith('QA cloud'))).toHaveLength(0);
  const third = await newUserContext(browser, info, 'A');
  try {
    await open(third.page, 'transactions');
    await expect(third.page.getByTestId('empty-state')).toContainText('No transactions yet');
  } finally {
    await third.context.close();
  }
});

test('budgets, goals and recurring rules: basic CRUD persists to the cloud', async ({ page, browser }, info) => {
  // Budget
  await open(page, 'budgets');
  await page.getByTestId('add-budget').click();
  await page.getByTestId('budget-amount').fill('20000');
  await page.getByTestId('budget-submit').click();
  const overall = page.locator('[data-testid="budget-card"][data-budget="overall"]');
  await expect(overall).toContainText('₹20,000');
  // Goal + contribution
  await navigate(page, 'goals', false);
  await page.getByTestId('add-goal').first().click();
  await page.getByTestId('goal-name').fill('QA Laptop');
  await page.getByTestId('goal-target').fill('100000');
  await page.getByTestId('goal-submit').click();
  const goal = page.getByTestId('goal-card').filter({ hasText: 'QA Laptop' });
  await goal.getByTestId('add-contribution').click();
  await page.getByTestId('contribution-amount').fill('25000');
  await page.getByTestId('contribution-submit').click();
  await expect(goal.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
  // Recurring
  await navigate(page, 'recurring', false);
  await page.getByTestId('add-recurring').click();
  await page.getByTestId('recurring-title').fill('QA Gym');
  await page.getByTestId('recurring-amount').fill('1500');
  await page.getByTestId('recurring-submit').click();
  await expect(page.getByTestId('recurring-rule').filter({ hasText: 'QA Gym' })).toBeVisible();
  await synced(page);

  expect(await rows('A', 'budgets')).toEqual([expect.objectContaining({ category_id: null, amount: 2000000 })]);
  const [g] = await rows('A', 'goals');
  expect(g).toMatchObject({ name: 'QA Laptop', target: 10000000 });
  expect(g.contributions).toEqual([expect.objectContaining({ amount: 2500000 })]);
  expect((await rows('A', 'recurring_rules')).map((r) => r.title)).toEqual(['QA Gym']);

  const other = await newUserContext(browser, info, 'A');
  try {
    const p = other.page;
    await open(p, 'budgets');
    await expect(p.locator('[data-testid="budget-card"][data-budget="overall"]')).toContainText('₹20,000');
    await open(p, 'goals');
    await expect(p.getByTestId('goal-card').filter({ hasText: 'QA Laptop' }).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
    await open(p, 'recurring');
    await expect(p.getByTestId('recurring-rule').filter({ hasText: 'QA Gym' })).toBeVisible();
    // Edit + delete from the second device.
    await p.getByRole('button', { name: 'Delete QA Gym', exact: true }).click();
    await p.getByTestId('confirm-dialog-confirm').click();
    await open(p, 'goals');
    await p.getByRole('button', { name: 'Delete QA Laptop', exact: true }).click();
    await p.getByTestId('confirm-dialog-confirm').click();
    await expect(p.getByTestId('goal-card')).toHaveCount(0);
    await open(p, 'budgets');
    await p.getByRole('button', { name: 'Edit overall budget' }).click();
    await p.getByTestId('budget-amount').fill('15000');
    await p.getByTestId('budget-submit').click();
    await synced(p);
  } finally {
    await other.context.close();
  }
  expect(await rows('A', 'recurring_rules')).toHaveLength(0);
  expect(await rows('A', 'goals')).toHaveLength(0);
  expect(await rows('A', 'budgets')).toEqual([expect.objectContaining({ amount: 1500000 })]);
  await page.reload();
  await ready(page, 'recurring');
  await expect(page.getByTestId('recurring-rule')).toHaveCount(0);
});

test.describe('recurring rules', () => {
  test('auto-posting is idempotent across devices (deterministic ids)', async ({ page, browser }, info) => {
    const { db, userId } = apiAs('A');
    const acc = await accountId();
    const { error } = await db.from('recurring_rules').insert({
      user_id: userId, id: 'rec_qa_netflix', title: 'Netflix', type: 'expense', amount: 64900, category_id: 'cat_subscriptions', account_id: acc,
      frequency: 'monthly', interval: 1, start_date: '2026-06-08', auto_post: true, is_subscription: true, active: true,
    });
    expect(error).toBeNull();
    // Two devices open at the same time both see the rule as due.
    const other = await newUserContext(browser, info, 'A');
    try {
      await Promise.all([open(page, 'transactions'), open(other.page, 'transactions')]);
      await Promise.all([synced(page), synced(other.page)]);
      expect(await countMatching(page, 'Netflix')).toBe(6);
      expect(await countMatching(other.page, 'Netflix')).toBe(6);
    } finally {
      await other.context.close();
    }
    const posted = (await rows('A', 'transactions')).filter((t) => t.recurring_id === 'rec_qa_netflix');
    expect(posted).toHaveLength(6);
    expect(posted.map((t) => t.id).sort()).toEqual(['06', '07', '08', '09', '10', '11'].map((m) => 'rec:rec_qa_netflix:2026-' + m + '-08'));
    const [rule] = (await rows('A', 'recurring_rules')).filter((r) => r.id === 'rec_qa_netflix');
    expect(rule.posted_through).toBe('2026-11-08');
  });

  test('changing a rule start date does not duplicate its posted transactions', async ({ page }) => {
    const before = await countMatching(page, 'Netflix');
    expect(before).toBe(6);
    await editRecurring(page, 'Netflix', async (dialog) => {
      await dialog.getByLabel('Starts / first due').fill('2026-06-09');
    });
    await expect(page.getByTestId('toast')).toContainText('Recurring saved');
    expect(await countMatching(page, 'Netflix')).toBe(before);
    await synced(page);
    await page.reload();
    await ready(page, 'transactions');
    await page.getByTestId('tx-search').fill('Netflix');
    await expect(row(page, 'Netflix')).toHaveCount(before);
  });

  test('moving a rule to an earlier day keeps the next payment due', async ({ page }) => {
    await editRecurring(page, 'Netflix', async (dialog) => {
      await dialog.getByLabel('Starts / first due').fill('2026-06-07');
    });
    await go(page, 'recurring');
    await expect(page.getByTestId('recurring-rule').filter({ hasText: 'Netflix' })).toContainText('next 7 Dec');
    await synced(page);
  });

  test('resuming a paused rule does not back-post the payments missed while paused', async ({ page, browser }, info) => {
    await editRecurring(page, 'Netflix', async (dialog) => {
      await dialog.getByRole('switch', { name: 'Active' }).click();
    });
    await synced(page);
    const paused = await countMatching(page, 'Netflix');
    // Three months later, on another device.
    const later = await newUserContext(browser, info, 'A', new Date('2027-02-25T12:00:00+05:30'));
    try {
      await editRecurring(later.page, 'Netflix', async (dialog) => {
        await expect(dialog.getByRole('switch', { name: 'Active' })).toHaveAttribute('aria-checked', 'false');
        await dialog.getByRole('switch', { name: 'Active' }).click();
      });
      expect(await countMatching(later.page, 'Netflix')).toBe(paused);
      await synced(later.page);
    } finally {
      await later.context.close();
    }
    expect((await rows('A', 'transactions')).filter((t) => t.recurring_id === 'rec_qa_netflix')).toHaveLength(paused);
  });

  test('mark a recurring bill paid and reload without duplicate transactions', async ({ page }) => {
    const { db, userId } = apiAs('A');
    const { error } = await db.from('recurring_rules').insert({
      user_id: userId, id: 'rec_qa_jio', title: 'Jio recharge', type: 'expense', amount: 34900, category_id: 'cat_bills', account_id: await accountId(),
      frequency: 'monthly', interval: 1, start_date: '2026-11-28', auto_post: false, active: true,
    });
    expect(error).toBeNull();
    await open(page, 'recurring');
    await page.getByRole('button', { name: 'Mark Jio recharge as paid' }).click();
    await expect(page.getByTestId('toast')).toContainText('Jio recharge recorded');
    await synced(page);
    expect(await countMatching(page, 'Jio recharge')).toBe(1);
    await page.reload();
    await ready(page, 'transactions');
    await page.getByTestId('tx-search').fill('Jio recharge');
    await expect(row(page, 'Jio recharge')).toHaveCount(1);
    await expect(row(page, 'Jio recharge')).toContainText('349');
    expect((await rows('A', 'transactions')).filter((t) => t.recurring_id === 'rec_qa_jio')).toHaveLength(1);
  });
});

test.describe('amount parsing and CSV', () => {
  test('quick add reads "Rs. 500" as five hundred rupees', async ({ page }) => {
    await open(page, 'transactions');
    await page.keyboard.press('n');
    await expense(page, 'QA rupee prefix', 'Rs. 500');
    await page.getByTestId('tx-search').fill('QA rupee prefix');
    await expect(row(page, 'QA rupee prefix')).toContainText('₹500.00');
    await synced(page);
    expect((await rows('A', 'transactions')).find((t) => t.payee === 'QA rupee prefix')).toMatchObject({ amount: 50000 });
  });

  test('CSV import parses Rs.-prefixed amounts, reports the real line of bad rows and uploads the rows', async ({ page }) => {
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
    await expect(preview).toContainText('Line 5: Invalid date');
    await dialog.getByTestId('csv-import-confirm').click();
    await expect(page.getByTestId('toast')).toContainText('Imported 2 transactions');
    await synced(page);
    const imported = (await rows('A', 'transactions')).filter((t) => String(t.payee).startsWith('QA Rs import'));
    expect(imported.map((t) => t.amount).sort()).toEqual([125050, 150000]);
  });

  test('formula-like payees are neutralised on export and recognised as duplicates on re-import', async ({ page }) => {
    const payee = '=HYPERLINK("http://evil.example","x")';
    await open(page, 'transactions');
    await page.keyboard.press('n');
    await expense(page, payee, '42');
    await page.getByTestId('tx-search').fill('HYPERLINK');
    await expect(page.getByTestId('transaction-row')).toHaveCount(1);
    const { name, data } = await download(page, 'export-csv');
    const [, line] = data.trim().split(/\r?\n/);
    expect(line).toContain('"\'=HYPERLINK(""http://evil.example"",""x"")"');
    expect(line).not.toMatch(/(^|,)"?[=+@]/);
    const dialog = await openCsvImport(page, name, data);
    await expect(dialog.getByTestId('csv-preview')).toContainText(payee);
    await expect(dialog.getByTestId('csv-duplicates')).toBeVisible();
    await expect(dialog.getByTestId('csv-import-confirm')).toBeDisabled();
  });
});

test('changes made in one tab appear in another without losing either', async ({ page, context }) => {
  const other = await context.newPage();
  await Promise.all([open(page, 'transactions'), open(other, 'transactions')]);
  await page.bringToFront();
  await page.keyboard.press('n');
  await expense(page, 'QA tab one', '11');
  await other.getByTestId('tx-search').fill('QA tab');
  await expect(row(other, 'QA tab one')).toHaveCount(1);
  await other.bringToFront();
  await other.getByTestId('quick-add-button').click();
  await expense(other, 'QA tab two', '22');
  await page.getByTestId('tx-search').fill('QA tab');
  await expect(row(page, 'QA tab two')).toHaveCount(1);
  await synced(page);
  await synced(other);
  await page.reload();
  await ready(page, 'transactions');
  await page.getByTestId('tx-search').fill('QA tab');
  await expect(row(page, 'QA tab one')).toHaveCount(1);
  await expect(row(page, 'QA tab two')).toHaveCount(1);
  expect((await rows('A', 'transactions')).filter((t) => String(t.payee).startsWith('QA tab'))).toHaveLength(2);
});

test('offline: a transaction added offline shows Offline status and syncs when back online', async ({ page, context }) => {
  await open(page, 'transactions');
  await synced(page);
  const pill = page.getByTestId('sync-status');
  await context.setOffline(true);
  await expect(pill).toHaveAttribute('data-state', 'offline');
  await expect(pill).toContainText('Offline – changes saved on this device');
  await page.keyboard.press('n');
  await expense(page, 'QA offline chai', '30');
  await expect(row(page, 'QA offline chai')).toBeVisible();
  await expect(pill).toHaveAttribute('data-pending', '1');
  expect((await rows('A', 'transactions')).some((t) => t.payee === 'QA offline chai')).toBe(false);
  // The pending change survives a reload-free wait and goes up once the network returns.
  await context.setOffline(false);
  await synced(page);
  await expect.poll(async () => (await rows('A', 'transactions')).some((t) => t.payee === 'QA offline chai')).toBe(true);
});

test('legacy v1 data on this device: import prompt uploads it and removes the local copy', async ({ page, browser }, info) => {
  await open(page, 'transactions');
  await synced(page);
  await page.evaluate(() => {
    localStorage.setItem('kosh:v1:meta', JSON.stringify({ initialized: true, schema: 1 }));
    localStorage.setItem('kosh:v1:settings', JSON.stringify({ currency: 'INR', theme: 'dark', name: 'Old me', lastAccountId: null }));
    localStorage.setItem('kosh:v1:accounts', JSON.stringify([{ id: 'acc_legacy', name: 'Legacy wallet', type: 'wallet', openingBalance: 100000, color: '#14b8a6', archived: false }]));
    localStorage.setItem('kosh:v1:transactions', JSON.stringify([
      { id: 'tx_legacy_1', type: 'expense', amount: 4200, categoryId: 'cat_food', accountId: 'acc_legacy', toAccountId: null, date: '2026-11-20', payee: 'QA legacy dosa', note: '', tags: [], recurringId: null, createdAt: 1763600000000 },
    ]));
  });
  await page.reload();
  const dialog = page.getByTestId('legacy-import');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('legacy-summary')).toContainText('1 transaction · 1 account');
  await dialog.getByTestId('legacy-import-confirm').click();
  await expect(dialog).toBeHidden();
  await page.getByTestId('tx-search').fill('QA legacy');
  await expect(row(page, 'QA legacy dosa')).toContainText('₹42.00');
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('kosh:v1:')))).toEqual([]);
  await synced(page);
  // Settings of an already-onboarded account are kept.
  expect((await rows('A', 'settings'))[0]).toMatchObject({ name: 'QA Asha' });
  const other = await newUserContext(browser, info, 'A');
  try {
    await open(other.page, 'accounts');
    await expect(other.page.getByTestId('account-card').filter({ hasText: 'Legacy wallet' })).toBeVisible();
    await expect(other.page.getByTestId('legacy-import')).toHaveCount(0);
  } finally {
    await other.context.close();
  }
  // "Not now" / "Discard" paths
  await page.evaluate(() => localStorage.setItem('kosh:v1:transactions', JSON.stringify([{ id: 'tx_legacy_2', type: 'expense', amount: 100, categoryId: 'cat_food', accountId: 'acc_legacy', date: '2026-11-21', payee: 'QA legacy two' }])));
  await page.reload();
  await page.getByTestId('legacy-discard').click();
  await expect(page.getByTestId('legacy-import')).toBeHidden();
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('kosh:v1:')))).toEqual([]);
});

test('row-level security: user B sees none of user A\'s data (UI and REST)', async ({ browser }, info) => {
  const aRows = await rows('A', 'transactions');
  expect(aRows.length).toBeGreaterThan(0);
  const b = await newUserContext(browser, info, 'B');
  try {
    await open(b.page, 'transactions');
    await expect(b.page.getByTestId('empty-state')).toContainText('No transactions yet');
    await open(b.page, 'accounts');
    await expect(b.page.getByTestId('empty-state')).toContainText('No accounts yet');
  } finally {
    await b.context.close();
  }
  const { db } = apiAs('B');
  const { userId: aId } = apiAs('A');
  for (const t of ['transactions', 'accounts', 'recurring_rules', 'budgets', 'goals'] as const) {
    const { data, error } = await db.from(t).select('*');
    expect(error).toBeNull();
    expect(data, t).toEqual([]);
  }
  const { data: direct } = await db.from('transactions').select('*').eq('user_id', aId);
  expect(direct).toEqual([]);
  const { data: settingsRows } = await db.from('settings').select('user_id');
  expect((settingsRows ?? []).every((r) => r.user_id !== aId)).toBe(true);
  // Writes into A's rows are refused or affect nothing.
  const ins = await db.from('transactions').insert({ user_id: aId, id: 'tx_evil', type: 'expense', amount: 100, account_id: 'x', date: '2026-11-25' });
  expect(ins.error).not.toBeNull();
  const upd = await db.from('transactions').update({ payee: 'pwned' }).eq('user_id', aId).select();
  expect(upd.data ?? []).toEqual([]);
  const del = await db.from('transactions').delete().eq('user_id', aId).select();
  expect(del.data ?? []).toEqual([]);
  expect((await rows('A', 'transactions')).length).toBe(aRows.length);
});

test('JSON backup survives "Clear all data" (typed confirmation) and restore writes back to the cloud', async ({ page, browser }, info) => {
  await open(page, 'settings');
  await synced(page);
  const { data } = await download(page, 'backup-json');
  const backup = JSON.parse(data);
  expect(backup.app).toBe('kosh');
  expect(backup.transactions.length).toBeGreaterThan(5);
  await page.getByTestId('clear-all').click();
  const dialog = page.getByTestId('clear-dialog');
  await expect(dialog.getByTestId('confirm-dialog-confirm')).toBeDisabled();
  await dialog.getByTestId('clear-confirm-input').fill('DELETE');
  await dialog.getByTestId('confirm-dialog-confirm').click();
  // Everything is gone server-side and the user starts over.
  await expect(page.getByTestId('onboarding')).toBeVisible();
  for (const t of ['transactions', 'accounts', 'categories', 'settings'] as const) expect(await rows('A', t), t).toHaveLength(0);
  await completeOnboarding(page, 'QA Asha', 'Temp account', '0');
  await open(page, 'settings');
  await page.getByTestId('restore-json-input').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(data) });
  await page.getByRole('dialog', { name: 'Restore backup?' }).getByTestId('confirm-dialog-confirm').click();
  await expect(page.getByTestId('settings-export-csv')).toBeEnabled();
  await synced(page);
  const txs = await rows('A', 'transactions');
  expect(txs.length).toBe(backup.transactions.length);
  expect((await rows('A', 'accounts')).map((a) => a.name).sort()).toEqual(backup.accounts.map((a: { name: string }) => a.name).sort());
  const other = await newUserContext(browser, info, 'A');
  try {
    await open(other.page, 'transactions');
    await other.page.getByTestId('tx-search').fill('QA legacy dosa');
    await expect(row(other.page, 'QA legacy dosa')).toHaveCount(1);
  } finally {
    await other.context.close();
  }
});
