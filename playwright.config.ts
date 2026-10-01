import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end checks of the production build, on a phone and on a desktop.
 * Locally they use the installed Chrome (no browser download); CI installs
 * Playwright's Chromium.
 */
const channel = process.env.CI ? undefined : 'chrome';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4174/', trace: 'retain-on-failure' },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'], channel } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel, viewport: { width: 1280, height: 860 } } },
  ],
  webServer: {
    command: 'npx vite preview --port 4174 --strictPort',
    url: 'http://localhost:4174/',
    reuseExistingServer: !process.env.CI,
  },
});
