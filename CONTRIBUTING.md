# Contributing

This guide is the canonical source for how PRs get reviewed and merged
in this repository — for both human contributors and AI coding agents.

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
- Run the full suite with `make test` (uses `-race -count=1`).
- New behavior needs a test. New parsing edge cases especially — feed
  format quirks regress easily.

## Asking for help

Open a draft PR or an issue. Don't sit on a stuck branch.

## Releases

This is Scott's fork. Releases are tagged `vX.Ys` (the `s` suffix
denotes Scott's edition).
