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

## what yarr does not do

`/mcp` and `/v1/openapi.json` (spec §9) are not implemented. They are optional
and forward-looking, and nothing in Outpost consumes them today.
