// @ts-check
const { test, expect } = require('@playwright/test')

// Reader toolbar tooltips name their key, and the palette carries the open
// article's verbs under the words a reader would type (#262). The e2e DB has
// no feeds, so the list and reads are stubbed.
async function openArticle(page) {
  await page.goto('/')
  await page.waitForFunction(() => window.vm)
  await page.evaluate(() => {
    var list = [1, 2, 3].map(function (n) {
      return { id: 840000 + n, feed_id: 1, title: 'Verb ' + n, status: 'unread', link: 'https://example.com/' + n, content: '<p>body ' + n + '</p>', date: new Date().toISOString() }
    })
    api.items.list = function () { return Promise.resolve({ list: list, has_more: false }) }
    api.items.get = function (id) { return Promise.resolve(list.find(function (i) { return i.id == id })) }
    api.items.update = function () { return Promise.resolve() }
    api.settings.update = function () { return Promise.resolve() }
    vm.feedSelected = ''
    return vm.$nextTick().then(function () { return vm.refreshItems(false) })
  })
  await expect.poll(() => page.evaluate(() => vm.items.length)).toBe(3)
  await page.evaluate(() => { vm.itemSelected = 840002 })
  await expect(page.getByRole('heading', { name: 'Verb 2' })).toBeVisible()
}

async function palette(page, query) {
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k')
  await expect(page.locator('.command-palette-input')).toBeFocused()
  await page.locator('.command-palette-input').fill(query)
  return page.locator('.command-palette-row')
}

test('reader toolbar: each tooltip names its key', async ({ page }) => {
  await openArticle(page)
  const bar = page.locator('#col-item .toolbar')
  await expect(bar.getByRole('button', { name: 'Starred', exact: true })).toHaveAttribute('title', 'Star (s)')
  await expect(bar.getByRole('button', { name: 'Read', exact: true })).toHaveAttribute('title', 'Mark unread (r)')
  await expect(bar.getByRole('button', { name: 'Save to Instapaper' })).toHaveAttribute('title', 'Save to Instapaper (Shift+I)')
  await expect(bar.getByRole('button', { name: 'Next article' })).toHaveAttribute('title', 'Next Article (j)')
  await expect(bar.getByRole('button', { name: 'Close article' })).toHaveAttribute('title', 'Close Article (q)')
})

test('palette: "star" ranks the open article\'s verb first and runs it', async ({ page }) => {
  await openArticle(page)
  const rows = await palette(page, 'star')
  await expect(rows.first()).toContainText('Star article')
  await expect(rows.first()).toContainText('s')
  await page.keyboard.press('Enter')
  await expect.poll(() => page.evaluate(() => vm.itemSelectedDetails.status)).toBe('starred')

  const again = await palette(page, 'unstar')
  await expect(again.first()).toContainText('Unstar article')
})

test('palette: next and close act on the open article', async ({ page }) => {
  await openArticle(page)
  await palette(page, 'next article')
  await page.keyboard.press('Enter')
  await expect.poll(() => page.evaluate(() => vm.itemSelected)).toBe(840003)

  // the last article has no next
  await palette(page, 'next article')
  await expect(page.locator('.command-palette-row', { hasText: /^Next article/ })).toHaveCount(0)
  await page.keyboard.press('Escape')

  await palette(page, 'close article')
  await page.keyboard.press('Enter')
  await expect.poll(() => page.evaluate(() => vm.itemSelected)).toBe(null)
})

test('palette: no article verbs with nothing open', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.vm)
  const labels = await page.evaluate(() => vm.paletteCommands().filter(c => c.enabled !== false).map(c => c.label))
  for (const l of ['Star article', 'Mark article read', 'Next article', 'Close article']) expect(labels).not.toContain(l)
})
