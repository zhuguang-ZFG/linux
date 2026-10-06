import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/site',
  timeout: 30000,
  expect: { timeout: 12000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173/linux/',
    viewport: { width: 1440, height: 1000 },
    channel: process.platform === 'win32' ? 'chrome' : undefined,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: { command: 'node scripts/serve-site.mjs', url: 'http://127.0.0.1:4173/linux/', reuseExistingServer: !process.env.CI, timeout: 15000 },
});
