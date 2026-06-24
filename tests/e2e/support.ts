import { type Page, expect } from '@playwright/test'

// E2E config via env (kept out of the repo). Specs skip when their prerequisites
// are missing so the suite is safe to run anywhere.
export const E2E = {
  email: process.env.E2E_EMAIL,
  password: process.env.E2E_PASSWORD,
  // An ACTIVE event's public slug, for the public-page / upload specs.
  eventSlug: process.env.E2E_EVENT_SLUG,
  // Opt-in for the full upload path (needs R2 + CORS + the worker running).
  full: process.env.E2E_FULL === '1',
}

export const hasCreds = Boolean(E2E.email && E2E.password)

// Logs in via the real /login form and lands on the dashboard.
export async function login(page: Page): Promise<void> {
  if (!E2E.email || !E2E.password) throw new Error('E2E_EMAIL / E2E_PASSWORD not set')
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(E2E.email)
  await page.getByLabel(/password/i).fill(E2E.password)
  await page.getByRole('button', { name: /(log in|sign in)/i }).click()
  await page.waitForURL('**/dashboard')
  await expect(page).toHaveURL(/\/dashboard/)
}

// A tiny but valid 1x1 JPEG, so upload specs don't need a binary fixture file.
export function tinyJpeg(): { name: string; mimeType: string; buffer: Buffer } {
  const base64 =
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////' +
    '////////////////////////////////////////////////2wBDAf//////////////////////' +
    '////////////////////////////////////////////////////////////////////////////' +
    'wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAAv/EABQQAQAAAAAAAAAAAAAAAAAA' +
    'AAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8A' +
    'pgB//9k='
  return { name: 'sample.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(base64, 'base64') }
}
