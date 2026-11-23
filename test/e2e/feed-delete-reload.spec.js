// @ts-check
const { test, expect } = require('@playwright/test')

// A delete hides the feed or folder at once but only reaches the server when
// the undo toast closes. A feed reload in that window (one already in flight,
// or the commit of an earlier delete) must not bring it back (#276).
// The server is a stub: lists come from `server`, and a delete edits it.
async function stub(page) {
  await page.goto('/')
  await page.waitForFunction(() => window.vm)
  // let the app's own startup reload settle before swapping the API
  await page.waitForFunction(() => vm._feedsLoad)
  await page.evaluate(() => vm._feedsLoad.catch(function () {}))
  await page.evaluate(() => {
    var server = window.server = {
      folders: [{ id: 9301, title: 'News', is_expanded: true }],
      feeds: [
        { id: 9401, title: 'Feed A', folder_id: null, link: '', feed_link: '', has_icon: false },
        { id: 9402, title: 'Feed B', folder_id: null, link: '', feed_link: '', has_icon: false },
        { id: 9403, title: 'Feed C', folder_id: 9301, link: '', feed_link: '', has_icon: false },
      ],
    }
    // copies, as a real response would be
    var copy = function (l) { return l.map(function (x) { return Object.assign({}, x) }) }
    // hold() parks the next list responses until release(): an in-flight reload
    window.held = null
    window.hold = function () { var r; window.held = new Promise(function (res) { r = res }); window.release = r }
    var gate = function (v) { return window.held ? window.held.then(function () { return v }) : Promise.resolve(v) }
    api.folders.list = function () { return gate(copy(server.folders)) }
    api.feeds.list = function () { return gate(copy(server.feeds)) }
    api.feeds.delete = function (id) {
      server.feeds = server.feeds.filter(function (f) { return f.id !== id })
      return Promise.resolve({ ok: true })
    }
    api.folders.delete = function (id) {
      server.folders = server.folders.filter(function (f) { return f.id !== id })
      server.feeds.forEach(function (f) { if (f.folder_id === id) f.folder_id = null })
      return Promise.resolve({ ok: true })
    }
    api.settings.update = function () { return Promise.resolve() }
    vm.filterSelected = ''
    return vm.refreshFeeds()
  })
  await expect.poll(() => feedIds(page)).toEqual([9401, 9402, 9403])
}
const feedIds = page => page.evaluate(() => vm.feeds.map(f => f.id).sort())
const folderIds = page => page.evaluate(() => vm.folders.map(f => f.id))
const feed = (page, id) => page.evaluate(id => vm.feeds.find(f => f.id === id), id)

test('deleting two feeds in a row: the first commit\'s reload keeps the second hidden', async ({ page }) => {
  await stub(page)
  await page.evaluate(() => { vm.deleteFeed(vm.feeds.find(f => f.id === 9401)) })
  await page.evaluate(() => { vm.deleteFeed(vm.feeds.find(f => f.id === 9402)) })
  // the second delete committed the first, whose reload lands with B still on the server
  await expect.poll(() => page.evaluate(() => server.feeds.map(f => f.id))).toEqual([9402, 9403])
  await page.evaluate(() => vm._feedsLoad)
  expect(await feedIds(page)).toEqual([9403])
})

test('a reload in flight when a feed is deleted does not bring it back; undo does', async ({ page }) => {
  await stub(page)
  await page.evaluate(() => { hold(); vm.refreshFeeds() })
  await page.evaluate(() => { vm.deleteFeed(vm.feeds.find(f => f.id === 9401)) })
  await page.evaluate(() => { var p = vm._feedsLoad; window.held = null; release(); return p })
  expect(await feedIds(page)).toEqual([9402, 9403])

  await page.evaluate(() => vm.runFeedUndo())
  await expect.poll(() => feedIds(page)).toEqual([9401, 9402, 9403])
})

test('a reload in flight when a folder is deleted keeps it gone and its feeds uncategorized; undo restores both', async ({ page }) => {
  await stub(page)
  await page.evaluate(() => { hold(); vm.refreshFeeds() })
  await page.evaluate(() => { vm.deleteFolder(vm.folders.find(f => f.id === 9301)) })
  await page.evaluate(() => { var p = vm._feedsLoad; window.held = null; release(); return p })
  expect(await folderIds(page)).toEqual([])
  expect((await feed(page, 9403)).folder_id).toBeNull()

  await page.evaluate(() => vm.runFeedUndo())
  await expect.poll(() => folderIds(page)).toEqual([9301])
  await expect.poll(async () => (await feed(page, 9403)).folder_id).toBe(9301)
})

test('once the delete commits, later reloads agree with the server', async ({ page }) => {
  await stub(page)
  await page.evaluate(() => { vm.deleteFeed(vm.feeds.find(f => f.id === 9401)) })
  await page.evaluate(() => vm.runFeedUndoCommit())
  await expect.poll(() => page.evaluate(() => server.feeds.map(f => f.id))).toEqual([9402, 9403])
  await page.evaluate(() => vm.refreshFeeds())
  expect(await feedIds(page)).toEqual([9402, 9403])
})
