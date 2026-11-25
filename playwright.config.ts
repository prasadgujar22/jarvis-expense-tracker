import { defineConfig } from '@playwright/test';

// Cloud tests share two real Supabase users, so they run serially. Use your own preview port (4173 may be taken).
const externalURL = process.env.BASE_URL;
const port = Number(process.env.PORT || 4317);
const baseURL = externalURL || 'http://localhost:' + port;
process.env.BASE_URL = baseURL;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  globalSetup: './e2e/global-setup.ts',
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-artifacts/playwright-results.json' }],
  ],
  use: {
    baseURL,
    browserName: 'chromium',
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    trace: 'retain-on-failure',
    // Keep page.route() mocks and offline emulation deterministic (no service-worker interception).
    serviceWorkers: 'block',
  },
  webServer: externalURL && !process.env.START_SERVER ? undefined : {
    command: 'npm run preview -- --port ' + port + ' --strictPort',
    url: baseURL,
    reuseExistingServer: false,
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    // Mobile covers layout, empty states and accessibility; the cloud data flows run once (desktop).
    { name: 'mobile', testMatch: /(pages|auth)\.spec\.ts/, use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
