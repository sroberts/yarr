// @ts-check
const { test, expect } = require('@playwright/test')

// In triage the card is the page's content and the article column is hidden,
// so the column holding the card is the main landmark: a screen reader's
// main-region key lands on it rather than finding no main at all.
test('triage: the card column is the main landmark; leaving restores Feeds and Article', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.vm)
  await page.evaluate(() => {
    var list = [1, 2].map(function (n) {
      return { id: 860000 + n, feed_id: 1, title: 'Landmark ' + n, status: 'unread', link: 'https://example.com/' + n, content: '<p>body</p>', date: new Date().toISOString() }
    })
    api.items.list = function () { return Promise.resolve({ list: list, has_more: false }) }
    api.items.update = function () { return Promise.resolve() }
    api.settings.update = function () { return Promise.resolve() }
    vm.filterSelected = 'triage'
  })
  await expect.poll(() => page.evaluate(() => vm.cardItems.length)).toBe(2)

  await expect(page.getByRole('main')).toHaveCount(1)
  const main = page.getByRole('main', { name: 'Triage' })
  await expect(main).toBeVisible()
  await expect(main.locator('#triage-card')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Feeds' })).toHaveCount(0)

  await page.evaluate(() => { vm.filterSelected = 'unread' })
  await expect(page.getByRole('navigation', { name: 'Feeds' })).toBeVisible()
  await expect(page.getByRole('main', { name: 'Article' })).toBeVisible()
})
