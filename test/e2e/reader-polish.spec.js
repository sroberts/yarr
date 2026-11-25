// @ts-check
const { test, expect } = require('@playwright/test')

async function ready(page) {
  await page.goto('/')
  await page.waitForFunction(() => window.vm)
}

test('reader body drops a leading heading that repeats the title', async ({ page }) => {
  await ready(page)
  const out = await page.evaluate(() => [
    dropLeadingTitle('<div><h2>Hello  World</h2><p>x</p></div>', 'hello world'),
    dropLeadingTitle('<p>intro</p><h2>Hello World</h2>', 'Hello World'),
    dropLeadingTitle('<img src="a.png"><h1>Hello World</h1>', 'Hello World'),
    dropLeadingTitle('<h2>Something else</h2>', 'Hello World'),
  ])
  expect(out).toEqual([
    '<div><p>x</p></div>',
    '<p>intro</p><h2>Hello World</h2>',
    '<img src="a.png"><h1>Hello World</h1>',
    '<h2>Something else</h2>',
  ])
})

test('slip counter: a known unread total replaces "20+"; an unknown one keeps it', async ({ page }) => {
  await ready(page)
  const frame = await page.evaluate(() => {
    vm.items = Array.from({ length: 20 }, (_, i) => ({ id: 9900 + i }))
    vm.itemsHasMore = true
    vm.itemSelected = 9901
    vm.itemsTotal = 91
    var known = vm.itemFrame.total
    vm.itemsTotal = null
    var unknown = vm.itemFrame.total
    vm.itemSelected = null
    return [known, unknown]
  })
  expect(frame).toEqual([91, '20+'])
})

test('triage card: no domain line when the feed is named after its site', async ({ page }) => {
  await ready(page)
  const domains = await page.evaluate(() => {
    vm.feeds = [
      { id: 9801, title: 'xkcd.com', folder_id: null },
      { id: 9802, title: 'Daring Fireball', folder_id: null },
    ]
    var card = (feed, link) => { vm.cardItems = [{ id: 1, feed_id: feed, link: link, title: 't' }]; vm.cardIndex = 0; return vm.cardDomain }
    var out = [card(9801, 'https://www.xkcd.com/1/'), card(9802, 'https://sixcolors.com/post')]
    vm.cardItems = []
    return out
  })
  expect(domains).toEqual(['', 'sixcolors.com'])
})
