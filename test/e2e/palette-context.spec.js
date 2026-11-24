// @ts-check
const { test, expect } = require('@playwright/test')

// The palette puts what you're looking at first: with an article open its
// verbs lead, and the bulk "mark all read" sits after the view filters, never
// near the top. The e2e DB has no feeds, so the list and reads are stubbed.
async function stubItems(page) {
  await page.goto('/')
  await page.waitForFunction(() => window.vm)
  await page.evaluate(() => {
    var list = [1, 2, 3].map(function (n) {
      return { id: 870000 + n, feed_id: 1, title: 'Ctx ' + n, status: 'unread', link: 'https://example.com/' + n, content: '<p>body</p>', date: new Date().toISOString() }
    })
    api.items.list = function () { return Promise.resolve({ list: list, has_more: false }) }
    api.items.get = function (id) { return Promise.resolve(list.find(function (i) { return i.id == id })) }
    api.items.update = function () { return Promise.resolve() }
    api.settings.update = function () { return Promise.resolve() }
    vm.feedSelected = ''
    return vm.$nextTick().then(function () { return vm.refreshItems(false) })
  })
  await expect.poll(() => page.evaluate(() => vm.items.length)).toBe(3)
}
async function openPalette(page) {
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k')
  await expect(page.locator('.command-palette-input')).toBeFocused()
}
const groups = page => page.locator('.command-palette-group').allTextContents()
const rows = page => page.locator('.command-palette-row .cmd-label').allTextContents()

test('palette: with an article open, its verbs come first', async ({ page }) => {
  await stubItems(page)
  await page.evaluate(() => { vm.itemSelected = 870002 })
  await expect(page.getByRole('heading', { name: 'Ctx 2' })).toBeVisible()
  await openPalette(page)
  expect((await groups(page))[0]).toBe('Article')
  expect((await rows(page))[0]).toBe('Star article')
  await page.keyboard.press('Enter')
  await expect.poll(() => page.evaluate(() => vm.itemSelectedDetails.status)).toBe('starred')
})

test('palette: with nothing open, the view comes first and article verbs are absent', async ({ page }) => {
  await stubItems(page)
  await openPalette(page)
  expect((await groups(page))[0]).toBe('View')
  const labels = await rows(page)
  expect(labels).not.toContain('Star article')
})

test('palette: mark all read follows the view filters', async ({ page }) => {
  await stubItems(page)
  await page.evaluate(() => { vm.itemSelected = 870001 })
  // the e2e DB has no unread feeds, so the bulk verb is disabled and not
  // rendered: check its place in the full command order instead
  const labels = await page.evaluate(() => vm.paletteCommands().map(c => c.label))
  const markAll = labels.findIndex(l => /^Mark all .* read$/.test(l))
  expect(markAll).toBeGreaterThan(-1)
  expect(markAll).toBeGreaterThan(labels.indexOf('Triage unread'))
  expect(markAll).toBeGreaterThan(labels.indexOf('Close article'))
})
