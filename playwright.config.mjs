import { defineConfig } from '@playwright/test';

const rawPort = process.env.COURSE_PORT;
const port = rawPort === undefined || rawPort === '' ? 4173 : /^\d+$/.test(rawPort) ? Number(rawPort) : undefined;
if (port === undefined || port < 1 || port > 65535) {
  throw new Error(`Invalid COURSE_PORT "${rawPort}": expected an integer between 1 and 65535.`);
}
const siteUrl = `http://127.0.0.1:${port}/linux/`;

export default defineConfig({
  testDir: './tests/site',
  timeout: 30000,
  expect: { timeout: 12000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: siteUrl,
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: { command: 'node scripts/serve-site.mjs', url: siteUrl, reuseExistingServer: !process.env.CI, timeout: 15000 },
});
