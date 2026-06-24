import { defineConfig, devices } from '@playwright/test'

// E2E runs against a RUNNING app (build + `npm start`, or `npm run dev`) with a
// real database, Supabase Auth, and — for the upload path — Cloudflare R2 + the
// worker. Point it at your environment with E2E_BASE_URL (default localhost:3000).
// Specs that need credentials/data skip themselves when the relevant env is unset
// (see tests/e2e/support.ts), so the suite never fails for missing infra.
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
