# running yarr under outpost

yarr conforms to the Outpost service spec: it listens on one loopback
TCP port in plain HTTP, serves a cheap unauthenticated healthcheck at `GET /up`,
takes all of its configuration from flags and environment variables, keeps every
byte of persistent state in one directory, runs in the foreground, and exits on
SIGTERM within a second.

A ready-to-edit manifest lives in [`etc/outpost/yarr.toml`](../etc/outpost/yarr.toml).

## the port

yarr learns its port from, in order of precedence:

1. `--addr host:port` — a full address, when you need something other than
   loopback (a container, say)
2. `--port N` — binds `127.0.0.1:N`
3. `$OUTPOST_PORT` — binds `127.0.0.1:$OUTPOST_PORT`
4. `$YARR_ADDR`
5. `127.0.0.1:7070`

Passing both `--addr` and `--port` with different ports is an error rather than
a silent choice: listening on a port Outpost is not probing would get yarr
restarted forever. `--port 0` is rejected for the same reason — Outpost has to
know the port in advance, so yarr never picks one dynamically.

## storage

When `$OUTPOST_STORAGE_DIR` is set, the database is `$OUTPOST_STORAGE_DIR/yarr.db`
and SQLite's `-wal`/`-shm` companions sit beside it. That is the whole of yarr's
persistent state, so `outpost backup` and `outpost restore` capture everything.

`$OUTPOST_STORAGE_DIR` outranks `$YARR_DB` — a manifest cannot accidentally send
state somewhere that is not backed up. An explicit `--db` still wins, but yarr
logs a warning if it points outside the storage directory.

A restore replaces the directory wholesale. yarr caches nothing about it between
runs: it re-reads the schema version from the database on every start and
migrates forward if the restored copy is older.

## health

`GET /up` returns:

- `503 STARTING` while yarr is binding the port and doing its startup work
  (loading settings, starting the feed cleaner, kicking off the first refresh)
- `200 OK` once it can serve real traffic

It does no I/O and takes no locks, so it costs nothing to probe every 3 seconds,
and it answers in well under a millisecond. It deliberately does **not** ping
the database: a restart cannot fix a broken database, it only discards a working
process. `/up` is never auth-gated, even when `--auth` is set.

Under `--base`, the healthcheck moves with everything else -- `--base reader`
puts it at `/reader/up` -- so set `healthcheck` in the manifest to match, or
Outpost will probe a path that does not exist and restart yarr forever.

Database migrations run before the port is bound, so a first start against an
empty storage directory refuses connections for a moment before answering `503`.
That is what `start_grace_seconds` is for; the default 30s is ample for yarr's
migrations, but raise it if you are restoring a very large database.

## shutdown

SIGTERM (or SIGINT) makes yarr stop reporting healthy, drain in-flight HTTP
requests for up to 8 seconds, stop the auto-refresh ticker, and close the
database — which checkpoints the WAL — before exiting 0. That fits inside
Outpost's 10 second SIGKILL deadline with headroom.

Any unrecoverable startup failure — an unbindable port, an unreadable database,
a malformed `$OUTPOST_PORT` — exits non-zero, so Outpost's `on-failure` policy
restarts yarr with backoff instead of leaving it down.

## logging

yarr logs to stdout unbuffered, with no ANSI escapes, so `outpost logs yarr`
shows everything. Do not pass `--log-file` under Outpost: it redirects logs into
a file Outpost neither captures nor rotates. yarr warns if you do.

## secrets

A manifest is a plaintext file, and everything in its `env` table lands in the
process environment. yarr takes both of its secrets from a file instead, so the
manifest holds only a path:

| Secret | From a file | From the environment |
|---|---|---|
| Login credentials | `--auth-file` / `$YARR_AUTHFILE` | `--auth` / `$YARR_AUTH` |
| Session signing key | `--secret-key-file` / `$YARR_SECRET_KEY_FILE` | `$SECRET_KEY_BASE` |

The file wins when both are given. Keep the files inside the storage directory
so a backup carries them and a restore puts them back; an unreadable or empty
one is a startup failure rather than a silent fallback, because signing sessions
with an empty key is worse than not starting.

```toml
args = [
  "--port", "8090",
  "--auth-file", "/home/you/.outpost/data/yarr/auth",
  "--secret-key-file", "/home/you/.outpost/data/yarr/session.key",
]
```

## describing itself

Spec §9 is optional and forward-looking. yarr covers both halves.

`GET /v1/openapi.json` returns a hand-written OpenAPI 3.1 document covering the
`/api/*` JSON API, OPML import/export, the reader-view page crawl, and `/up`.
It is reachable without authentication -- it is a schema, not data -- so a
generator can fetch it from a supervised instance. It describes the handlers'
real behaviour, including the places where yarr answers 200 or 400 where you
would expect something else; a test walks every documented path through the
router so the document cannot drift without CI noticing. `info.version` carries
the running release, stamped at startup rather than written into the file.

`POST /mcp` serves the Model Context Protocol, documented in [mcp.md](mcp.md).
It authenticates with a bearer token rather than the session cookie, so an MCP
client can actually use it, and it sits in the auth middleware's public list for
that reason.

Two guards sit in front of it, both aimed at the browser:

- **Origin** is checked against `Host`, with loopback allowed. Non-browser MCP
  clients send no `Origin` and pass through untouched.
- **A browser must send a JSON content type.** Bearer auth is skipped entirely
  when no credentials are configured -- the default, and the usual tailnet
  posture -- so without this a page open on any other localhost port could POST
  a `text/plain` body and call `delete_folder` or `mark_all_read`. A port is not
  part of a "site", so the browser treats that as same-site, and `text/plain`
  makes it a CORS simple request with no preflight. Requiring JSON forces the
  preflight, which this endpoint answers with no CORS headers at all. Only
  requests carrying an `Origin` are held to it: CSRF needs a browser riding
  ambient authority, and a browser always sends `Origin` on a POST.

Running without `--auth` still leaves every MCP tool open to anything that can
reach the port, which is the same posture `/api/*` already has. On a tailnet
that is the intended boundary; anywhere else, set credentials.
