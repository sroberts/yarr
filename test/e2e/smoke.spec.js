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

test('offline reading: cache hit shows content, miss shows message', async ({ page, context }) => {
  await page.goto('/')
  // seed the offline store with a deliberately-kept article
  await page.evaluate(() => window.offlineStore.put({
    id: 999001, title: 'Cached Article', feed_id: 1,
    date: new Date().toISOString(), content: '<p>Offline body text.</p>', status: 'starred'
  }))
  await context.setOffline(true)
  // opening the cached item resolves from IndexedDB
  await page.evaluate(() => { vm.itemSelected = 999001 })
  await expect(page.getByRole('heading', { name: 'Cached Article' })).toBeVisible()
  await expect(page.getByText('offline copy')).toBeVisible()
  await expect(page.getByText('Offline body text.')).toBeVisible()
  // an uncached item shows the calm offline message
  await page.evaluate(() => { vm.itemSelected = 424242 })
  await expect(page.getByText('Not available offline')).toBeVisible()
  await context.setOffline(false)
})

test('a11y: inputs have accessible names and panes expose landmarks', async ({ page }) => {
  await page.goto('/')
  // placeholder-only inputs previously had no programmatic name (WCAG 4.1.2)
  await expect(page.getByRole('searchbox', { name: 'Search articles' })).toBeVisible()
  // the three panes are navigable as landmarks
  await expect(page.getByRole('navigation', { name: 'Feeds' })).toBeVisible()
  await expect(page.getByRole('main', { name: 'Article' })).toBeVisible()
  // modal titles are headings, not styled paragraphs
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
})

test('reading time: shows N min from content, hidden for link-only posts', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    vm.items = [
      { id: 500002, feed_id: 1, title: 'Longread', status: 'read', content: '<p>' + 'word '.repeat(1000) + '</p>' },
      { id: 500003, feed_id: 1, title: 'Linkonly', status: 'read', content: '' },
    ]
  })
  // 1000 words / 200 wpm => 5 min
  await expect(page.locator('label.selectgroup', { hasText: 'Longread' })).toContainText('5 min')
  // no prose => no reading-time label at all (absence beats "0 min")
  await expect(page.locator('label.selectgroup', { hasText: 'Linkonly' })).not.toContainText('min')
})

test('resume position: reopening an article restores scroll offset', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(() => window.offlineStore.put({
    id: 700001, feed_id: 1, title: 'Resume Me', status: 'starred', media_links: [],
    content: '<div>' + '<p>a paragraph tall enough to scroll past</p>'.repeat(300) + '</div>',
  }))
  await context.setOffline(true)               // force the offline render path (no server item)
  await page.evaluate(() => { vm.itemSelected = 700001 })
  await expect(page.getByRole('heading', { name: 'Resume Me' })).toBeVisible()
  // scroll down and let the debounced save fire
  await page.evaluate(() => {
    vm.$refs.content.scrollTop = 1500
    vm.$refs.content.dispatchEvent(new Event('scroll'))
  })
  await page.waitForTimeout(400)
  // leave and come back
  await page.evaluate(() => { vm.itemSelected = null })
  await page.evaluate(() => { vm.itemSelected = 700001 })
  await expect(page.getByRole('heading', { name: 'Resume Me' })).toBeVisible()
  await page.waitForTimeout(200)
  const y = await page.evaluate(() => vm.$refs.content.scrollTop)
  expect(y).toBeGreaterThan(1000)
  await context.setOffline(false)
})
