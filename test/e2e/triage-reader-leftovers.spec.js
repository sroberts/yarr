// @ts-check
const { test, expect } = require('@playwright/test')

// the app's service worker would answer image requests itself, past the
// routes below
test.use({ serviceWorkers: 'block' })

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="#888"/></svg>'

async function triage(page, list) {
  await page.route('**/comic*.svg', (route) => route.fulfill({ contentType: 'image/svg+xml', body: SVG }))
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

// The hover text (title attribute) wins; file names and filler never caption.
test('triage: the caption prefers hover text and skips file names and filler', async ({ page }) => {
  const src = 'http://127.0.0.1:7099/comic.svg'
  await triage(page, [
    card(1, { content: '<img src="' + src + '" alt="A stick figure at a desk" title="The real joke.">' }),
    card(2, { content: '<img src="' + src.replace('comic', 'comic2') + '" alt="IMG_2034.JPG">' }),
    card(3, { content: '<img src="' + src.replace('comic', 'comic3') + '" alt="sunset-harbour.jpg" title="image">' }),
  ])
  const caption = page.locator('#triage-card figcaption')
  await expect(caption).toHaveText('The real joke.')
  // the alt says something else, so the image keeps it
  await expect(page.locator('#triage-card img')).toHaveAttribute('alt', 'A stick figure at a desk')
  for (const i of [1, 2]) {
    await page.evaluate((i) => { vm.cardIndex = i }, i)
    await expect(page.locator('#triage-card img')).toBeVisible()
    await expect(caption).toHaveCount(0)
  }
  expect(await page.evaluate(() => vm.cardSpeech)).toBe('Card 3')
})

// Off says why, and p on an empty card answers instead of doing nothing.
test('triage: Listen on an empty card is labelled off, and p says so', async ({ page }) => {
  await triage(page, [card(1, { title: '', content: '<img src="http://127.0.0.1:7099/comic.svg">' })])
  const listen = page.getByRole('button', { name: 'Nothing to read aloud' })
  await expect(listen).toBeDisabled()
  expect(await listen.evaluate((el) => getComputedStyle(el).opacity)).toBe('0.4')
  await page.locator('#triage-card').focus()
  await page.keyboard.press('p')
  await expect(page.locator('.app-toast')).toHaveText('Nothing to read aloud on this card')
  await expect(page.getByRole('status').filter({ hasText: 'Nothing to read aloud on this card' })).toHaveCount(1)
})

// After a failed load the list column says so, with Retry beside it; the
// reader repeats nothing (and keeps no keyboard hint that implies a list).
test('reader: the error state leaves the message and Retry to the list', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.vm)
  const empty = page.locator('#col-item .reader-empty')
  await expect(empty).toContainText('for shortcuts')
  await page.evaluate(() => {
    api.items.list = function () { return Promise.reject(new Error('offline')) }
    vm.filterSelected = 'starred'
  })
  await expect(page.locator('#col-item-list')).toContainText('Couldn’t load articles')
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
  await expect(empty).toHaveCount(0)
})

async function openArticle(page, content) {
  await page.goto('/')
  await page.waitForFunction(() => window.vm)
  await page.evaluate((content) => {
    var list = [{ id: 871001, feed_id: 1, title: 'Rhythm', status: 'unread', link: 'https://example.com/r', content: content, date: new Date().toISOString() }]
    api.items.list = function () { return Promise.resolve({ list: list, has_more: false }) }
    api.items.get = function () { return Promise.resolve(list[0]) }
    api.items.update = function () { return Promise.resolve() }
    api.settings.update = function () { return Promise.resolve() }
    vm.feedSelected = ''
    return vm.$nextTick().then(function () { return vm.refreshItems(false) })
  }, content)
  await expect.poll(() => page.evaluate(() => vm.items.length)).toBe(1)
  await page.evaluate(() => { vm.itemSelected = 871001 })
  await expect(page.locator('.content-title')).toHaveText('Rhythm')
}

// A heading sits closer to the text it introduces than to the text before
// it, in the real reader; the slip's own title keeps its place.
test('reader: body headings have more room above than below; the title is untouched', async ({ page }) => {
  await openArticle(page, '<div><p>Before.</p><h2>Heading</h2><p>After.</p><h3>Sub</h3><ul><li>x</li></ul></div>')
  const m = await page.evaluate(() => {
    var body = document.querySelector('.content-body')
    var r = function (sel) { return body.querySelector(sel).getBoundingClientRect() }
    var t = getComputedStyle(document.querySelector('.content-title'))
    return {
      titleTop: t.marginTop, titleBottom: t.marginBottom,
      h2Above: r('h2').top - r('p').bottom,
      h2Below: r('h2 + p').top - r('h2').bottom,
      h3Above: r('h3').top - r('h2 + p').bottom,
      h3Below: r('ul').top - r('h3').bottom,
    }
  })
  expect([m.titleTop, m.titleBottom]).toEqual(['0px', '0px'])
  expect(m.h2Above).toBeGreaterThan(m.h2Below * 2)
  expect(m.h3Above).toBeGreaterThan(m.h3Below * 2)
})

// A body that opens on a heading starts where one opening on a paragraph does.
test('reader: a body opening on a heading starts where a paragraph would', async ({ page }) => {
  await openArticle(page, '<div><h2>Opening heading</h2><p>Text.</p></div>')
  const onHeading = await page.evaluate(() => document.querySelector('.content-body h2').getBoundingClientRect().top - document.querySelector('.content-body').getBoundingClientRect().top)
  await openArticle(page, '<div><p>Opening paragraph.</p></div>')
  const onPara = await page.evaluate(() => document.querySelector('.content-body p').getBoundingClientRect().top - document.querySelector('.content-body').getBoundingClientRect().top)
  expect(Math.abs(onHeading - onPara)).toBeLessThan(2)
})
