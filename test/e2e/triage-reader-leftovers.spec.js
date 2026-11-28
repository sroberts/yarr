// @ts-check
const { test, expect } = require('@playwright/test')

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="#888"/></svg>'

async function triage(page, list) {
  await page.route('**/comic.svg', (route) => route.fulfill({ contentType: 'image/svg+xml', body: SVG }))
  await page.goto('/')
  await page.waitForFunction(() => window.vm)
  await page.evaluate((list) => {
    api.items.list = function () { return Promise.resolve({ list: list, has_more: false }) }
    api.items.update = function () { return Promise.resolve() }
    api.settings.update = function () { return Promise.resolve() }
    vm.ttsSupported = true
    vm.filterSelected = 'triage'
  }, list)
  await expect.poll(() => page.evaluate(() => vm.cardItems.length)).toBe(list.length)
}

function card(n, extra) {
  return Object.assign({ id: 870000 + n, feed_id: 1, title: 'Card ' + n, status: 'unread', link: 'https://example.com/' + n, content: '<p>body</p>', date: new Date().toISOString() }, extra)
}

// With no folders the picker's only choice is "All folders": nothing to pick.
test('triage: the folder picker shows only when there are folders to pick', async ({ page }) => {
  await triage(page, [card(1)])
  const picker = page.getByRole('combobox', { name: 'Folder to triage' })
  await page.evaluate(() => { vm.folders = [] })
  await expect(picker).toHaveCount(0)
  await page.evaluate(() => { vm.folders = [{ id: 1, title: 'News', is_expanded: true }] })
  await expect(picker).toBeVisible()
})

// An image-only card (xkcd) shows the image's alt text as a caption, and
// Listen reads the title and that caption rather than offering silence.
test('triage: an image-only card captions its alt text, and Listen reads it', async ({ page }) => {
  const img = '<img src="http://127.0.0.1:7099/comic.svg" alt="The joke lives here.">'
  await triage(page, [card(1, { content: img }), card(2, { title: '', content: '<img src="http://127.0.0.1:7099/comic.svg">' })])

  const caption = page.locator('#triage-card figcaption')
  await expect(caption).toHaveText('The joke lives here.')
  // the caption carries the text, so the image doesn't say it twice
  await expect(page.locator('#triage-card img')).toHaveAttribute('alt', '')
  expect(await page.evaluate(() => vm.cardSpeech)).toBe('Card 1. The joke lives here.')
  await expect(page.locator('.card-listen-btn')).toBeEnabled()

  // no title, no text, no alt: nothing to read, so Listen is off
  await page.evaluate(() => { vm.cardIndex = 1 })
  await expect(caption).toHaveCount(0)
  expect(await page.evaluate(() => vm.cardSpeech)).toBe('')
  await expect(page.locator('.card-listen-btn')).toBeDisabled()
})

test('triage: a caption that only repeats the title is dropped', async ({ page }) => {
  await triage(page, [card(1, { title: 'Comic', content: '<img src="http://127.0.0.1:7099/comic.svg" alt="comic">' })])
  await expect(page.locator('#triage-card img')).toBeVisible()
  await expect(page.locator('#triage-card figcaption')).toHaveCount(0)
  await expect(page.locator('#triage-card img')).toHaveAttribute('alt', 'comic')
})

// After a failed load the reader says so, without the keyboard hint that
// implies there is a list to move through.
test('reader: the error state drops the j / k hint', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.vm)
  const empty = page.locator('.reader-empty').first()
  await expect(empty).toContainText('for shortcuts')
  await page.evaluate(() => {
    api.items.list = function () { return Promise.reject(new Error('offline')) }
    vm.filterSelected = 'starred'
  })
  await expect(empty).toContainText('Couldn’t load articles')
  await expect(empty).not.toContainText('for shortcuts')
})

// A heading sits closer to the text it introduces than to the text before it.
test('reader: headings have more room above than below', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.vm)
  const gaps = await page.evaluate(() => {
    var wrap = document.createElement('div')
    wrap.className = 'content'
    wrap.innerHTML = '<p>Before.</p><h2>Heading</h2><p>After.</p><h3>Sub</h3><ul><li>x</li></ul>'
    document.body.appendChild(wrap)
    var r = function (sel) { return wrap.querySelector(sel).getBoundingClientRect() }
    var out = {
      h2Above: r('h2').top - r('p').bottom,
      h2Below: r('h2 + p').top - r('h2').bottom,
      h3Above: r('h3').top - r('h2 + p').bottom,
      h3Below: r('ul').top - r('h3').bottom,
    }
    wrap.remove()
    return out
  })
  expect(gaps.h2Above).toBeGreaterThan(gaps.h2Below * 2)
  expect(gaps.h3Above).toBeGreaterThan(gaps.h3Below * 2)
})
