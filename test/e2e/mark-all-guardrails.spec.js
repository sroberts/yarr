// @ts-check
const { test, expect } = require('@playwright/test')

// Mark all read can clear hundreds of articles in one press, so its visible
// button lives only in the Unread view (where what it clears is on screen),
// the palette files it apart from the view filters, and its undo lasts as
// long as a delete's. Feeds and counts are stubbed: the e2e DB has none.
async function stub(page) {
  await page.goto('/')
  await page.waitForFunction(() => window.vm)
  await page.evaluate(() => {
    var unread = { 9701: 12 }
    api.status = function () {
      return Promise.resolve({ running: 0, stats: Object.keys(unread).map(function (id) { return { feed_id: +id, unread: unread[id], starred: 0 } }) })
    }
    api.folders.list = function () { return Promise.resolve([]) }
    api.feeds.list = function () {
      return Promise.resolve([{ id: 9701, title: 'Feed G', folder_id: null, link: '', feed_link: '', has_icon: false }])
    }
    api.items.list = function () { return Promise.resolve({ list: [], has_more: false }) }
    api.items.mark_read = function () { return Promise.resolve({ ok: true }) }
    api.settings.update = function () { return Promise.resolve() }
    vm.feedSelected = ''
    return vm.refreshFeeds().then(function () { return vm.refreshStats() })
  })
  await expect.poll(() => page.evaluate(() => vm.scopeUnread)).toBe(12)
}
const markAllButton = page => page.locator('.stack-heading').getByRole('button', { name: 'Mark all feeds read' })

test('mark all read: the button shows in Unread only', async ({ page }) => {
  await stub(page)
  await page.evaluate(() => { vm.filterSelected = 'unread' })
  await expect(markAllButton(page)).toBeVisible()
  await page.evaluate(() => { vm.filterSelected = 'starred' })
  await expect(markAllButton(page)).toHaveCount(0)
  await page.evaluate(() => { vm.filterSelected = '' })
  await expect(markAllButton(page)).toHaveCount(0)
})

test('mark all read: its own palette group, after the view filters', async ({ page }) => {
  await stub(page)
  const cmds = await page.evaluate(() => vm.paletteCommands().map(c => ({ group: c.group, label: c.label })))
  const i = cmds.findIndex(c => c.label === 'Mark all feeds read')
  expect(cmds[i].group).toBe('Mark read')
  expect(i).toBeGreaterThan(cmds.findIndex(c => c.label === 'Triage unread'))
})

test('mark all read: undo stays up as long as a delete\'s', async ({ page }) => {
  await stub(page)
  await page.keyboard.press('Shift+R')
  await expect(page.locator('.app-toast-undo')).toContainText('Marked 12 read in all feeds')
  expect(await page.evaluate(() => vm.feedUndo && vm.feedUndo.ms)).toBe(10000)
})
