// @ts-check
const { defineConfig, devices } = require('@playwright/test')

// YARR_E2E_URL lets CI point at an already-running server; otherwise Playwright
// starts the locally-built binary itself.
const baseURL = process.env.YARR_E2E_URL || 'http://127.0.0.1:7099'

module.exports = defineConfig({
  testDir: '.',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: { baseURL, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Only manage the server when we weren't handed one.
  webServer: process.env.YARR_E2E_URL
    ? undefined
    : {
        command: '../../out/yarr --db /tmp/yarr-e2e.db --addr 127.0.0.1:7099',
        url: 'http://127.0.0.1:7099/up',
        reuseExistingServer: false,
        timeout: 30_000,
      },
})
