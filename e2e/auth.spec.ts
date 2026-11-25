import { expect } from '@playwright/test';
import { USERS } from './support/env';
import { checkA11y } from './support/axe';
import { expectNoOverflow, ready, setTheme, test, watchProblems } from './fixtures';

const fakeUser = (email: string) => ({
  id: '00000000-0000-4000-8000-000000000001',
  aud: 'authenticated',
  role: 'authenticated',
  email,
  phone: '',
  confirmation_sent_at: new Date().toISOString(),
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
  identities: [{ identity_id: 'i1', id: 'i1', user_id: '00000000-0000-4000-8000-000000000001', provider: 'email', identity_data: { email }, created_at: new Date().toISOString() }],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

test.describe('signed out', () => {
  test('the route guard sends deep links to the sign-in screen', async ({ page }) => {
    await page.goto('/budgets?month=2026-11');
    await expect(page).toHaveURL((u) => u.pathname === '/login' && u.searchParams.get('next') === '/budgets?month=2026-11');
    await expect(page.getByTestId('auth-screen')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeVisible();
    await page.goto('/');
    await expect(page).toHaveURL((u) => u.pathname === '/login');
  });

  test('inline validation and show/hide password', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('auth-submit').click();
    await expect(page.getByTestId('auth-email-error')).toContainText('Enter your email');
    await page.getByTestId('auth-email').fill('not-an-email');
    await page.getByTestId('auth-submit').click();
    await expect(page.getByTestId('auth-email-error')).toContainText('valid email');
    await page.getByTestId('auth-email').fill('someone@example.com');
    await page.getByTestId('auth-submit').click();
    await expect(page.getByTestId('auth-password-error')).toContainText('Enter your password');
    const pw = page.getByTestId('auth-password');
    await pw.fill('secret123');
    await expect(pw).toHaveAttribute('type', 'password');
    await page.getByTestId('toggle-password').click();
    await expect(pw).toHaveAttribute('type', 'text');
    await page.getByTestId('auth-tab-signup').click();
    await page.getByTestId('auth-password').fill('short');
    await page.getByTestId('auth-submit').click();
    await expect(page.getByTestId('auth-password-error')).toContainText('at least 8');
  });

  test('sign-up shows "check your email" with the address and can resend (mocked)', async ({ page }) => {
    const email = 'new.person+' + Date.now() + '@example.com';
    let signupBody: Record<string, unknown> | null = null;
    await page.route('**/auth/v1/signup**', async (route) => {
      signupBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeUser(email)) });
    });
    let resent = 0;
    await page.route('**/auth/v1/resend**', async (route) => {
      resent++;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.goto('/login');
    await page.getByTestId('auth-tab-signup').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Create your account' })).toBeVisible();
    await page.getByTestId('auth-email').fill(email);
    await page.getByTestId('auth-password').fill('Kosh-test-2026');
    await page.getByTestId('auth-submit').click();
    await expect(page.getByTestId('check-email')).toBeVisible();
    await expect(page.getByTestId('sent-email')).toHaveText(email);
    expect(signupBody).toMatchObject({ email, password: 'Kosh-test-2026' });
    await page.getByTestId('auth-resend').click();
    await expect(page.getByTestId('resend-done')).toBeVisible();
    expect(resent).toBe(1);
    await expect(page.getByTestId('auth-resend')).toBeDisabled();
  });

  test('sign-up for an existing address and SMTP refusals get friendly errors (mocked)', async ({ page }) => {
    await page.route('**/auth/v1/signup**', (route) =>
      route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 400, error_code: 'email_address_not_authorized', msg: 'Email address not authorized' }) }),
    );
    await page.goto('/login');
    await page.getByTestId('auth-tab-signup').click();
    await page.getByTestId('auth-email').fill('blocked@example.com');
    await page.getByTestId('auth-password').fill('Kosh-test-2026');
    await page.getByTestId('auth-submit').click();
    await expect(page.getByTestId('auth-error')).toContainText("can't send email to this address");
    await page.unroute('**/auth/v1/signup**');
    await page.route('**/auth/v1/signup**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...fakeUser('taken@example.com'), identities: [] }) }),
    );
    await page.getByTestId('auth-submit').click();
    await expect(page.getByTestId('auth-error')).toContainText('already exists');
  });

  test('forgot password shows a confirmation (mocked)', async ({ page }) => {
    let body: Record<string, unknown> | null = null;
    let url = '';
    await page.route('**/auth/v1/recover**', async (route) => {
      body = route.request().postDataJSON() as Record<string, unknown>;
      url = route.request().url();
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.goto('/login');
    await page.getByTestId('auth-forgot').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Reset your password' })).toBeVisible();
    await page.getByTestId('auth-email').fill('forgetful@example.com');
    await page.getByTestId('auth-submit').click();
    await expect(page.getByTestId('reset-sent')).toBeVisible();
    await expect(page.getByTestId('sent-email')).toHaveText('forgetful@example.com');
    expect(body).toMatchObject({ email: 'forgetful@example.com' });
    expect(decodeURIComponent(url)).toContain('redirect_to=' + new URL(page.url()).origin + '/reset-password');
    await page.getByTestId('auth-back').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeVisible();
  });

  test('magic link request shows a confirmation (mocked)', async ({ page }) => {
    await page.route('**/auth/v1/otp**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.goto('/login');
    await page.getByTestId('auth-email').fill('linky@example.com');
    await page.getByTestId('auth-magic-link').click();
    await expect(page.getByTestId('magic-sent')).toBeVisible();
  });

  test('an expired email link shows a friendly notice and a clean URL', async ({ page }) => {
    const problems = watchProblems(page);
    await page.goto('/?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
    await expect(page.getByTestId('auth-notice')).toContainText('expired');
    await expect(page).toHaveURL((u) => u.pathname === '/login' && !u.search.includes('error'));
    expect(problems).toEqual([]);
  });

  for (const theme of ['dark', 'light'] as const) {
    test('auth screen ' + theme + ': accessible, no overflow, no console errors', async ({ page }, info) => {
      const problems = watchProblems(page);
      await page.goto('/login');
      await expect(page.getByTestId('auth-screen')).toBeVisible();
      await setTheme(page, theme);
      await expectNoOverflow(page);
      await checkA11y(page, info.project.name + '-auth-signin-' + theme);
      await page.getByTestId('auth-tab-signup').click();
      await page.getByTestId('auth-password').fill('abc');
      await checkA11y(page, info.project.name + '-auth-signup-' + theme);
      expect(problems).toEqual([]);
    });
  }

  test('wrong password shows an inline error', async ({ page, isMobile }) => {
    test.skip(isMobile, 'real auth call: run once to stay under Supabase rate limits');
    await page.goto('/login');
    await page.getByTestId('auth-email').fill(USERS.A.email);
    await page.getByTestId('auth-password').fill(USERS.A.password + '-wrong');
    await page.getByTestId('auth-submit').click();
    await expect(page.getByTestId('auth-error')).toHaveText('Incorrect email or password.');
    await expect(page.getByTestId('auth-screen')).toBeVisible();
  });

  test('sign in restores the deep link; sign out returns to the sign-in screen', async ({ page, isMobile }) => {
    test.skip(isMobile, 'real auth call: run once to stay under Supabase rate limits');
    await page.goto('/goals');
    await expect(page).toHaveURL(/\/login\?next=%2Fgoals/);
    await page.getByTestId('auth-email').fill(USERS.B.email);
    await page.getByTestId('auth-password').fill(USERS.B.password);
    await page.getByTestId('auth-submit').click();
    await ready(page, 'goals');
    await expect(page).toHaveURL((u) => u.pathname === '/goals');
    await expect(page.getByTestId('user-email')).toHaveText(USERS.B.email);
    await page.getByTestId('sign-out').click();
    await expect(page.getByTestId('auth-screen')).toBeVisible();
    await expect(page).toHaveURL((u) => u.pathname === '/login');
    // In-memory state and this user's cache are gone.
    const leftovers = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('kosh:v2:') || k.startsWith('sb-')));
    expect(leftovers.filter((k) => !k.includes('code-verifier'))).toEqual([]);
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/login\?next=%2Fsettings/);
  });
});
