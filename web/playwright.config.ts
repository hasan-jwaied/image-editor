import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  workers: process.env.CI ? 1 : 2,
  // Annotations show failures on GitHub without opening the job log.
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  // E2E_BASE_URL=http://localhost:3000/lab/ tests the portfolio's copy instead.
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4173/', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    // These set their own viewports.
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testIgnore: ['**/features.spec.ts', '**/devices.spec.ts'] },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: 'npm run preview -- --port 4173 --strictPort', port: 4173, reuseExistingServer: true },
})
