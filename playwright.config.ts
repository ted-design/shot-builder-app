import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: 2,  // Increased retries for CI reliability
  reporter: [['list'], ['html', { open: 'never' }]],

  // Global setup to seed test users in Firebase emulator (required for CI)
  // Authentication is handled directly in fixtures for better reliability
  globalSetup: './tests/global.setup.ts',

  use: {
    // Use dev server (5173) for tests, or preview server (4173) for production-like tests
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Increased timeouts for CI environment
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  expect: { timeout: 10000 },  // Increased expect timeout
  timeout: 60000,  // Per-test timeout
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ],
  // Automatically start dev server if not running (optional - can run manually)
  // Uncomment to enable automatic server startup
  // webServer: {
  //   command: 'npm run dev',
  //   port: 5173,
  //   reuseExistingServer: true,
  //   timeout: 120000,
  // },
});
