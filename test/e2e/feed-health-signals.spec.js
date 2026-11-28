// @ts-check
const { test, expect } = require('@playwright/test')

// Feed health weighs what you open against what arrives. j/k open every
// article they pass, so an article counts as opened only when it stays up
// (8s in a visible tab) or the reader acts on it: o, i, or reading a triage
// card in place. Each is reported once.
async function setup(page) {
  await page.clock.install()
  await page.goto('/')
  await page.waitForFunction(() => window.vm)
  await page.evaluate(() => {
    var list = [1, 2, 3].map(function (n) {
      return { id: 880000 + n, feed_id: 1, title: 'Signal ' + n, status: 'unread', link: 'https://example.com/' + n, content: '<p>body ' + n + '</p>', date: new Date().toISOString() }
    })
    window.__opened = []
    window.open = function () { return null }
    api.items.list = function () { return Promise.resolve({ list: list, has_more: false }) }
    api.items.get = function (id) { return Promise.resolve(Object.assign({}, list.find(function (i) { return i.id == id }), { status: 'read' })) }
    api.items.update = function (id, data) {
      if (data && data.opened) window.__opened.push(id)
      return Promise.resolve({ ok: true })
    }
    api.settings.update = function () { return Promise.resolve() }
    vm.feedSelected = ''
    return vm.$nextTick().then(function () { return vm.refreshItems(false) })
  })
  await expect.poll(() => page.evaluate(() => vm.items.length)).toBe(3)
}

const opened = (page) => page.evaluate(() => window.__opened.slice())

test('reader: passing through with j does not count; staying 8s does, once', async ({ page }) => {
  await setup(page)
  await page.evaluate(() => { vm.itemSelected = 880001 })
  await page.clock.runFor(3000)
  await page.evaluate(() => { vm.itemSelected = 880002 })
  await page.clock.runFor(7000)
  expect(await opened(page)).toEqual([])

  await page.clock.runFor(1500)
  expect(await opened(page)).toEqual([880002])

  // back and forth again: already reported
  await page.evaluate(() => { vm.itemSelected = 880003 })
  await page.evaluate(() => { vm.itemSelected = 880002 })
  await page.clock.runFor(9000)
  expect(await opened(page)).toEqual([880002])
})

test('reader: o and reader view count at once', async ({ page }) => {
  await setup(page)
  await page.evaluate(() => { vm.itemSelected = 880001 })
  await expect(page.locator('.content-title')).toHaveText('Signal 1')
  await page.keyboard.press('o')
  expect(await opened(page)).toEqual([880001])

  await page.evaluate(() => { api.crawl = function () { return Promise.resolve({ content: '' }) }; vm.itemSelected = 880003 })
  await expect(page.locator('.content-title')).toHaveText('Signal 3')
  await page.evaluate(() => vm.toggleReadability())
  expect(await opened(page)).toEqual([880001, 880003])
})

test('triage: reading a card in place counts; passing it does not', async ({ page }) => {
  await setup(page)
  await page.evaluate(() => { vm.filterSelected = 'triage' })
  await expect.poll(() => page.evaluate(() => vm.cardItems.length)).toBe(3)
  // swiping past without reading
  await page.evaluate(() => { vm.cardIndex = 1 })
  expect(await opened(page)).toEqual([])
  await page.evaluate(() => vm.cardTap())
  await expect.poll(() => page.evaluate(() => vm.cardExpanded)).toBe(true)
  expect(await opened(page)).toEqual([880002])
})
