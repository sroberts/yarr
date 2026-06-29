// @ts-check
const { test, expect } = require('@playwright/test')

// Smoke tests for the core shell + theme system. They run against a fresh DB
// (no feeds), so they assert on chrome that's always present — the kind of
// regression that slipped through before (the redesign, the card clip).

test('app shell renders', async ({ page }) => {
  await page.goto('/')
  // the feed-list "All Feeds" entry is always present
  await expect(page.getByText('All Feeds')).toBeVisible()
  // app is mounted (v-cloak removed)
  await expect(page.locator('#app')).toBeVisible()
})

test('theme + accent switch applies to the body', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Settings' }).click()

  await page.getByRole('button', { name: 'dark', exact: true }).click()
  await expect(page.locator('body')).toHaveClass(/theme-dark/)

  await page.getByRole('button', { name: 'violet', exact: true }).click()
  await expect(page.locator('body')).toHaveAttribute('data-accent', 'violet')

  await page.getByRole('button', { name: 'light', exact: true }).click()
  await expect(page.locator('body')).toHaveClass(/theme-light/)
})

test('? opens the keyboard-shortcuts modal', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('?')
  await expect(page.getByText('Keyboard Shortcuts', { exact: true })).toBeVisible()
})
