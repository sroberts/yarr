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

test('first-run (#120): single-column landing shows the add-feed CTA, not a blank pane', async ({ page }) => {
  // Regression: feedSelected defaults to '' (!== null), so the mobile/zoomed
  // single-column layout slides to the item pane — which had no empty state,
  // leaving a blank dead-end. The feed-list CTA was hidden off in the other pane.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  // production's first-run default is feedSelected === '' (settings.feed), which
  // applies the feed-selected class and slides a single column to the item pane;
  // reproduce that exact state (the e2e server happens to boot with null).
  await page.evaluate(() => { vm.feedSelected = '' })
  // the item pane is the single-column landing and must carry its own CTA
  const cta = page.locator('#col-item-list').getByRole('button', { name: 'Add your first feed' })
  await expect(cta).toBeVisible()
  const box = await cta.boundingBox()
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(391)
  // no perpetual loading spinner when there are no feeds
  await expect(page.locator('#col-item-list .loading')).toHaveCount(0)
})

test('add feed: submitting the New Feed form reaches the API (no bare-event crash)', async ({ page }) => {
  // Regression: the form used @submit.prevent="createFeed(event)" — bare `event`
  // is the removed Vue 2 magic global, so in the Vue 3 prod build it resolved to
  // undefined and `event.target` threw, silently breaking every UI feed-add.
  await page.goto('/')
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  await page.getByRole('button', { name: 'Add your first feed' }).click()
  // stub the network call so we can assert createFeed ran to completion
  await page.evaluate(() => {
    window.__created = null
    api.feeds.create = function (data) { window.__created = data; return Promise.resolve({ status: 'success', feed: { id: 1 } }) }
  })
  await page.locator('#feed-url').fill('https://example.com/feed.xml')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  // the handler read the form (event.target) and called the API with the URL
  await expect.poll(() => page.evaluate(() => window.__created && window.__created.url)).toBe('https://example.com/feed.xml')
  expect(errors).toEqual([])
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

test('reader toolbar: all icon controls are the same width (even spacing)', async ({ page }) => {
  // Regression: the Appearance dropdown toggle had its padding zeroed by
  // .settings-dropdown .dropdown-toggle, making it narrower than sibling
  // toolbar-items so the row looked unevenly spaced. Every icon control in
  // the reader toolbar should be the same width.
  await page.goto('/')
  await page.evaluate(() => {
    var item = { id: 810001, feed_id: 1, title: 'Even Toolbar', status: 'read', media_links: [], content: '<p>body</p>' }
    api.items.get = function () { return Promise.resolve(item) }
    vm.itemSelected = 810001
  })
  await expect(page.getByRole('heading', { name: 'Even Toolbar' })).toBeVisible()
  const widths = await page.evaluate(() => {
    const tb = Array.from(document.querySelectorAll('#col-item .toolbar')).slice(-1)[0]
    return Array.from(tb.children)
      .map(c => Math.round(c.getBoundingClientRect().width))
      .filter(w => w > 0 && w < 100)   // icon controls only, not the flex spacer
  })
  expect(widths.length).toBeGreaterThan(6)
  expect(new Set(widths).size).toBe(1)  // all identical => evenly spaced
})

test('reader toolbar: fits the viewport at phone widths (no unreachable controls)', async ({ page }) => {
  // Regression (#123): the reader toolbar rendered Prev/Next/Close past the
  // right edge at 390px (and clipped Open Link at 320px) — unreachable, no
  // wrap or scroll. Every visible control must sit within the viewport.
  const seed = () => page.evaluate(() => {
    var item = { id: 810123, feed_id: 1, title: 'Fits The Phone', status: 'read', media_links: [], content: '<p>body</p>' }
    api.items.get = function () { return Promise.resolve(item) }
    vm.itemSelected = 810123
  })
  const overflow = () => page.evaluate(() => {
    const tb = Array.from(document.querySelectorAll('#col-item .toolbar')).slice(-1)[0]
    const w = window.innerWidth
    // controls whose right edge spills past the viewport (or left edge < 0)
    return Array.from(tb.querySelectorAll('.toolbar-item'))
      .filter(el => getComputedStyle(el).display !== 'none')
      .map(el => { const r = el.getBoundingClientRect(); return { title: el.title, left: Math.round(r.left), right: Math.round(r.right) } })
      .filter(r => r.right > w + 0.5 || r.left < -0.5)
  })
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/')
    await seed()
    await expect(page.getByRole('heading', { name: 'Fits The Phone' })).toBeVisible()
    expect(await overflow(), `toolbar overflow at ${width}px`).toEqual([])
  }
})

test('session expiry (#125): a 401 from the API reloads the page (lands on login)', async ({ page }) => {
  // Regression: when the auth cookie lapsed the SPA had no 401 handling — every
  // call failed with JSON-parse errors while the UI looked normal (frozen).
  // xfetch now reloads on 401; in production the reload lands on the login page.
  await page.goto('/')
  // 401 exactly one API call (then let traffic through) so the reload can't loop
  let armed = true
  await page.route('**/api/**', route => {
    if (armed) { armed = false; route.fulfill({ status: 401, body: '' }) }
    else route.continue()
  })
  // a marker the reload will wipe, proving the page actually reloaded
  await page.evaluate(() => { window.__preReload = 1; api.feeds.list() })
  await page.waitForFunction(() => window.__preReload === undefined, { timeout: 5000 })
  // and the app comes back up cleanly after the reload (not stuck)
  await expect(page.locator('#app')).toBeVisible()
})

test('PWA shortcuts (#126): ?view= lands on the right view and cleans the URL', async ({ page }) => {
  // The manifest shortcuts open ?view=unread|starred|triage; the app maps them
  // onto filterSelected (triage into card mode) and strips the query so a reload
  // doesn't re-apply it.
  await page.goto('/?view=starred')
  await expect.poll(() => page.evaluate(() => vm.filterSelected)).toBe('starred')
  expect(await page.evaluate(() => location.search)).toBe('')

  await page.goto('/?view=triage')
  await expect.poll(() => page.evaluate(() => vm.filterSelected)).toBe('triage')
  expect(await page.evaluate(() => vm.cardMode)).toBe(true)
  expect(await page.evaluate(() => location.search)).toBe('')
})

test('mobile layout: #app reflects feed/item selection (drives single-column nav)', async ({ page }) => {
  // Regression: the responsive classes lived in a :class on #app, but #app is
  // the Vue mount container and Vue 3 ignores bindings on the mount host — so
  // feed-selected/item-selected never applied and mobile couldn't slide from
  // the feed list to a feed's article list. Now applied via a watcher.
  await page.goto('/')
  const appClass = () => page.evaluate(() => document.getElementById('app').className)
  // selecting a feed slides to the article list on mobile
  await page.evaluate(() => { vm.feedSelected = 'feed:1' })
  await expect.poll(appClass).toContain('feed-selected')
  // opening an article slides to the reader
  await page.evaluate(() => { vm.itemSelected = 123 })
  await expect.poll(appClass).toContain('item-selected')
  // going back clears both
  await page.evaluate(() => { vm.itemSelected = null; vm.feedSelected = null })
  await expect.poll(appClass).not.toContain('selected')
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

test('listen (TTS): button speaks the article, toggles pause, stops on close', async ({ page }) => {
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
  // Open an article online (stub the fetch) rather than via the offline path —
  // going offline raises the "You're offline" banner, which overlays the toolbar.
  await page.evaluate(() => {
    var item = {
      id: 800001, feed_id: 1, title: 'Listen Me', status: 'read', media_links: [],
      content: '<p>The quick brown fox jumps over the lazy dog. A second sentence follows here.</p>',
    }
    api.items.get = function () { return Promise.resolve(item) }
    vm.itemSelected = 800001
  })
  await expect(page.getByRole('heading', { name: 'Listen Me' })).toBeVisible()

  // stable handle: the button's title flips (Listen/Pause/Resume) so we target
  // it by testid rather than its changing accessible name.
  const listen = page.getByTestId('reader-listen')

  // click Listen -> speak() called with text that leads with the title
  await listen.click()
  const first = await page.evaluate(() => window.__tts.spoken[0])
  expect(first).toContain('Listen Me')
  expect(await page.evaluate(() => vm.ttsPlaying && !vm.ttsPaused)).toBe(true)

  // clicking again pauses
  await listen.click()
  expect(await page.evaluate(() => window.__tts.paused)).toBeGreaterThan(0)
  expect(await page.evaluate(() => vm.ttsPaused)).toBe(true)

  // leaving the article stops playback
  await page.evaluate(() => { vm.itemSelected = null })
  expect(await page.evaluate(() => window.__tts.cancelled)).toBeGreaterThan(0)
  expect(await page.evaluate(() => vm.ttsPlaying)).toBe(false)
})

test('contrast: muted text clears WCAG AA in both themes; counters not opacity-dimmed', async ({ page }) => {
  // Regression: dark --text-tertiary was 4.24:1 (below AA) while its comment
  // claimed compliance, and .counter used opacity .6 that failed on selected
  // (accent-bg) rows. Guard the token math and the opacity choice directly.
  await page.goto('/')
  const contrast = await page.evaluate(() => {
    const lum = (c) => {
      const [r, g, b] = c.match(/[\d.]+/g).map(Number).slice(0, 3)
        .map(v => v / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const toRGB = (v) => { const d = document.createElement('div'); d.style.color = v; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c }
    const cr = (a, b) => { const x = lum(toRGB(a)), y = lum(toRGB(b)); const hi = Math.max(x, y), lo = Math.min(x, y); return (hi + 0.05) / (lo + 0.05) }
    const read = (name) => getComputedStyle(document.body).getPropertyValue(name).trim()
    const out = {}
    for (const theme of ['light', 'dark']) {
      document.body.className = 'theme-' + theme
      const t = read('--text-tertiary')
      out[theme] = {
        tertiaryOnBase: cr(t, read('--surface-base')),
        tertiaryOnRaised: cr(t, read('--surface-raised')),
      }
    }
    return out
  })
  expect(contrast.light.tertiaryOnBase).toBeGreaterThanOrEqual(4.5)
  expect(contrast.light.tertiaryOnRaised).toBeGreaterThanOrEqual(4.5)
  expect(contrast.dark.tertiaryOnBase).toBeGreaterThanOrEqual(4.5)
  expect(contrast.dark.tertiaryOnRaised).toBeGreaterThanOrEqual(4.5)
  // counters de-emphasise with a token, not opacity (opacity has no headroom on accent rows)
  const counterOpacity = await page.evaluate(() => {
    const el = document.createElement('span'); el.className = 'counter'; document.body.appendChild(el)
    const o = getComputedStyle(el).opacity; el.remove(); return o
  })
  expect(counterOpacity).toBe('1')
})

test('accent swatches: preview dot matches the applied accent in both themes', async ({ page }) => {
  // Regression (#130): .swatch-* hardcoded only the light accent values, so in
  // dark mode the picker showed the wrong color (e.g. amber dot burnt-orange
  // while selecting it painted bright yellow). The swatch must equal the accent
  // that [data-accent] applies, per theme.
  await page.goto('/')
  const accents = ['blue', 'teal', 'green', 'violet', 'rose', 'amber', 'slate']
  const result = await page.evaluate((accents) => {
    const toRGB = (v) => { const d = document.createElement('div'); d.style.color = v; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c }
    const out = {}
    for (const theme of ['light', 'dark']) {
      out[theme] = {}
      for (const a of accents) {
        // color the swatch dot would show
        document.body.className = 'theme-' + theme
        document.body.removeAttribute('data-accent')
        const sw = document.createElement('span'); sw.className = 'swatch-' + a; document.body.appendChild(sw)
        const swatch = toRGB(getComputedStyle(sw).getPropertyValue('--swatch').trim())
        sw.remove()
        // color selecting that accent actually applies
        document.body.setAttribute('data-accent', a)
        const applied = toRGB(getComputedStyle(document.body).getPropertyValue('--accent').trim())
        out[theme][a] = { swatch, applied }
      }
    }
    return out
  }, accents)
  for (const theme of ['light', 'dark']) {
    for (const a of accents) {
      expect(result[theme][a].swatch, `${theme}/${a} swatch should match applied accent`).toBe(result[theme][a].applied)
    }
  }
})

test('triage card: the date updates when cycling cards (not frozen to the first)', async ({ page }) => {
  // Regression: <relative-time> computed its date once in data() and the triage
  // card reuses one instance, so every card after the first showed card 1's date.
  await page.goto('/')
  // enter triage without the network load clobbering our seeded deck
  await page.evaluate(() => {
    vm.loadCardItems = () => {}
    vm.filterSelected = 'triage'
  })
  await page.evaluate(() => {
    vm.cardItems = [
      { id: 111, feed_id: 1, title: 'First card', date: '2019-03-10T00:00:00Z', content: '<p>a</p>' },
      { id: 222, feed_id: 1, title: 'Second card', date: '2022-11-20T00:00:00Z', content: '<p>b</p>' },
    ]
    vm.cardIndex = 0
    vm.cardLoading = false
  })
  const dateText = () => page.locator('.triage-card-date').innerText()
  await expect(page.locator('.triage-card-title')).toHaveText('First card')
  const firstDate = await dateText()
  expect(firstDate).toMatch(/2019/)
  // advance to the next card
  await page.evaluate(() => { vm.cardIndex = 1 })
  await expect(page.locator('.triage-card-title')).toHaveText('Second card')
  const secondDate = await dateText()
  expect(secondDate).toMatch(/2022/)
  expect(secondDate).not.toBe(firstDate)   // the frozen-date bug
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
