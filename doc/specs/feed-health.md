# Shape: Feed health (prune what you never read)

> Design brief for feed health. Phase 1 (the signal) ships first, because the
> view is only as good as the history behind it; phases 2 and 3 follow.
> Anchored to PRODUCT.md: "get through a backlog of feeds fast, lose nothing
> worth keeping"; local-first, no telemetry; quiet, fast, utilitarian.

## 1. Feature summary
A Settings section that names the feeds costing you triage time for nothing:
feeds that are **broken** (fetch errors), **quiet** (nothing new in months), or
**skipped** (articles keep arriving, and you mark them read without opening any).
Each comes with the fix beside it: unsubscribe, or keep it but auto-read
everything it brings. Everything is computed locally from your own triage; nothing leaves the
server.

## 2. Primary user action
Open Settings → Feed health, read down a short list of feeds with one plain
reason each ("41 read, none opened"), and unsubscribe from or auto-read the
noise in one click per feed.

## 3. Design direction
- **Register:** product, Operate. A maintenance list, not a dashboard: no
  charts, scores, gauges or hero numbers. The reason is a sentence.
- **Color:** none beyond the system. Broken uses `--status-error` text with its
  word ("Broken"), never colour alone. No red badges in the sidebar.
- **Tone:** plain and terse. It reports; it never nags. Nothing appears outside
  Settings: no toasts, no counts, no "you have 6 unhealthy feeds".

## 4. Scope
- **Phase 1, the signal (this PR).** Record when an article is opened on
  purpose (`items.date_opened`), and serve each feed's record over a window
  (`GET /api/feeds/health?days=60`). No UI.
- **Phase 2, the view.** Settings → Feed health: the three groups, the reason
  line, and the actions. Recording began with phase 1, so the server never
  counts articles from before it (`feed_health_since`, migration `m14`), and
  the view holds Skipped back until two weeks of opens are on file.
- **Phase 3, MCP.** A `feed_health` tool, so Claude Code or Desktop can prune
  conversationally ("which feeds do I never read?"), with unsubscribe going
  through the existing management tools.

## 5. What counts as opened
Desk triage opens every article that `j`/`k` pass, and opening marks it read,
so neither selection nor read status tells skimming from reading. An article
counts as opened when:
- it stays open in the reader for 8 seconds in a visible tab, or
- the reader acts on it: `o` / the Open link, or reader view (`i`), or
- on a triage card, it is read in place (tap / Enter) or opened at its source.

Starred and Instapaper-saved articles count as engaged on their own. Each
article is reported once per session and only the first time is stored.
Reports are best effort: a missed one offline is not worth queueing.

## 6. The groups (phase 2)
Over the window (60 days by default; at most 90, the retention limit):
- **Broken:** the feed has a current fetch error. Shows the error.
- **Quiet:** nothing has arrived in 90 days (or ever). Shows "Last new article
  4 months ago" or "Never had an article".
- **Skipped:** at least 10 arrived *and were read* (no longer unread), and
  none were opened, starred or saved. Shows "41 read, none opened". Unread
  articles don't count against a feed: you haven't judged them yet. Feeds a
  feed-wide rule already auto-reads aren't listed: you've decided.

A feed is listed once, in the first group it fits. Healthy feeds aren't listed;
an empty section says "Every feed is earning its place".

## 7. Actions (phase 2)
- **Unsubscribe:** the existing delete, with its undo.
- **Auto-read** (Skipped only): adds a Smart Filter `read` rule for the feed
  with no keyword, which covers everything from that feed, and applies it to
  the current backlog. The subscription stays and its articles still arrive
  in All and in search; they just never reach Unread. The rule shows under
  Filters as "Auto-read · everything · in Firehose", and removing it undoes
  this. (Mute was the first idea, but dropping articles at ingest is
  unsubscribing with extra steps.)
- **The feed's name** closes Settings onto the feed, to judge for yourself.
- A rule with no keyword is accepted only with a feed; unscoped it would
  cover everything, so the API refuses it and matching ignores it.

## 8. Technical notes
- **Storage:** migration `m13` adds `items.date_opened` (nullable datetime).
  `Storage.MarkItemOpened` sets it once; `Storage.FeedHealth(days)` aggregates
  per feed in one query (arrived, unread, engaged, opened, starred, saved,
  newest arrival) and joins in the fetch errors.
- **API:** `PUT /api/items/:id {"opened": true}` reuses the update the client
  already makes; `GET /api/feeds/health` is documented in `openapi.json`.
- **Retention:** items older than 90 days are pruned past each feed's newest
  50, so the window is capped at 90. Quiet uses the newest arrival at any age.
- **Fever and MCP reads don't count as opens.** Only the web UI reports them;
  an outside client's reading habits are its own.

## Anti-goals
- No engagement scores, streaks or per-feed charts.
- No automatic unsubscribing or muting. The view suggests; you decide.
- No reading analytics beyond what pruning needs: one timestamp per article,
  pruned with the article.

## Open questions (defaults asserted)
- Skipped threshold: 10 decided articles, none engaged. Tunable later if real
  data says otherwise.
- Window: 60 days by default, with 30 / 60 / 90 in the view ("Look back").
  Not saved: it's a question you ask, not a preference.
