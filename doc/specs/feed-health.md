# Shape: Feed health (prune what you never read)

> Design brief for feed health. Phase 1 (the signal) ships first, because the
> view is only as good as the history behind it; phases 2 and 3 follow.
> Anchored to PRODUCT.md: "get through a backlog of feeds fast, lose nothing
> worth keeping"; local-first, no telemetry; quiet, fast, utilitarian.

## 1. Feature summary
A Settings section that names the feeds costing you triage time for nothing:
feeds that are **broken** (fetch errors), **quiet** (nothing new in months), or
**skipped** (articles keep arriving, and you mark them read without opening any).
Each comes with the fix beside it: unsubscribe, mute with a Smart Filter, or
move. Everything is computed locally from your own triage; nothing leaves the
server.

## 2. Primary user action
Open Settings → Feed health, read down a short list of feeds with one plain
reason each ("41 arrived, none opened in 60 days"), and remove or mute the
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
  line, and the actions.
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
- **Skipped:** at least 10 arrived *and were decided* (no longer unread), and
  none were opened, starred or saved. Shows "41 arrived, none opened". Unread
  articles don't count against a feed: you haven't judged them yet.

A feed is listed once, in the first group it fits. Healthy feeds aren't listed;
an empty section says "Every feed is earning its place".

## 7. Actions (phase 2)
- **Unsubscribe:** the existing delete, with its undo.
- **Mute:** adds a Smart Filter `mute` rule for the feed, so nothing new
  reaches triage but the subscription stays (for feeds you want to keep for
  search, or revisit).
- **Open feed:** selects it in the list, to judge for yourself.

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
- Window: 60 days, a Settings-local choice of 30 / 60 / 90 in phase 2.
