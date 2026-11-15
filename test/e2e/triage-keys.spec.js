// @ts-check
const { test, expect } = require('@playwright/test')

// Keyboard regressions in triage card mode. Cards are stubbed in the page, as
// in smoke.spec.js, so these run against the fresh, feedless e2e DB.
async function enterTriage(page) {
  await page.evaluate(() => {
    var list = [1, 2, 3].map(function (n) {
      return { id: 830000 + n, feed_id: 1, title: 'Card ' + n, status: 'unread', link: '', content: '<p>body ' + n + '</p>', date: new Date().toISOString() }
    })
    api.items.list = function () { return Promise.resolve({ list: list, has_more: false }) }
    api.items.update = function () { return Promise.resolve() }
    vm.filterSelected = 'triage'
  })
  await expect.poll(() => page.evaluate(() => vm.cardItems.length)).toBe(3)
}

test('triage: Esc with the menu open closes the menu and stays in triage', async ({ page }) => {
  // Regression: one Esc closed the ⋯ menu and also left triage, and letter
  // keys triaged the card behind an open menu.
  await page.goto('/')
  await enterTriage(page)
  await page.getByRole('button', { name: 'Menu' }).first().click()
  await expect(page.locator('.dropdown-menu.show')).toHaveCount(1)

  await page.keyboard.press('ArrowRight')
  expect(await page.evaluate(() => vm.cardStats.read)).toBe(0)

  await page.keyboard.press('Escape')
  await expect(page.locator('.dropdown-menu.show')).toHaveCount(0)
  expect(await page.evaluate(() => vm.cardMode)).toBe(true)

  // with the menu closed, Esc leaves triage as before
  await page.keyboard.press('Escape')
  await expect.poll(() => page.evaluate(() => vm.cardMode)).toBe(false)
})

test('triage: entering takes focus, so Enter reads the card instead of pressing the last control', async ({ page }) => {
  // Regression: after closing Settings, focus went back to the ⋯ Menu button;
  // 4 then Enter opened the menu instead of reading the card in place.
  await page.goto('/')
  await page.getByRole('button', { name: 'Menu' }).first().focus()
  await enterTriage(page)
  await expect.poll(() => page.evaluate(() => document.activeElement && document.activeElement.id)).toBe('triage-card')

  await page.keyboard.press('Enter')
  await expect.poll(() => page.evaluate(() => vm.cardExpanded)).toBe(true)
  await expect(page.locator('.dropdown-menu.show')).toHaveCount(0)
})
