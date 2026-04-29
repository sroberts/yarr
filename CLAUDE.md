# CLAUDE.md

Guidance for AI coding agents working in this repository.

## Project summary

`yarr` is a self-hostable RSS/Atom feed aggregator written in Go. The
binary embeds a SQLite database, the web UI assets, and (optionally) a
system-tray GUI. This fork (`sroberts/yarr`) ships a Docker image
compatible with [Basecamp Once](https://github.com/basecamp/once) and
adds Instapaper integration plus the mobile triage swipe UI.

## Architecture

- `cmd/yarr/` — entry point. `serve` build tag runs the embedded
  HTTP server; `gui` build tag adds the systray.
- `src/server/` — HTTP handlers, routing, auth, OPML import/export,
  Fever API, sessions.
- `src/storage/` — SQLite schema, queries, migrations. SQLite-only.
- `src/parser/` — RSS, Atom, and JSON-feed parsers.
- `src/worker/` — feed-refresh scheduler.
- `src/content/` — sanitization and readability extraction.
- `src/assets/` — embedded HTML/CSS/JS for the web UI (vanilla JS, no
  bundler).
- `src/platform/` — OS-specific bits (Windows resources, etc.).
- `src/systray/` — tray-icon GUI (only built with `gui` tag).

The web UI lives in `src/assets/` and is shipped as embedded files
(`go:embed`). It is served by handlers in `src/server/`. There is no
JavaScript bundler — edit the `.js`/`.css` directly.

## Conventions

- Go 1.23. Build always uses tags `sqlite_foreign_keys sqlite_json`;
  `gui` adds the tray.
- Format with `gofmt` (default settings — no `goimports` reordering
  beyond stdlib/external split).
- Tests live next to source as `*_test.go`. Run `make test`.
- DB migrations are in `src/storage/sqlite.go`; bump the version array,
  don't rewrite history.
- Vendored deps under `vendor/` — keep `go mod vendor` synced when
  changing dependencies.
- This is Scott's fork. Tag releases as `vX.Ys` (the `s` suffix).
- All PRs target `sroberts/yarr`, **never** upstream `nkanaev/yarr`.

## Anti-patterns (do NOT)

- Do **not** introduce a JS framework, bundler, or transpiler. The UI
  is plain HTML/CSS/JS by design.
- Do **not** swap SQLite for another DB or add a second storage backend.
- Do **not** add network-side telemetry, analytics, or remote logging.
  yarr is a local-first tool.
- Do **not** rewrite tests when fixing a bug — the failing test is
  usually the spec. Get explicit approval before changing test code.
- Do **not** reformat unrelated lines. Keep diffs minimal.
- Do **not** add new top-level dependencies casually; the dependency
  surface is intentionally tiny (sqlite + golang.org/x/{net,sys,text}).

## Workflow

- `make test` runs the full test suite with race detection.
- `make host` builds the local binary into `out/yarr`.
- `make serve` runs the dev server with the `debug` build tag against
  `local.db`.
- Always run `gofmt`, `go vet`, and `make test` before saying a change
  is ready.

## Where to look

- Source: `src/`, `cmd/`
- Tests: `src/**/*_test.go`
- Docs: `readme.md`, `doc/`
- CI: `.github/workflows/`
- Build: `makefile`
