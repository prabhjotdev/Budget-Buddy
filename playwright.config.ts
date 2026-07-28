import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const PORT = 5173;
const BASE_URL = `http://localhost:${PORT}`;

// In this managed environment Chromium is pre-installed at a fixed path and
// Playwright's own browser download is disabled. Use that binary when it
// exists; otherwise fall back to Playwright's bundled browser (e.g. in CI,
// after `npx playwright install`).
const PREINSTALLED_CHROMIUM = '/opt/pw-browsers/chromium';
const chromiumLaunchOptions = existsSync(PREINSTALLED_CHROMIUM)
  ? { executablePath: PREINSTALLED_CHROMIUM }
  : undefined;

// Dummy Firebase config so the app can boot in the dev server without real
// credentials. The E2E tests only exercise the public login page and the
// unauthenticated auth-guard redirects, so no live Firebase project is needed.
const FIREBASE_TEST_ENV = {
  VITE_FIREBASE_API_KEY: 'test-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'budget-buddy-test.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'budget-buddy-test',
  VITE_FIREBASE_STORAGE_BUCKET: 'budget-buddy-test.appspot.com',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
  VITE_FIREBASE_APP_ID: '1:000000000000:web:testappid',
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(chromiumLaunchOptions ? { launchOptions: chromiumLaunchOptions } : {}),
      },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: FIREBASE_TEST_ENV,
  },
});
