import { expect, test } from '@playwright/test'
import { E2E, hasCreds, login, tinyJpeg } from './support'

// The full guest→photographer happy path: upload a file, approve it, request an
// export. This is the ONLY spec that exercises real storage, so it's opt-in via
// E2E_FULL=1 and requires Cloudflare R2 + bucket CORS configured for the base URL.
// (The background worker is NOT required: moderation lists uploads regardless of
// processing state, and the export is only *requested* here, not awaited.)
test.describe('full upload → approve → export flow', () => {
  test('guest uploads, photographer approves and requests an export', async ({ page }) => {
    test.skip(!E2E.full || !hasCreds, 'set E2E_FULL=1 and credentials; needs R2 + CORS')
    await login(page)

    // Create + publish an event.
    await page.goto('/events/new')
    await page.getByLabel(/event title/i).fill('E2E Full Flow')
    await page.getByLabel(/event date/i).fill('2026-09-12')
    await page.getByRole('button', { name: /create event/i }).click()
    await page.waitForURL(/\/events\/[0-9a-f-]+$/)
    const eventUrl = page.url()
    await page.goto(`${eventUrl}/settings`)
    await page.getByLabel(/^status$/i).selectOption('active')
    await page.getByRole('button', { name: /save changes/i }).click()
    await expect(page.getByText(/^saved$/i)).toBeVisible()

    // Resolve the public slug.
    await page.goto(eventUrl)
    const code = await page.locator('code', { hasText: '/e/' }).first().innerText()
    const slug = code.split('/e/')[1]?.trim()

    // Guest uploads a file (presign → PUT to R2 → confirm).
    await page.goto(`/e/${slug}`)
    await page.getByLabel(/your name/i).fill('E2E Guest')
    await page.locator('input[type="file"]').setInputFiles(tinyJpeg())
    // The progress item reaches a done state once confirm succeeds.
    await expect(page.getByText(/uploaded/i)).toBeVisible({ timeout: 30_000 })

    // Photographer approves it in the moderation queue.
    await page.goto(`${eventUrl}/uploads`)
    await page.getByRole('button', { name: /approve/i }).first().click()

    // Request an export.
    await page.goto(`${eventUrl}/export`)
    await page.getByRole('button', { name: /request export/i }).click()
    await expect(page.getByText(/building|queued|processing|requested/i)).toBeVisible()
  })
})
