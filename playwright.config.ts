import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  ...(isCI ? { workers: 1 } : {}),
  reporter: 'html',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: '**/*.api.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      testIgnore: '**/*.api.spec.ts',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'api',
      testMatch: '**/*.api.spec.ts',
    },
  ],
  webServer: {
    command: 'npm start',
    port: 3000,
    reuseExistingServer: !isCI,
    timeout: 30_000,
  },
});
