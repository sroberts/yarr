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
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()

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

test('Esc closes the shortcuts modal', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('?')
  await expect(page.getByText('Keyboard Shortcuts', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByText('Keyboard Shortcuts', { exact: true })).toBeHidden()
})

test('theme has an Auto option that follows the OS', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'dark', exact: true }).click()
  await expect(page.locator('body')).toHaveClass(/theme-dark/)
  // Auto resolves to the emulated OS scheme (Playwright defaults to light)
  await page.getByRole('button', { name: 'auto', exact: true }).click()
  await expect(page.locator('body')).toHaveClass(/theme-light/)
})

test('search has placeholder, clear button, and result count', async ({ page }) => {
  await page.goto('/')
  const search = page.locator('#searchbar')
  await expect(search).toHaveAttribute('placeholder', 'Search articles')
  await search.fill('golang')
  await expect(page.getByRole('button', { name: 'Clear search' })).toBeVisible()
  await expect(page.getByText(/result.* for "golang"/)).toBeVisible()
  await page.getByRole('button', { name: 'Clear search' }).click()
  await expect(search).toHaveValue('')
})

test('empty states: first-run feed CTA + empty reader hint', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Add your first feed' })).toBeVisible()
  await expect(page.getByText('Select an article to read')).toBeVisible()
})

test('accent selection shows a check (not color-only) and modal takes focus', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  // the modal received focus
  const focusedInModal = await page.evaluate(() => !!document.activeElement.closest('.modal-content'))
  expect(focusedInModal).toBe(true)
  // selected accent shows a check mark
  await page.getByRole('button', { name: 'violet', exact: true }).click()
  const violetHasCheck = await page.evaluate(() =>
    !!document.querySelector('.accent-swatch.swatch-violet .accent-check'))
  expect(violetHasCheck).toBe(true)
})
