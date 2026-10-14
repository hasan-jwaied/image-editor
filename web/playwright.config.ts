import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  workers: process.env.CI ? 1 : 2,
  // E2E_BASE_URL runs the same suite against another deployment, e.g. the
  // portfolio's copy: E2E_BASE_URL=http://localhost:3000/lab/ npx playwright test
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4173/', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: 'npm run preview -- --port 4173 --strictPort', port: 4173, reuseExistingServer: true },
})
