import { defineConfig } from '@playwright/test';
const webPort = process.env.PLAYBOX_TEST_WEB_PORT ?? '5185';
const apiPort = process.env.PLAYBOX_TEST_API_PORT ?? '5186';
const baseURL = `http://127.0.0.1:${webPort}`;
export default defineConfig({
  testDir: './tests', fullyParallel: false, workers: 1, timeout: 30000,
  expect: { timeout: 5000, toHaveScreenshot: { animations: 'disabled', maxDiffPixelRatio: 0.001 } },
  use: { baseURL, browserName: 'chromium', viewport: { width: 1440, height: 1000 }, locale: 'en-US', timezoneId: 'Europe/Warsaw', reducedMotion: 'reduce', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'npm run dev', url: baseURL, env: { PLAYBOX_WEB_PORT: webPort, PLAYBOX_API_PORT: apiPort }, reuseExistingServer: false, timeout: 30000 },
});
