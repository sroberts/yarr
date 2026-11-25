// @ts-check
const { test, expect } = require('@playwright/test')

// Three columns start at 992px, which leaves the reader ~300px: the full
// toolbar used to run past the viewport there, taking Prev/Next/Close with it
// and scrolling the page sideways. A narrow reader column now folds the four
// secondary actions into More actions, as phones do.
const seed = (page, id) => page.evaluate((id) => {
  var item = { id: id, feed_id: 1, title: 'Width ' + id, status: 'read', link: 'https://example.com/w',
    media_links: [], content: '<p>body</p>' }
  api.items.get = function () { return Promise.resolve(item) }
  api.items.update = function () { return Promise.resolve() }
  vm.itemSelected = id
}, id)

for (const width of [992, 1024, 1100, 1148]) {
  test(`reader toolbar at ${width}px: nothing off screen, secondary actions in More`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/')
    await page.waitForFunction(() => window.vm)
    await seed(page, 820000 + width)
    await expect(page.getByRole('heading', { name: 'Width ' + (820000 + width) })).toBeVisible()

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    for (const name of ['Previous article', 'Next article', 'Close article', 'Starred', 'Read', 'Save to Instapaper']) {
      const box = await page.locator('#col-item .toolbar').getByRole('button', { name, exact: true }).boundingBox()
      expect(box, name).not.toBeNull()
      expect(box.x + box.width, `${name} right edge`).toBeLessThanOrEqual(width)
    }
    await expect(page.getByTestId('reader-copy-link')).toBeHidden()
    await page.locator('[data-testid="reader-more"] > button').click()
    await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible()
  })
}

test('reader toolbar at 1280px: the secondary actions are inline and More is gone', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.waitForFunction(() => window.vm)
  await seed(page, 821280)
  await expect(page.getByRole('heading', { name: 'Width 821280' })).toBeVisible()
  await expect(page.getByTestId('reader-copy-link')).toBeVisible()
  await expect(page.locator('[data-testid="reader-more"] > button')).toBeHidden()
})
