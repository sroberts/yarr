// @ts-check
const { test, expect } = require('@playwright/test')

// The open article's place in the stack: a narrow phone shows the compact
// "2/3" rather than nothing, and a screen reader hears "Article 2 of 3"
// wherever the position shows (it used to be aria-hidden everywhere).
async function openSecond(page, width) {
  await page.setViewportSize({ width, height: 844 })
  await page.goto('/')
  await page.waitForFunction(() => window.vm)
  await page.evaluate(() => {
    var list = [1, 2, 3].map(function (n) {
      return { id: 880000 + n, feed_id: 1, title: 'Pos ' + n, status: 'read', link: 'https://example.com/' + n, content: '<p>body</p>', media_links: [], date: new Date().toISOString() }
    })
    api.items.list = function () { return Promise.resolve({ list: list, has_more: false }) }
    api.items.get = function (id) { return Promise.resolve(list.find(function (i) { return i.id == id })) }
    api.items.update = function () { return Promise.resolve() }
    api.settings.update = function () { return Promise.resolve() }
    vm.feedSelected = ''
    return vm.$nextTick().then(function () { return vm.refreshItems(false) })
  })
  await expect.poll(() => page.evaluate(() => vm.items.length)).toBe(3)
  await page.evaluate(() => { vm.itemSelected = 880002 })
  await expect(page.getByRole('heading', { name: 'Pos 2' })).toBeVisible()
}

test('phone at 390px: compact position on screen, full position for screen readers', async ({ page }) => {
  await openSecond(page, 390)
  const nav = page.getByRole('navigation', { name: 'Article navigation' })
  await expect(nav.locator('.slip-compact')).toHaveText('2/3')
  await expect(nav.locator('.slip-compact')).toBeVisible()
  await expect(nav).toContainText('Article 2 of 3')
  expect(await nav.evaluate(n => n.scrollWidth <= n.clientWidth)).toBe(true)
})

test('desk: the toolbar position is exposed, not aria-hidden', async ({ page }) => {
  await openSecond(page, 1280)
  const label = page.locator('#col-item .toolbar .reader-slip-label')
  await expect(label).toHaveText('Article 2 of 3')
  expect(await label.evaluate(el => el.closest('[aria-hidden="true"]'))).toBeNull()
})
