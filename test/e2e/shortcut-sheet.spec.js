// @ts-check
const { test, expect } = require('@playwright/test')

// The shortcut sheet leads with the reading loop, fits a desk window without
// scrolling, and draws its keys as caps whose edge holds 3:1 in both themes.
test('shortcut sheet: reading loop first, no scroll at 1440x900', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.waitForFunction(() => window.vm)
  await page.keyboard.press('?')
  await expect(page.getByText('Keyboard Shortcuts', { exact: true })).toBeVisible()
  await expect(page.locator('.shortcut-group').first()).toHaveText('Reading loop')
  const scrolls = await page.locator('.custom-modal .modal-content').evaluate(el => el.scrollHeight > el.clientHeight + 2)
  expect(scrolls).toBe(false)
})

for (const theme of ['light', 'dark']) {
  test(`shortcut sheet: key caps keep a visible edge (${theme})`, async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => window.vm)
    await page.evaluate(t => { api.settings.update = function () { return Promise.resolve() }; vm.theme.name = t }, theme)
    await page.keyboard.press('?')
    const ratio = await page.locator('.shortcut-sheet kbd').first().evaluate(k => {
      function lum(c) { const m = c.match(/[\d.]+/g).map(Number); const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]) }
      let el = k, bg
      while (el) { bg = getComputedStyle(el).backgroundColor; if (bg && !/, 0\)$/.test(bg) && bg !== 'transparent') break; el = el.parentElement }
      const a = lum(getComputedStyle(k).borderTopColor), b = lum(bg)
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
    })
    expect(ratio).toBeGreaterThanOrEqual(3)
  })
}
