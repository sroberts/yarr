#!/usr/bin/env bash
# Spawn an isolated git worktree for a parallel AI agent run.
#
# Why: multiple agents working on the same checkout step on each
# other (lockfiles, build cache, transient files). Worktrees give
# each agent its own working directory, branch, and DB while
# sharing the .git object store.
#
# Usage:
#   scripts/agent-worktree.sh <task-slug> [base-branch]
#
# Creates:
#   ../yarr-worktrees/<task-slug>/   — checkout
#   branch:  agent/<task-slug>       — based on <base-branch> (default master)
#   .agent/local.db                  — fresh per-worktree dev DB
#
# Cleanup:
#   git worktree remove ../yarr-worktrees/<task-slug>
#   git branch -D agent/<task-slug>

set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "usage: $0 <task-slug> [base-branch]" >&2
  exit 64
fi

SLUG="$1"
BASE="${2:-master}"

# Slug sanity: lowercase, dashes, no path traversal.
if ! [[ "$SLUG" =~ ^[a-z0-9][a-z0-9-]{0,63}$ ]]; then
  echo "error: slug must match ^[a-z0-9][a-z0-9-]{0,63}$" >&2
  exit 64
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
PARENT_DIR="$(dirname "$REPO_ROOT")"
WORKTREE_DIR="$PARENT_DIR/yarr-worktrees/$SLUG"
BRANCH="agent/$SLUG"

mkdir -p "$PARENT_DIR/yarr-worktrees"

if [ -d "$WORKTREE_DIR" ]; then
  echo "error: $WORKTREE_DIR already exists" >&2
  exit 1
fi

git -C "$REPO_ROOT" fetch --quiet origin "$BASE" || true
git -C "$REPO_ROOT" worktree add -b "$BRANCH" "$WORKTREE_DIR" "$BASE"

mkdir -p "$WORKTREE_DIR/.agent"
echo "# per-worktree agent state, ignored by git" > "$WORKTREE_DIR/.agent/.gitignore"

cat <<EOF
[+] worktree:  $WORKTREE_DIR
[+] branch:    $BRANCH (from $BASE)
[+] dev db:    \$WORKTREE/.agent/local.db (created on first 'make serve')

next:
  cd $WORKTREE_DIR
  claude   # or your agent of choice

cleanup:
  git worktree remove $WORKTREE_DIR
  git branch -D $BRANCH
EOF
