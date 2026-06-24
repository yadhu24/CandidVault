import { expect, test } from '@playwright/test'
import { E2E, hasCreds } from './support'

test.describe('auth', () => {
  test('signup shows an email-confirmation message', async ({ page }) => {
    test.skip(!E2E.email, 'set E2E_EMAIL to exercise signup against a test Supabase project')
    await page.goto('/signup')
    await page.getByLabel(/email/i).fill(`e2e+${Date.now()}@example.com`)
    await page.getByLabel(/password/i).fill('supersecret123')
    await page.getByRole('button', { name: /create account/i }).click()
    // Supabase signup requires email confirmation — the flow ends with a prompt.
    await expect(page.getByText(/check your email/i)).toBeVisible()
  })

  test('login lands on the dashboard', async ({ page }) => {
    test.skip(!hasCreds, 'set E2E_EMAIL / E2E_PASSWORD for an existing confirmed account')
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(E2E.email!)
    await page.getByLabel(/password/i).fill(E2E.password!)
    await page.getByRole('button', { name: /log in/i }).click()
    await expect(page).toHaveURL(/\/dashboard/)
  })
})
