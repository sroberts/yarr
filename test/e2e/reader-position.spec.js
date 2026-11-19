// @ts-check
const { test, expect } = require('@playwright/test')

// Closing an article keeps its row as the cursor, so j / k resume from it
// instead of restarting at the top of the list (#260). The e2e DB has no
// feeds, so the article list and reads are stubbed.
async function stubItems(page) {
  await page.goto('/')
  await page.waitForFunction(() => window.vm)
  await page.evaluate(() => {
    var list = [1, 2, 3, 4, 5].map(function (n) {
      return { id: 830000 + n, feed_id: 1, title: 'Article ' + n, status: 'read', link: '', content: '<p>body ' + n + '</p>', date: new Date().toISOString() }
    })
    api.items.list = function () { return Promise.resolve({ list: list, has_more: false }) }
    api.items.get = function (id) { return Promise.resolve(list.find(function (i) { return i.id == id })) }
    api.items.update = function () { return Promise.resolve() }
    // the empty e2e DB starts on the feed list (null): pick All Feeds
    vm.feedSelected = ''
    return vm.$nextTick().then(function () { return vm.refreshItems(false) })
  })
  await expect.poll(() => page.evaluate(() => vm.items.length)).toBe(5)
}
const selected = page => page.evaluate(() => vm.itemSelected)
const id = n => 830000 + n

test('reader: q then j resumes after the closed article, not at the top', async ({ page }) => {
  await stubItems(page)
  await page.keyboard.press('j')
  await page.keyboard.press('j')
  await expect.poll(() => selected(page)).toBe(id(2))

  await page.keyboard.press('q')
  await expect.poll(() => selected(page)).toBe(null)
  // the closed row stays marked and takes focus
  const row = page.locator('#item-list-scroll .item-row.is-cursor')
  await expect(row).toHaveCount(1)
  await expect(row).toContainText('Article 2')
  expect(await page.evaluate(() => document.activeElement && document.activeElement.value)).toBe(String(id(2)))

  await page.keyboard.press('j')
  await expect.poll(() => selected(page)).toBe(id(3))
  await expect(page.locator('#item-list-scroll .item-row.is-cursor')).toHaveCount(0)
})

test('reader: Esc then k steps back from the closed article', async ({ page }) => {
  await stubItems(page)
  await page.keyboard.press('j')
  await page.keyboard.press('j')
  await page.keyboard.press('j')
  await expect.poll(() => selected(page)).toBe(id(3))
  await page.keyboard.press('Escape')
  await expect.poll(() => selected(page)).toBe(null)
  await page.keyboard.press('k')
  await expect.poll(() => selected(page)).toBe(id(2))
})

test('reader: l reopens the article just closed', async ({ page }) => {
  await stubItems(page)
  await page.keyboard.press('j')
  await page.keyboard.press('j')
  await page.keyboard.press('q')
  await expect.poll(() => selected(page)).toBe(null)
  await page.keyboard.press('l')
  await expect.poll(() => selected(page)).toBe(id(2))
})

test('reader: the close button keeps the cursor too', async ({ page }) => {
  await stubItems(page)
  await page.keyboard.press('j')
  await page.keyboard.press('j')
  await expect.poll(() => selected(page)).toBe(id(2))
  await page.getByRole('button', { name: 'Close article' }).click()
  await expect(page.locator('#item-list-scroll .item-row.is-cursor')).toContainText('Article 2')
  await page.keyboard.press('j')
  await expect.poll(() => selected(page)).toBe(id(3))
})

test('reader: changing the view clears the cursor', async ({ page }) => {
  await stubItems(page)
  await page.keyboard.press('j')
  await page.keyboard.press('j')
  await page.keyboard.press('q')
  await expect.poll(() => page.evaluate(() => vm.itemCursor)).toBe(id(2))
  await page.evaluate(() => { vm.filterSelected = 'starred' })
  await expect.poll(() => page.evaluate(() => vm.itemCursor)).toBe(null)
  await expect.poll(() => page.evaluate(() => vm.items.length)).toBe(5)
  await page.evaluate(() => document.activeElement && document.activeElement.blur())
  await page.keyboard.press('j')
  await expect.poll(() => selected(page)).toBe(id(1))
})
