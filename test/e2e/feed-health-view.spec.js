// @ts-check
const { test, expect } = require('@playwright/test')

// Settings > Feed health (doc/specs/feed-health.md). The e2e DB has no
// feeds, so feeds, filters and the health report are stubbed.
const DAY = 86400000

async function open(page, opts) {
  await page.goto('/')
  await page.waitForFunction(() => window.vm)
  await page.evaluate(({ trackedDays, report }) => {
    var now = Date.now()
    var DAY = 86400000
    app.settings.feed_health_since = Math.floor((now - trackedDays * DAY) / 1000)
    var feeds = [
      { id: 1, title: 'Broken Feed', folder_id: null, link: '', feed_link: 'https://b.example/rss' },
      { id: 2, title: 'Dormant Blog', folder_id: null, link: '', feed_link: 'https://d.example/rss' },
      { id: 3, title: 'Firehose', folder_id: null, link: '', feed_link: 'https://f.example/rss' },
      { id: 4, title: 'Loved', folder_id: null, link: '', feed_link: 'https://l.example/rss' },
      { id: 5, title: 'Brand New', folder_id: null, link: '', feed_link: 'https://n.example/rss' },
    ]
    window.__healthDays = []
    window.__filters = []
    api.feeds.list = function () { return Promise.resolve(feeds) }
    api.feeds.health = function (days) {
      window.__healthDays.push(days)
      return Promise.resolve(report.map(function (h) {
        return Object.assign({ arrived: 0, unread: 0, engaged: 0, opened: 0, starred: 0, saved: 0, last_arrived: null }, h, {
          last_arrived: h.lastDaysAgo == null ? null : new Date(now - h.lastDaysAgo * DAY).toISOString(),
        })
      }))
    }
    api.filters.list = function () { return Promise.resolve([]) }
    api.filters.create = function (f) { window.__filters.push(f); return Promise.resolve(Object.assign({ id: 77 }, f)) }
    api.settings.update = function () { return Promise.resolve() }
    vm.filters = []
    return vm.refreshFeeds()
  }, opts)
  await page.evaluate(() => vm.showSettings('settings'))
  return page.locator('.settings-group').filter({ has: page.locator('#set-feed-health') })
}

const REPORT = [
  { feed_id: 1, error: '404 Not Found', lastDaysAgo: 5 },
  { feed_id: 2, lastDaysAgo: 140 },
  { feed_id: 3, arrived: 41, unread: 0, lastDaysAgo: 0 },
  { feed_id: 4, arrived: 30, unread: 2, engaged: 6, opened: 6, lastDaysAgo: 0 },
  { feed_id: 5, lastDaysAgo: null },
]

test('feed health: groups broken, quiet and skipped feeds with one reason each', async ({ page }) => {
  const section = await open(page, { trackedDays: 30, report: REPORT })
  const groups = section.locator('.health-group')
  await expect(groups).toHaveCount(3)
  await expect(groups.nth(0)).toContainText('Broken 1')
  await expect(groups.nth(0)).toContainText('Broken Feed')
  await expect(groups.nth(0).locator('.health-reason')).toHaveText('404 Not Found')
  // quiet: never had an article sorts before a long-silent one
  await expect(groups.nth(1).locator('.health-feed')).toHaveText(['Brand New', 'Dormant Blog'])
  await expect(groups.nth(1).locator('.health-reason')).toHaveText(['Never had an article', 'Last new article 4 months ago'])
  await expect(groups.nth(2).locator('.health-row')).toHaveCount(1)
  await expect(groups.nth(2)).toContainText('Firehose')
  await expect(groups.nth(2).locator('.health-reason')).toHaveText('41 read, none opened')
  // the loved feed isn't listed anywhere
  await expect(section).not.toContainText('Loved')
  // only skipped feeds offer auto-read; every row offers unsubscribe
  await expect(section.getByRole('button', { name: /^Auto-read / })).toHaveCount(1)
  await expect(section.getByRole('button', { name: /^Unsubscribe from / })).toHaveCount(4)
})

test('feed health: skipped waits for two weeks of recorded opens', async ({ page }) => {
  const section = await open(page, { trackedDays: 3, report: REPORT })
  await expect(section).not.toContainText('Firehose')
  await expect(section).toContainText('Feeds you never open show here from')
  await expect(section.locator('.health-group')).toHaveCount(2)
})

test('feed health: auto-read adds a feed-wide rule and leaves the list', async ({ page }) => {
  const section = await open(page, { trackedDays: 30, report: REPORT })
  await section.getByRole('button', { name: 'Auto-read Firehose' }).click()
  expect(await page.evaluate(() => window.__filters)).toEqual([{ action: 'read', keyword: '', feed_id: 3, apply_now: true }])
  await expect(section).not.toContainText('Firehose')
  await expect(page.locator('.filter-row')).toContainText('Auto-read · everything · in Firehose')
})

test('feed health: the look-back window reloads the report', async ({ page }) => {
  const section = await open(page, { trackedDays: 30, report: REPORT })
  await expect(section.locator('.health-group')).toHaveCount(3)
  await section.getByRole('button', { name: '90 days' }).click()
  await expect(section.getByRole('button', { name: '90 days' })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => page.evaluate(() => window.__healthDays)).toEqual([60, 90])
})

test('feed health: nothing to report says so', async ({ page }) => {
  const section = await open(page, { trackedDays: 30, report: [{ feed_id: 4, arrived: 30, unread: 2, engaged: 6, lastDaysAgo: 0 }] })
  await expect(section).toContainText('Every feed is earning its place.')
})
