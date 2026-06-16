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
- Land every change through a pull request to `master` — never push
  feature work straight to `master`.

## Releasing

- Cut a new release after every merged PR that ships a code change
  (skip docs-only or CI-only PRs).
- Steps: bump `VERSION` in `makefile` to the next `X.Y`, commit as
  `release: bump VERSION to X.Y for vX.Ys`, then push a matching
  annotated tag `vX.Ys` (the `s` suffix marks this fork).
- The tag push is what ships: `build.yml` builds the macOS/Windows/Linux
  artifacts and drafts a GitHub release, while `build-docker.yml` and
  `build-docker-once.yml` publish multi-arch images to
  `ghcr.io/sroberts/yarr`. A `workflow_dispatch` run is **not** a
  substitute — those jobs derive the version from the tag name.
- Claude Code web sessions cannot push tag refs (the git proxy only
  accepts branch pushes), so from web the release commit is pushed to
  `master` and the human pushes the `vX.Ys` tag (or drafts the release
  in the GitHub UI) to trigger the build.

## Where to look

- Source: `src/`, `cmd/`
- Tests: `src/**/*_test.go`
- Docs: `readme.md`, `doc/`
- CI: `.github/workflows/`
- Build: `makefile`

## Design Context

Frontend design work is anchored by `PRODUCT.md` at the repo root (strategic:
register, users, brand personality, anti-references, design principles). The
register is **product**; the personality is *quiet, fast, utilitarian*, and the
core loop is feed triage (read / star / save / next) on desk and phone. Read it
before changing the web UI in `src/assets/`. A `DESIGN.md` (visual tokens, the
light/sepia/night themes, typography, components) can be generated with
`/impeccable document` when needed.
