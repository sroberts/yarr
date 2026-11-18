// @ts-check
const { test, expect } = require('@playwright/test')

// Enter / Space on the folder the keyboard cursor is on in the feeds column
// (#255). Same stubbing as sidebar-keys.spec.js: the e2e DB has no feeds.
async function stubFolders(page) {
  await page.waitForFunction(() => window.vm)
  await page.evaluate(() => {
    var folders = [
      { id: 9001, title: 'Tech', is_expanded: true },
      { id: 9002, title: 'News', is_expanded: true },
    ]
    var feeds = [
      { id: 9101, title: 'Feed A', folder_id: 9001, link: '', feed_link: '', has_icon: false },
      { id: 9102, title: 'Feed B', folder_id: 9002, link: '', feed_link: '', has_icon: false },
    ]
    api.folders.list = function () { return Promise.resolve(folders) }
    api.feeds.list = function () { return Promise.resolve(feeds) }
    api.folders.update = function () { return Promise.resolve() }
    vm.filterSelected = ''
    return vm.refreshFeeds()
  })
  await expect(page.locator('#feed-list-scroll label.selectgroup', { hasText: 'News' })).toBeVisible()
}
const expanded = (page, id) => page.evaluate(id => vm.folders.find(f => f.id === id).is_expanded, id)
const cursorOnFolder = (page, id) => page.evaluate(id => {
  vm.feedSelected = 'folder:' + id
  vm.keyColumn = 'feeds'
  vm.keyColumnShown = true
  document.activeElement && document.activeElement.blur()
}, id)

test('sidebar: Enter / Space toggle the folder selected in the feeds column', async ({ page }) => {
  await page.goto('/')
  await stubFolders(page)
  await page.mouse.move(1000, 600)
  await cursorOnFolder(page, 9001)

  await page.keyboard.press('Enter')
  await expect.poll(() => expanded(page, 9001)).toBe(false)
  await page.keyboard.press(' ')
  await expect.poll(() => expanded(page, 9001)).toBe(true)
})

test('sidebar: the keyboard cursor wins over the pointer', async ({ page }) => {
  await page.goto('/')
  await stubFolders(page)
  await cursorOnFolder(page, 9001)
  await page.locator('#feed-list-scroll label.selectgroup', { hasText: 'News' }).hover()

  await page.keyboard.press('Enter')
  await expect.poll(() => expanded(page, 9001)).toBe(false)
  expect(await expanded(page, 9002)).toBe(true)
})

test('sidebar: with an article open, the pointer resting on a folder leaves Enter / Space alone', async ({ page }) => {
  await page.goto('/')
  await stubFolders(page)
  await page.locator('#feed-list-scroll label.selectgroup', { hasText: 'Tech' }).hover()
  await page.evaluate(() => { vm.itemSelected = 1; vm.keyColumnShown = false; document.activeElement && document.activeElement.blur() })

  await page.keyboard.press(' ')
  expect(await expanded(page, 9001)).toBe(true)
})

test('sidebar: without the feeds-column cursor, a selected folder is left alone', async ({ page }) => {
  await page.goto('/')
  await stubFolders(page)
  await page.mouse.move(1000, 600)
  await page.evaluate(() => { vm.feedSelected = 'folder:9001'; vm.keyColumnShown = false })

  await page.keyboard.press('Enter')
  expect(await expanded(page, 9001)).toBe(true)
})
