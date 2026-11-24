// @ts-check
const { test, expect } = require('@playwright/test')

// The mark-all toast says how much it hit, so a slip of Shift (R for r) is
// noticed while undo is still on screen, and undo puts the exact count back.
// Feeds and counts are stubbed: the e2e DB has none.
async function stub(page) {
  await page.goto('/')
  await page.waitForFunction(() => window.vm)
  await page.evaluate(() => {
    var unread = { 9501: 60, 9502: 30 }
    api.status = function () {
      return Promise.resolve({ running: 0, stats: Object.keys(unread).map(function (id) { return { feed_id: +id, unread: unread[id], starred: 0 } }) })
    }
    api.folders.list = function () { return Promise.resolve([{ id: 9601, title: 'Tech', is_expanded: true }]) }
    api.feeds.list = function () {
      return Promise.resolve([
        { id: 9501, title: 'Feed X', folder_id: 9601, link: '', feed_link: '', has_icon: false },
        { id: 9502, title: 'Feed Y', folder_id: null, link: '', feed_link: '', has_icon: false },
      ])
    }
    api.items.list = function () { return Promise.resolve({ list: [], has_more: false }) }
    api.items.mark_read = function () { return Promise.resolve({ ok: true }) }
    api.settings.update = function () { return Promise.resolve() }
    vm.feedSelected = ''
    return vm.refreshFeeds().then(function () { return vm.refreshStats() })
  })
  await expect.poll(() => page.evaluate(() => vm.scopeUnread)).toBe(90)
}
const toast = page => page.locator('.app-toast-undo')

test('mark all read: the toast says how many and where', async ({ page }) => {
  await stub(page)
  await page.keyboard.press('Shift+R')
  await expect(toast(page)).toContainText('Marked 90 read in all feeds')
})

test('mark a folder read: the toast names the folder and its count', async ({ page }) => {
  await stub(page)
  await page.evaluate(() => { vm.feedSelected = 'folder:9601' })
  await expect.poll(() => page.evaluate(() => vm.scopeUnread)).toBe(60)
  await page.keyboard.press('Shift+R')
  await expect(toast(page)).toContainText('Marked 60 read in “Tech”')
})

test('mark all read then undo: the unread count comes back exactly', async ({ page }) => {
  await stub(page)
  await page.keyboard.press('Shift+R')
  await expect.poll(() => page.evaluate(() => vm.scopeUnread)).toBe(0)
  await page.keyboard.press('u')
  await expect.poll(() => page.evaluate(() => vm.scopeUnread)).toBe(90)
  // and a stats poll afterwards agrees
  await page.evaluate(() => vm.refreshStats())
  expect(await page.evaluate(() => vm.scopeUnread)).toBe(90)
})
