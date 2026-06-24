import { expect, test } from '@playwright/test'
import { hasCreds, login } from './support'

// Create an event, publish it, and confirm the public upload page renders. No R2
// needed — this stops before any actual file transfer.
test.describe('event lifecycle', () => {
  test('create, publish, and open the public page', async ({ page }) => {
    test.skip(!hasCreds, 'set E2E_EMAIL / E2E_PASSWORD')
    await login(page)

    await page.goto('/events/new')
    await page.getByLabel(/event title/i).fill('E2E Test Event')
    await page.getByLabel(/event date/i).fill('2026-09-12')
    await page.getByRole('button', { name: /create event/i }).click()

    await page.waitForURL(/\/events\/[0-9a-f-]+$/)
    await expect(page.getByRole('heading', { name: 'E2E Test Event' })).toBeVisible()
    const eventUrl = page.url()

    // Publish via Settings so guests can upload.
    await page.goto(`${eventUrl}/settings`)
    await page.getByLabel(/^status$/i).selectOption('active')
    await page.getByRole('button', { name: /save changes/i }).click()
    await expect(page.getByText(/^saved$/i)).toBeVisible()

    // The overview shows the public link; open it relative to this base URL
    // (the displayed absolute URL may point at the configured prod domain).
    await page.goto(eventUrl)
    const code = await page.locator('code', { hasText: '/e/' }).first().innerText()
    const slug = code.split('/e/')[1]?.trim()
    expect(slug).toBeTruthy()

    await page.goto(`/e/${slug}`)
    await expect(page.getByRole('heading', { name: 'E2E Test Event' })).toBeVisible()
    await expect(page.getByText(/add your photos & videos/i)).toBeVisible()
  })
})
