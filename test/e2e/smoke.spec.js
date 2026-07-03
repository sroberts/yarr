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
  // let the initial refreshItems() settle first (on a fresh DB it resolves to
  // [] and would otherwise clobber our seed), then freeze it and seed.
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => {
    vm.refreshItems = () => Promise.resolve()
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

test('d-none actually hides a .selectgroup (feed-list unread filter depends on it)', async ({ page }) => {
  await page.goto('/')
  // Regression guard: .selectgroup { display: block } (app.css) and .d-none
  // (base.css) have equal specificity; if d-none loses the cascade, feed/folder
  // rows that should be hidden in the All-Unread view stay visible (#100).
  const display = await page.evaluate(() => {
    const el = document.createElement('label')
    el.className = 'selectgroup d-none'
    document.body.appendChild(el)
    const d = getComputedStyle(el).display
    el.remove()
    return d
  })
  expect(display).toBe('none')
})

test('command palette: Ctrl/Cmd+K opens, fuzzy-filters, and runs an action', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Control+k')
  await expect(page.locator('.command-palette-input')).toBeFocused()
  await page.locator('.command-palette-input').fill('dark')
  const row = page.locator('.command-palette-row', { hasText: 'Theme: Dark' })
  await expect(row).toBeVisible()
  await row.click()
  await expect(page.locator('body')).toHaveClass(/theme-dark/)
  await expect(page.locator('.command-palette-dialog')).toHaveCount(0)  // closed after run
})

test('command palette: Escape closes it', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Control+k')
  await expect(page.locator('.command-palette-dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.command-palette-dialog')).toHaveCount(0)
})

test('listen (TTS): button speaks the article, toggles pause, stops on close', async ({ page, context }) => {
  // Headless Chromium has no real voices, so inject a deterministic mock of the
  // Web Speech API before load: it records speak/pause/resume/cancel calls and
  // does NOT auto-fire onend, so playback stays "in progress" for assertions.
  await page.addInitScript(() => {
    window.__tts = { spoken: [], paused: 0, resumed: 0, cancelled: 0 }
    var mock = {
      speak: function (u) { window.__tts.spoken.push(u.text) },
      pause: function () { window.__tts.paused++ },
      resume: function () { window.__tts.resumed++ },
      cancel: function () { window.__tts.cancelled++ },
    }
    // speechSynthesis is a read-only getter in Chromium; override it outright.
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, get: function () { return mock } })
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true, writable: true,
      value: function (text) { this.text = text },
    })
  })
  await page.goto('/')
  await page.evaluate(() => window.offlineStore.put({
    id: 800001, feed_id: 1, title: 'Listen Me', status: 'starred', media_links: [],
    content: '<p>The quick brown fox jumps over the lazy dog. A second sentence follows here.</p>',
  }))
  await context.setOffline(true)               // force the offline render path (no server item)
  await page.evaluate(() => { vm.itemSelected = 800001 })
  await expect(page.getByRole('heading', { name: 'Listen Me' })).toBeVisible()

  // click Listen -> speak() called with text that leads with the title
  await page.getByRole('button', { name: 'Listen' }).click()
  const first = await page.evaluate(() => window.__tts.spoken[0])
  expect(first).toContain('Listen Me')
  expect(await page.evaluate(() => vm.ttsPlaying && !vm.ttsPaused)).toBe(true)

  // clicking again pauses
  await page.getByRole('button', { name: 'Pause' }).click()
  expect(await page.evaluate(() => window.__tts.paused)).toBeGreaterThan(0)
  expect(await page.evaluate(() => vm.ttsPaused)).toBe(true)

  // leaving the article stops playback
  await page.evaluate(() => { vm.itemSelected = null })
  expect(await page.evaluate(() => window.__tts.cancelled)).toBeGreaterThan(0)
  expect(await page.evaluate(() => vm.ttsPlaying)).toBe(false)
  await context.setOffline(false)
})

test('smart filters: add a rule in settings, see it listed, delete it', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.locator('input[aria-label="Keyword (case-insensitive)"]').fill('sponsored')
  await page.getByRole('button', { name: 'Add rule' }).click()
  const row = page.locator('.filter-row', { hasText: 'sponsored' })
  await expect(row).toBeVisible()
  await expect(row).toContainText('Auto-read')          // default action
  await expect(row).toContainText('all feeds')
  await row.locator('button[aria-label="Delete filter"]').click()
  await expect(page.locator('.filter-row')).toHaveCount(0)
})
