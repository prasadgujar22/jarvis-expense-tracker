import { defineConfig } from '@playwright/test';

const externalURL = process.env.BASE_URL;
const baseURL = externalURL || 'http://localhost:4173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: 4,
  timeout: 60_000,
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
  },
  webServer: externalURL ? undefined : {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: baseURL,
    reuseExistingServer: false,
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
