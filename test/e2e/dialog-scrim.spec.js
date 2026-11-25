// @ts-check
const { test, expect } = require('@playwright/test')

// A .45 graphite scrim over the graphite dark ground changed almost nothing,
// so dialogs floated with no separation. Dark has its own deeper scrim and a
// stronger dialog rim; light keeps its gentle dim.
const look = page => page.evaluate(() => ({
  scrim: getComputedStyle(document.querySelector('.custom-modal')).backgroundColor,
  edge: getComputedStyle(document.querySelector('.command-palette-dialog')).borderTopColor,
}))

test('dialog scrim: dark gets a deeper one and a stronger rim than light', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.vm)
  await page.evaluate(() => { document.body.classList.remove('theme-dark'); document.body.classList.add('theme-light'); vm.openPalette() })
  const light = await look(page)
  await page.evaluate(() => { document.body.classList.remove('theme-light'); document.body.classList.add('theme-dark') })
  const dark = await look(page)
  expect(light.scrim).toBe('rgba(20, 22, 24, 0.45)')
  expect(dark.scrim).toBe('rgba(0, 0, 0, 0.6)')
  expect(dark.edge).toBe('rgb(63, 68, 74)')   // --border-strong, not the slip's --border-subtle
})
