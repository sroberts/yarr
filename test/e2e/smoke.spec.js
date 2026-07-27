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

test('search field: typing a query does not fire single-letter shortcuts', async ({ page }) => {
  // Regression: isTextBox() blocklisted type="search", so #searchbar was not
  // treated as text entry — every letter binding fired and preventDefault()
  // ate the character. Typing "crypto code" used to leave "yt de".
  await page.goto('/')
  await page.evaluate(() => {
    var item = { id: 800006, feed_id: 1, title: 'Search Guard', status: 'read', media_links: [], link: 'https://example.com/s', content: '<p>body</p>' }
    api.items.get = function () { return Promise.resolve(item) }
    api.items.update = function () { return Promise.resolve() }
    vm.itemSelected = 800006
  })
  await expect(page.getByRole('heading', { name: 'Search Guard' })).toBeVisible()

  const filterBefore = await page.evaluate(() => vm.filterSelected)
  await page.locator('#searchbar').focus()
  await page.keyboard.type('crypto code')
  await expect(page.locator('#searchbar')).toHaveValue('crypto code')
  // and no shortcut fired as a side effect
  await expect(page.locator('.app-toast')).toHaveCount(0)
  expect(await page.evaluate(() => vm.ttsPlaying)).toBe(false)
  expect(await page.evaluate(() => vm.filterSelected)).toBe(filterBefore)

  // the guard must not disable shortcuts outside a text box
  await page.locator('#searchbar').blur()
  await page.keyboard.press('s')
  expect(await page.evaluate(() => vm.itemSelectedDetails.status)).toBe('starred')
})

test('reader: article is a labelled region reachable and scrollable by keyboard', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    var item = { id: 800007, feed_id: 1, title: 'Long Read', status: 'read', media_links: [], link: 'https://example.com/l',
      content: '<p>' + 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(200) + '</p>' }
    api.items.get = function () { return Promise.resolve(item) }
    vm.itemSelected = 800007
  })
  await expect(page.getByRole('heading', { name: 'Long Read' })).toBeVisible()

  const region = page.getByRole('region', { name: 'Article content' })
  await expect(region).toHaveAttribute('tabindex', '0')
  await region.focus()
  await page.keyboard.press('PageDown')
  await expect.poll(() => page.evaluate(() => document.querySelector('.content').scrollTop)).toBeGreaterThan(0)
})

test('reader toolbar: icon controls carry accessible names and toggle state', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    var item = { id: 800008, feed_id: 1, title: 'Named Controls', status: 'unread', media_links: [], link: 'https://example.com/n', content: '<p>body</p>' }
    api.items.get = function () { return Promise.resolve(item) }
    vm.itemSelected = 800008
  })
  await expect(page.getByRole('heading', { name: 'Named Controls' })).toBeVisible()

  // every visible control in the reader toolbar has a non-title accessible name
  const unnamed = await page.evaluate(() => {
    const tb = Array.from(document.querySelectorAll('#col-item .toolbar')).slice(-1)[0]
    return Array.from(tb.querySelectorAll('button, a'))
      .filter(el => getComputedStyle(el).display !== 'none')
      .filter(el => !el.getAttribute('aria-label') && !el.textContent.trim())
      .map(el => el.title || el.outerHTML.slice(0, 60))
  })
  expect(unnamed).toEqual([])

  const star = page.getByRole('button', { name: 'Star article' })
  await expect(star).toHaveAttribute('aria-pressed', 'false')
  await star.click()
  await expect(star).toHaveAttribute('aria-pressed', 'true')

  // read/unread: the tooltip names the action this click performs
  const read = page.getByRole('button', { name: 'Mark read' })
  await expect(read).toHaveAttribute('aria-pressed', 'true')   // starring marks it read
  await expect(read).toHaveAttribute('title', 'Mark Unread')
})

test('focus ring follows the selected accent in both themes', async ({ page }) => {
  // Regression: --focus-ring: var(--accent) was declared on :root, so it locked
  // in the :root blue fallback and the body[data-accent] overrides never reached
  // it — every accent got a blue ring.
  await page.goto('/')
  const ring = (accent, theme) => page.evaluate(([a, t]) => {
    vm.theme.accent = a; vm.theme.name = t
    return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => {
      const cs = getComputedStyle(document.body)
      r({ accent: cs.getPropertyValue('--accent').trim(), ring: cs.getPropertyValue('--focus-ring').trim() })
    })))
  }, [accent, theme])

  for (const [accent, theme] of [['amber', 'light'], ['amber', 'dark'], ['rose', 'dark'], ['green', 'light']]) {
    const got = await ring(accent, theme)
    expect(got.ring.toLowerCase(), `${theme}/${accent}`).toBe(got.accent.toLowerCase())
  }
})

test('marking read/starred still updates the UI when feed stats are missing', async ({ page }) => {
  // Regression: feedStats[feed_id] was indexed unguarded inside the update
  // callback, so a feed absent from stats (not loaded yet, deleted elsewhere)
  // threw and aborted the status update — the server recorded the change while
  // the UI kept the old state.
  await page.goto('/')
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  await page.evaluate(() => {
    var item = { id: 800009, feed_id: 4242, title: 'No Stats', status: 'read', media_links: [], link: 'https://example.com/x', content: '<p>body</p>' }
    api.items.get = function () { return Promise.resolve(item) }
    api.items.update = function () { return Promise.resolve() }
    vm.feedStats = {}                       // feed 4242 deliberately absent
    vm.itemSelected = 800009
  })
  await expect(page.getByRole('heading', { name: 'No Stats' })).toBeVisible()

  await page.getByRole('button', { name: 'Star article' }).click()
  await expect.poll(() => page.evaluate(() => vm.itemSelectedDetails.status)).toBe('starred')
  expect(errors).toEqual([])
})

test('offline-unavailable: the pane always offers a way back', async ({ page }) => {
  // Regression: the reader toolbar (and its Back chevron) lives inside
  // v-if="itemSelectedDetails", which is null in exactly this state — so on a
  // phone this pane was the only thing visible with zero focusable elements.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.evaluate(() => {
    api.items.get = function () { return Promise.reject(new Error('offline')) }
    window.offlineStore = { get: function () { return Promise.resolve(null) }, put: function () {} }
    vm.itemSelected = 999001
  })
  await expect(page.getByText('Not available offline')).toBeVisible()

  const back = page.getByRole('button', { name: 'Back to articles' })
  await expect(back).toBeVisible()
  await back.focus()
  expect(await page.evaluate(() => document.activeElement.textContent.trim())).toBe('Back to articles')
  await back.click()
  expect(await page.evaluate(() => vm.itemSelected)).toBeNull()
  await expect(page.getByText('Not available offline')).toBeHidden()
})

test('readability: a failed crawl stops the spinner and says so', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    var item = { id: 999003, feed_id: 1, title: 'Crawl Me', status: 'read', media_links: [], link: 'https://example.com/c', content: '<p>body</p>' }
    api.items.get = function () { return Promise.resolve(item) }
    api.crawl = function () { return Promise.reject(new Error('no egress')) }
    vm.itemSelected = 999003
  })
  await expect(page.getByRole('heading', { name: 'Crawl Me' })).toBeVisible()

  await page.getByRole('button', { name: 'Read here' }).click()
  await expect(page.locator('.app-toast')).toHaveText('Could not extract this page')
  expect(await page.evaluate(() => vm.loading.readability)).toBe(false)
  await expect(page.locator('#col-item .icon-loading')).toHaveCount(0)

  // a crawl that resolves without content is also a failure, not a blank pane
  await page.evaluate(() => { api.crawl = function () { return Promise.resolve({}) } })
  await page.getByRole('button', { name: 'Read here' }).click()
  await expect(page.locator('.app-toast')).toHaveText('Could not extract this page')
  expect(await page.evaluate(() => vm.loading.readability)).toBe(false)
})

test('code blocks: scrollable ones are keyboard-reachable and visible', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.evaluate(() => {
    var item = { id: 999004, feed_id: 1, title: 'Code', status: 'read', media_links: [], link: '',
      content: '<pre>func main() { fmt.Println("' + 'x'.repeat(300) + '") }</pre><pre>short()</pre>' }
    api.items.get = function () { return Promise.resolve(item) }
    vm.itemSelected = 999004
  })
  await expect(page.getByRole('heading', { name: 'Code' })).toBeVisible()

  const state = await page.evaluate(() => {
    const pres = Array.from(document.querySelectorAll('.content pre'))
    return pres.map(p => ({
      overflows: p.scrollWidth > p.clientWidth,
      tabindex: p.getAttribute('tabindex'),
      role: p.getAttribute('role'),
      bg: getComputedStyle(p).backgroundColor,
    }))
  })
  // the wide block is focusable; the short one is left alone (not a tab trap)
  expect(state[0].overflows).toBe(true)
  expect(state[0].tabindex).toBe('0')
  expect(state[0].role).toBe('region')
  expect(state[1].tabindex).toBeNull()
  // and it reads as a block, not an empty outline
  expect(state[0].bg).not.toBe('rgba(0, 0, 0, 0)')

  // keyboard scrolls it
  await page.locator('.content pre').first().focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => page.evaluate(() => document.querySelector('.content pre').scrollLeft)).toBeGreaterThan(0)

  // the "more to the right" fade clears once you've reached the end
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.content pre')).maskImage)).not.toBe('none')
  await page.evaluate(() => { const p = document.querySelector('.content pre'); p.scrollLeft = p.scrollWidth })
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector('.content pre')).maskImage)).toBe('none')
})

test('reading measure holds ~70 characters in every reading font', async ({ page }) => {
  await page.setViewportSize({ width: 1680, height: 900 })
  await page.goto('/')
  const cpl = async (font) => {
    await page.evaluate((f) => {
      var item = { id: 999005, feed_id: 1, title: 'M', status: 'read', media_links: [], link: '',
        content: '<p>' + 'The quick brown fox jumps over the lazy dog while reading feeds in a quiet room. '.repeat(25) + '</p>' }
      api.items.get = function () { return Promise.resolve(item) }
      vm.itemSelected = 999005; vm.theme.font = f; vm.theme.size = 1.2
    }, font)
    await page.waitForTimeout(300)
    return page.evaluate(() => {
      const p = document.querySelector('.content-wrapper p')
      const range = document.createRange(), node = p.firstChild
      let lines = [], last = null, count = 0
      for (let i = 0; i < node.length; i++) {
        range.setStart(node, i); range.setEnd(node, i + 1)
        const top = Math.round(range.getBoundingClientRect().top)
        if (last === null) last = top
        if (top !== last) { lines.push(count); count = 0; last = top }
        count++
      }
      const full = lines.slice(0, -1)
      return Math.round(full.reduce((a, b) => a + b, 0) / full.length)
    })
  }
  for (const font of ['', 'serif', 'monospace']) {
    const avg = await cpl(font)
    expect(avg, `avg CPL in ${font || 'sans'}`).toBeGreaterThanOrEqual(62)
    expect(avg, `avg CPL in ${font || 'sans'}`).toBeLessThanOrEqual(76)
  }
})

test('copy link: button and c shortcut put the article URL on the clipboard', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/')
  await page.evaluate(() => {
    var item = {
      id: 800002, feed_id: 1, title: 'Copy Me', status: 'read', media_links: [],
      link: 'https://example.com/copy-me', content: '<p>body</p>',
    }
    api.items.get = function () { return Promise.resolve(item) }
    vm.itemSelected = 800002
  })
  await expect(page.getByRole('heading', { name: 'Copy Me' })).toBeVisible()

  const copy = page.getByTestId('reader-copy-link')
  await copy.click()
  await expect(page.locator('.app-toast')).toHaveText('Link copied')
  expect(await page.evaluate(() => navigator.clipboard.readText()))
    .toBe('https://example.com/copy-me')
  // the button confirms in place, then reverts on its own
  await expect(copy).toHaveAttribute('title', 'Link Copied')
  await expect(copy).toHaveAttribute('title', 'Copy Link', { timeout: 4000 })

  // keyboard path (the toast has to clear first so we see the new one land)
  await expect(page.locator('.app-toast')).toHaveCount(0, { timeout: 4000 })
  await page.evaluate(() => navigator.clipboard.writeText('stale'))
  await page.keyboard.press('c')
  await expect(page.locator('.app-toast')).toHaveText('Link copied')
  expect(await page.evaluate(() => navigator.clipboard.readText()))
    .toBe('https://example.com/copy-me')
})

test('copy link: falls back to execCommand when the clipboard API is missing', async ({ page }) => {
  // A self-hosted yarr on a plain-http LAN address has no secure context, so
  // navigator.clipboard is undefined there — the legacy path is the real one.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, get: () => undefined })
    window.__copied = []
    document.execCommand = function (cmd) {
      if (cmd === 'copy') window.__copied.push(document.activeElement.value)
      return true
    }
  })
  await page.goto('/')
  await page.evaluate(() => {
    var item = {
      id: 800003, feed_id: 1, title: 'Fallback Me', status: 'read', media_links: [],
      link: 'https://example.com/fallback', content: '<p>body</p>',
    }
    api.items.get = function () { return Promise.resolve(item) }
    vm.itemSelected = 800003
  })
  await expect(page.getByRole('heading', { name: 'Fallback Me' })).toBeVisible()
  await page.getByTestId('reader-copy-link').click()
  await expect(page.locator('.app-toast')).toHaveText('Link copied')
  expect(await page.evaluate(() => window.__copied)).toEqual(['https://example.com/fallback'])
})

test('copy link: reports failure instead of claiming success', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, get: () => undefined })
    document.execCommand = function () { return false }
  })
  await page.goto('/')
  await page.evaluate(() => {
    var item = {
      id: 800004, feed_id: 1, title: 'No Clipboard', status: 'read', media_links: [],
      link: 'https://example.com/nope', content: '<p>body</p>',
    }
    api.items.get = function () { return Promise.resolve(item) }
    vm.itemSelected = 800004
  })
  await expect(page.getByRole('heading', { name: 'No Clipboard' })).toBeVisible()
  await page.getByTestId('reader-copy-link').click()
  await expect(page.locator('.app-toast')).toHaveText("Couldn't copy link")
  await expect(page.getByTestId('reader-copy-link')).toHaveAttribute('title', 'Copy Link')
})
