// @ts-check
const { test, expect } = require('@playwright/test')

// The folder disclosure is a real <button> beside the folder radio's label,
// not a span[role=button] nested inside it (#261). Same stubbing as
// sidebar-keys.spec.js: the e2e DB has no feeds.
async function stubFolder(page) {
  await page.waitForFunction(() => window.vm)
  await page.evaluate(() => {
    var folders = [{ id: 9001, title: 'Tech', is_expanded: true }]
    var feeds = [{ id: 9101, title: 'Feed A', folder_id: 9001, link: '', feed_link: '', has_icon: false }]
    api.folders.list = function () { return Promise.resolve(folders) }
    api.feeds.list = function () { return Promise.resolve(feeds) }
    api.folders.update = function () { return Promise.resolve() }
    api.settings.update = function () { return Promise.resolve() }
    vm.filterSelected = ''
    return vm.refreshFeeds()
  })
  const toggle = page.getByRole('button', { name: 'Collapse Tech' })
  await expect(toggle).toBeVisible()
  return toggle
}
const expanded = page => page.evaluate(() => vm.folders.find(f => f.id === 9001).is_expanded)

test('folder toggle: a real button outside the radio label', async ({ page }) => {
  await page.goto('/')
  const toggle = await stubFolder(page)
  expect(await toggle.evaluate(el => el.tagName)).toBe('BUTTON')
  expect(await toggle.evaluate(el => !!el.closest('label'))).toBe(false)
  await expect(page.locator('#feed-list-scroll label [role="button"]')).toHaveCount(0)
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
})

test('folder toggle: click collapses and expands without selecting the folder', async ({ page }) => {
  await page.goto('/')
  const toggle = await stubFolder(page)
  const before = await page.evaluate(() => vm.feedSelected)
  await toggle.click()
  await expect.poll(() => expanded(page)).toBe(false)
  await expect(page.getByRole('button', { name: 'Expand Tech' })).toHaveAttribute('aria-expanded', 'false')
  expect(await page.evaluate(() => vm.feedSelected)).toBe(before)
  await page.getByRole('button', { name: 'Expand Tech' }).click()
  await expect.poll(() => expanded(page)).toBe(true)
})

test('folder toggle: Enter and Space on the focused button toggle once each', async ({ page }) => {
  await page.goto('/')
  const toggle = await stubFolder(page)
  await toggle.focus()
  await page.keyboard.press('Enter')
  await expect.poll(() => expanded(page)).toBe(false)
  await page.keyboard.press(' ')
  await expect.poll(() => expanded(page)).toBe(true)
})

test('folder toggle: at least 24px to point at, 44px on touch', async ({ page, browser }) => {
  await page.goto('/')
  const toggle = await stubFolder(page)
  const fine = await toggle.boundingBox()
  expect(fine && fine.width).toBeGreaterThanOrEqual(24)
  expect(fine && fine.height).toBeGreaterThanOrEqual(24)

  const touch = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 1024, height: 800 } })
  const tpage = await touch.newPage()
  await tpage.goto(page.url())
  const ttoggle = await stubFolder(tpage)
  const coarse = await ttoggle.boundingBox()
  expect(coarse && coarse.width).toBeGreaterThanOrEqual(44)
  expect(coarse && coarse.height).toBeGreaterThanOrEqual(44)
  await touch.close()
})
