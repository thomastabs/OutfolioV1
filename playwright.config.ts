import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Real-device viewport projects (Story 9563524): scoped to the
    // responsive-layout spec only, so the golden-path/smoke tests don't
    // triple their run count and re-exercise auth flows on every device.
    {
      name: 'iPhone 13',
      use: { ...devices['iPhone 13'] },
      testMatch: /responsive-layout\.spec\.ts/,
    },
    {
      name: 'iPad Pro 11',
      use: { ...devices['iPad Pro 11'] },
      testMatch: /responsive-layout\.spec\.ts/,
    },
  ],
});
