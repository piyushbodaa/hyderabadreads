// Browser checks: the production build in Chrome, at phone and laptop sizes,
// against a fresh database with the starting shelves.
//
//   npm run build && npm run test:browser
import { defineConfig, devices } from '@playwright/test'

const PORT = 4173

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    // The Chrome already installed (and on GitHub's runners), not a download.
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'], channel: 'chrome' } },
    // The offline check runs its own server, so it runs once, on the phone.
    { name: 'laptop', use: { viewport: { width: 1440, height: 900 } }, testIgnore: /offline/ },
  ],
  webServer: {
    command: `node scripts/serve-build.mjs ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
})
