// @ts-check
const { test, expect } = require('@playwright/test')

// Triage takes the list's keys too, so one grammar carries across (#263):
// j / r read the card and move on, k steps back, i reads it here, I saves to
// Instapaper. Cards are stubbed as in triage-keys.spec.js.
async function enterTriage(page, opts) {
  await page.goto('/')
  await page.waitForFunction(() => window.vm)
  await page.evaluate((instapaper) => {
    var list = [1, 2, 3].map(function (n) {
      return { id: 850000 + n, feed_id: 1, title: 'Card ' + n, status: 'unread', link: 'https://example.com/' + n, content: '<p>body ' + n + '</p>', date: new Date().toISOString() }
    })
    api.items.list = function () { return Promise.resolve({ list: list, has_more: false }) }
    api.items.update = function () { return Promise.resolve() }
    api.items.saveToInstapaper = function () { return Promise.resolve() }
    api.settings.update = function () { return Promise.resolve() }
    vm.instapaperTokenEnv = instapaper
    vm.filterSelected = 'triage'
  }, !!(opts && opts.instapaper))
  await expect.poll(() => page.evaluate(() => vm.cardItems.length)).toBe(3)
  await expect.poll(() => page.evaluate(() => document.activeElement && document.activeElement.id)).toBe('triage-card')
}
const state = page => page.evaluate(() => ({ index: vm.cardIndex, read: vm.cardStats.read, instapaper: vm.cardStats.instapaper, expanded: vm.cardExpanded }))

test('triage: j and r mark read and move on; k steps back', async ({ page }) => {
  await enterTriage(page)
  await page.keyboard.press('j')
  await expect.poll(() => state(page)).toMatchObject({ index: 1, read: 1 })
  await page.keyboard.press('r')
  await expect.poll(() => state(page)).toMatchObject({ index: 2, read: 2 })
  await page.keyboard.press('k')
  await expect.poll(() => state(page)).toMatchObject({ index: 1, read: 1 })
  // k with nothing left to undo does nothing
  await page.keyboard.press('k')
  await expect.poll(() => state(page)).toMatchObject({ index: 1 })
})

test('triage: i reads the card here and back', async ({ page }) => {
  await enterTriage(page)
  await page.keyboard.press('i')
  await expect.poll(() => state(page)).toMatchObject({ expanded: true, index: 0 })
  await page.keyboard.press('i')
  await expect.poll(() => state(page)).toMatchObject({ expanded: false, index: 0 })
})

test('triage: I saves to Instapaper only when Instapaper is set up', async ({ page }) => {
  await enterTriage(page)
  await page.keyboard.press('Shift+I')
  // without Instapaper, I is not "keep unread": nothing happens
  await expect.poll(() => state(page)).toMatchObject({ index: 0, instapaper: 0 })

  await enterTriage(page, { instapaper: true })
  await page.keyboard.press('Shift+I')
  await expect.poll(() => state(page)).toMatchObject({ index: 1, instapaper: 1 })
})

test('triage legend: key caps with a keyboard, chevrons on touch', async ({ page, browser }) => {
  await enterTriage(page)
  const legend = page.locator('.card-view-legend')
  await expect(legend.locator('.legend-kbd', { hasText: '←' })).toBeVisible()
  await expect(legend.locator('.legend-kbd', { hasText: '→' })).toBeVisible()
  await expect(legend.locator('.legend-kbd', { hasText: 's' })).toBeVisible()
  await expect(legend.locator('.legend-chevron')).toHaveCount(2)
  await expect(legend.locator('.legend-chevron').first()).toBeHidden()

  const touch = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 800 } })
  const tpage = await touch.newPage()
  await enterTriage(tpage)
  const tlegend = tpage.locator('.card-view-legend')
  await expect(tlegend.locator('.legend-chevron').first()).toBeVisible()
  await expect(tlegend.locator('.legend-kbd').first()).toBeHidden()
  await touch.close()
})
