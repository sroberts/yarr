# Contributing

This guide is the canonical source for how PRs get reviewed and merged
in this repository — for both human contributors and AI coding agents.

## Getting set up

You need Go 1.23 and, for the end-to-end tests, Node.js.

```sh
git clone https://github.com/sroberts/yarr.git && cd yarr
make serve     # dev server with the `debug` tag, against ./local.db
make host      # build the local binary into out/yarr
```

The web UI lives in `src/assets/` as plain HTML/CSS/JS and is embedded in
the binary, so rebuild after editing it.

## Workflow

1. Branch from `master`: `git checkout -b <type>/<short-name>`
   (e.g. `fix/triage-swipe-direction`, `feat/instapaper-folder`).
2. Keep PRs focused — one logical change per PR. If you find unrelated
   bugs, open separate PRs.
3. Run `make test` and `gofmt -w .` locally before opening the PR.
4. Open the PR against `sroberts/yarr` `master`. The PR template
   provides the per-merge checklist.

## What gets a PR rejected

- **Tests changed without a tracked reason.** The failing test is
  usually the spec; rewriting it instead of fixing the code masks
  regressions.
- **Adds a JS framework, bundler, or transpiler.** The web UI is
  intentionally plain HTML/CSS/JS.
- **Swaps or adds a storage backend.** yarr is SQLite-only by design.
- **Network telemetry / phone-home logic.** This is a local-first
  tool; do not add remote analytics.
- **Unrelated reformatting churn.** Don't reformat files you didn't
  functionally change.
- **Vendor drift.** If you bumped a dep but forgot `go mod vendor`,
  the build will fail downstream.
- **Missing build tags.** Builds use
  `-tags "sqlite_foreign_keys sqlite_json"`. The `gui` tag adds the
  systray. Don't put `gui`-only code in non-`gui` files.

## Style

- Format with `gofmt` (default settings).
- Run `go vet` before pushing.
- Comments explain WHY, not WHAT. Don't write doc comments that just
  restate the function name.
- Keep diffs minimal — no opportunistic refactors in a bug-fix PR.

## Tests

- Tests live next to source as `*_test.go`.
- Run the full suite with `make test`. CI runs it with `-race -count=1`
  (see `.github/workflows/test.yml`); add those flags locally to match.
- UI changes: run the Playwright suite with
  `cd test/e2e && npm ci && npx playwright test`.
- New behavior needs a test. New parsing edge cases especially — feed
  format quirks regress easily.

## Reporting bugs and asking for help

- Bugs and feature ideas: [open an issue](https://github.com/sroberts/yarr/issues/new/choose)
  with the bug report or feature request form.
- Security problems: see [SECURITY.md](SECURITY.md). Please don't file
  them publicly.
- Stuck on a change? Open a draft PR or an issue. Don't sit on a stuck branch.

## Releases

This is Scott's fork. Releases are tagged `vX.Ys` (the `s` suffix
denotes Scott's edition), and one is cut after every merged PR that ships
a code change (docs-only and CI-only PRs don't need one).

To cut a release:

1. Open a PR that bumps `VERSION` in `makefile` to the next `X.Y`, with
   the commit message `release: bump VERSION to X.Y for vX.Ys`.
2. Merge it. On the push to `master`, `.github/workflows/release.yml`
   creates the `vX.Ys` tag and release, and dispatches the macOS, Windows,
   Linux and Docker builds, which attach their artifacts.
3. If that needs re-running, push the `release` branch or run the Release
   workflow from the Actions tab; the job is idempotent.
