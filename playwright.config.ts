// End-to-end tests: the built site, served by `astro preview`, driven in Chromium at a
// desktop and a phone size. The build reads e2e/fixtures/github.json instead of the GitHub
// API (REPOS_FIXTURE, see src/lib/github.ts), so the page content is fixed.
import { defineConfig, devices } from '@playwright/test';

const PORT = 4322; // not astro's default 4321, so a running dev server is never reused
const CI = !!process.env.CI;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    env: { REPOS_FIXTURE: 'e2e/fixtures/github.json' },
    reuseExistingServer: !CI,
    timeout: 180_000,
  },
});
