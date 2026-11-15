// @ts-check
const { test, expect } = require('@playwright/test')

// Keyboard on the sidebar folder tree. The e2e DB has no feeds, so a folder
// and a feed are stubbed into the page and the folder write is stubbed out.
async function stubFolder(page) {
  await page.evaluate(() => {
    api.folders.update = function () { return Promise.resolve() }
    vm.filterSelected = ''
    vm.folders = [{ id: 9001, title: 'Tech', is_expanded: true }]
    vm.feeds = [{ id: 9101, title: 'Feed A', folder_id: 9001, link: '', feed_link: '', has_icon: false }]
  })
  const row = page.locator('#feed-list-scroll label.selectgroup', { hasText: 'Tech' })
  await expect(row).toBeVisible()
  return row
}
const expanded = page => page.evaluate(() => vm.folders[0].is_expanded)

test('sidebar: Enter / Space toggle the folder under the pointer', async ({ page }) => {
  await page.goto('/')
  const row = await stubFolder(page)
  await row.hover()

  await page.keyboard.press('Enter')
  await expect.poll(() => expanded(page)).toBe(false)
  await page.keyboard.press(' ')
  await expect.poll(() => expanded(page)).toBe(true)

  // pointer elsewhere: the keys leave the folder alone
  await page.mouse.move(1000, 600)
  await page.keyboard.press('Enter')
  expect(await expanded(page)).toBe(true)
})

test('sidebar: a control focused elsewhere keeps Enter even with the pointer on a folder', async ({ page }) => {
  await page.goto('/')
  const row = await stubFolder(page)
  const menu = page.getByRole('button', { name: 'Menu' }).first()
  await menu.focus()
  await row.hover()
  await page.keyboard.press('Enter')
  await expect(page.locator('.dropdown-menu.show')).toHaveCount(1)
  expect(await expanded(page)).toBe(true)
})
