// @ts-check
const { test, expect } = require('@playwright/test')

// Feed and folder rows share one actions menu (#166): the header and Mark
// read are common, the rest switches on what the menu is for. The e2e DB has
// no feeds, so folders, feeds and their stats are stubbed.
async function stub(page) {
  await page.goto('/')
  await page.waitForFunction(() => window.vm)
  await page.evaluate(() => {
    var folders = [{ id: 9201, title: 'Tech', is_expanded: true }]
    var feeds = [
      { id: 9301, title: 'Feed A', folder_id: 9201, link: 'https://a.example', feed_link: 'https://a.example/rss', has_icon: false },
      { id: 9302, title: 'Feed B', folder_id: 9201, link: '', feed_link: '', has_icon: false },
    ]
    api.folders.list = function () { return Promise.resolve(folders) }
    api.feeds.list = function () { return Promise.resolve(feeds) }
    api.settings.update = function () { return Promise.resolve() }
    vm.filterSelected = ''
    return vm.refreshFeeds().then(function () {
      vm.feedStats = { 9301: { unread: 3, starred: 0 }, 9302: { unread: 4, starred: 0 } }
    })
  })
}

const menu = (page) => page.getByRole('menu')

test('row menu: a feed gets its own items under the shared header and Mark read', async ({ page }) => {
  await stub(page)
  await page.getByRole('button', { name: 'Feed actions for Feed A' }).click()
  await expect(menu(page)).toHaveAccessibleName('Actions for Feed A')
  await expect(menu(page).getByRole('menuitem').first()).toHaveText('Mark 3 read')
  await expect(menu(page).getByRole('menuitem').first()).toBeFocused()
  for (const name of ['Website', 'Feed link', 'Rename', 'Change link', 'Move out of folder', 'New folder', 'Delete']) {
    await expect(menu(page).getByRole('menuitem', { name })).toHaveCount(1)
  }
})

test('row menu: a folder sums its feeds and offers only rename and delete', async ({ page }) => {
  await stub(page)
  await page.getByRole('button', { name: 'Folder actions for Tech' }).click()
  await expect(menu(page)).toHaveAccessibleName('Actions for Tech')
  const items = (await menu(page).getByRole('menuitem').allTextContents()).map((t) => t.trim())
  expect(items).toEqual(['Mark 7 read', 'Rename', 'Delete'])
})

test('row menu: switching rows while open swaps the items; counts follow the stats', async ({ page }) => {
  await stub(page)
  await page.getByRole('button', { name: 'Feed actions for Feed A' }).click()
  await expect(menu(page).getByRole('menuitem', { name: 'Website' })).toHaveCount(1)
  // reopened on the folder without closing: one menu, the folder's items
  await page.evaluate(() => {
    var btn = document.querySelector('[aria-label="Folder actions for Tech"]')
    vm.openFolderContextMenu(vm.folders[0], { currentTarget: btn })
  })
  await expect(page.getByRole('menu')).toHaveCount(1)
  await expect(menu(page)).toHaveAccessibleName('Actions for Tech')
  await expect(menu(page).getByRole('menuitem', { name: 'Website' })).toHaveCount(0)
  // a stats poll while it is open updates Mark read in place
  await page.evaluate(() => { vm.feedStats = { 9301: { unread: 0, starred: 0 }, 9302: { unread: 0, starred: 0 } } })
  const mark = menu(page).getByRole('menuitem').first()
  await expect(mark).toHaveText('No unread')
  await expect(mark).toHaveAttribute('aria-disabled', 'true')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
})
