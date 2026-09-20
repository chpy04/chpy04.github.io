#!/usr/bin/env bash
#
# Create or reuse the worktree an unattended agent works in, and refuse to
# let one work in the main checkout.
#
# The rule this enforces is in .claude/rules/github.md: one issue, one agent,
# one worktree, one branch. It used to live only in the skill files, as a
# block of bash an agent was asked to copy -- which meant "did this agent
# work in the main checkout" was answered by whether a model followed prose,
# and the failure is silent until two agents have corrupted each other's
# .next or committed onto the same branch.
#
# So `herd.sh` calls this before it launches anything and starts the agent
# *inside* the worktree, and the skills call `assert` before their first
# write. Same logic in one place, no model in the loop.
#
# Worktrees live at ../<repo>-wt/<key>/, outside the repo and never
# committed. `node_modules` and `.env` are symlinked from the main checkout:
# the gate's integration tests need DATABASE_URL and silently skip 16 suites
# without it, and a real npm install per worktree would cost minutes and
# gigabytes to produce the same tree.
#
# Usage:
#   scripts/worktree.sh issue <issue-number>   # for /implement: a new branch off origin/main
#   scripts/worktree.sh pr <pr-number>         # for /review-pr: the PR's own branch
#   scripts/worktree.sh path <issue-number>    # where it would go; creates nothing
#   scripts/worktree.sh assert                 # fail unless $PWD is a linked worktree
#
# `issue` and `pr` print the path and are idempotent -- a second call on a
# worktree that already exists prints it and changes nothing, so a rerun
# after an agent died is safe.

set -euo pipefail

die() {
  echo "worktree: $*" >&2
  exit 1
}

command -v git >/dev/null 2>&1 || die "git is not on PATH"

# The *main* checkout, even when this script is run from inside a linked
# worktree. --git-common-dir points at the one real .git directory that every
# worktree shares; --show-toplevel would give whichever worktree we are in.
git rev-parse --git-common-dir >/dev/null 2>&1 || die "not inside a git repository"
MAIN=$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")
# Normalised rather than "$MAIN/../..." so the path an agent is handed, and
# the one that shows up in `git worktree list`, are the same string.
WT_BASE="$(cd "$MAIN/.." && pwd)/$(basename "$MAIN")-wt"

# A branch name the convention in .claude/rules/github.md would produce:
# the type label picks the prefix, the title becomes the slug.
branch_for() {
  local issue="$1" type prefix title slug
  type=$("$MAIN/scripts/status.sh" type "$issue") ||
    die "#$issue has no usable type label, so there is no branch prefix for it"

  case "$type" in
    bug) prefix=fix ;;
    task) prefix=chore ;;
    feature | epic) prefix=feat ;;
    *) die "unknown type '$type'" ;;
  esac

  title=$(gh issue view "$issue" --json title --jq .title) ||
    die "cannot read the title of #$issue"

  # Lowercase, non-alphanumerics to single dashes, trimmed, and short enough
  # that the branch name stays readable in `git branch`.
  slug=$(printf '%s' "$title" |
    tr '[:upper:]' '[:lower:]' |
    sed -e 's/[^a-z0-9]\{1,\}/-/g' -e 's/^-//' -e 's/-$//' |
    cut -c1-40 |
    sed -e 's/-$//')
  [ -n "$slug" ] || slug="issue"

  echo "$prefix/$issue-$slug"
}

# Symlinked rather than installed: see the header. -n on the second so a
# rerun replaces the link instead of dropping one inside the directory it
# points at.
link_deps() {
  local wt="$1"
  [ -e "$wt/node_modules" ] || ln -s "$MAIN/node_modules" "$wt/node_modules"
  [ -e "$MAIN/.env" ] && ln -sfn "$MAIN/.env" "$wt/.env"
  return 0
}

# Create at $wt on $branch, or print it and do nothing if it is already
# there. `git worktree add` refuses a branch that is already checked out
# somewhere, which is the collision we want to hear about rather than paper
# over -- two agents on one branch is the thing this whole file prevents.
ensure() {
  local wt="$1" branch="$2" base="${3:-}"

  # A worktree whose directory was deleted by hand is still in git's list and
  # will block `add` on the same path.
  git -C "$MAIN" worktree prune

  if [ -d "$wt" ]; then
    git -C "$MAIN" worktree list --porcelain | grep -qxF "worktree $wt" ||
      die "$wt exists but is not a registered worktree -- move it aside"
    link_deps "$wt"
    echo "$wt"
    return
  fi

  mkdir -p "$(dirname "$wt")"
  git -C "$MAIN" fetch --quiet origin

  if git -C "$MAIN" show-ref --verify --quiet "refs/heads/$branch"; then
    git -C "$MAIN" worktree add --quiet "$wt" "$branch" >&2
  elif [ -n "$base" ]; then
    git -C "$MAIN" worktree add --quiet "$wt" -b "$branch" "$base" >&2
  else
    die "no local branch '$branch' and no base to create it from"
  fi

  link_deps "$wt"
  echo "$wt"
}

for_issue() {
  local issue="$1" branch
  branch=$(branch_for "$issue")
  # origin/main, never local main, which may be behind.
  ensure "$WT_BASE/$issue" "$branch" "origin/main"
}

for_pr() {
  local pr="$1" branch issue key
  command -v gh >/dev/null 2>&1 || die "gh is not on PATH"

  branch=$(gh pr view "$pr" --json headRefName --jq .headRefName) ||
    die "cannot read PR #$pr"
  [ -n "$branch" ] || die "PR #$pr has no head branch"

  # Keyed on the issue, not the PR, so /review-pr lands in the same directory
  # /implement already built the branch in rather than cloning a second copy
  # of it next door.
  issue=$("$MAIN/scripts/status.sh" pr-issues "$pr" 2>/dev/null | head -1 || true)
  key="${issue:-pr-$pr}"

  git -C "$MAIN" fetch --quiet origin
  ensure "$WT_BASE/$key" "$branch" "origin/$branch"
}

# The check a skill runs before its first write. In the main checkout the
# per-worktree git dir and the shared one are the same path; in a linked
# worktree the first is .git/worktrees/<name> and the second is the main
# .git, so comparing them needs no knowledge of where either lives.
assert_worktree() {
  local here common
  here=$(git rev-parse --path-format=absolute --absolute-git-dir)
  common=$(git rev-parse --path-format=absolute --git-common-dir)

  if [ "$here" = "$common" ]; then
    die "this is the main checkout ($MAIN), not a worktree.
  Two agents building in one checkout corrupt .next, and a commit here can
  land on whatever branch the checkout happens to be on. Get a worktree:
      cd \"\$(scripts/worktree.sh issue <n>)\"     # /implement
      cd \"\$(scripts/worktree.sh pr <pr>)\"       # /review-pr"
  fi

  echo "worktree: $(git rev-parse --show-toplevel) on $(git rev-parse --abbrev-ref HEAD)"
}

case "${1:-}" in
  issue) [ $# -eq 2 ] || die "usage: worktree.sh issue <issue-number>"; for_issue "$2" ;;
  pr) [ $# -eq 2 ] || die "usage: worktree.sh pr <pr-number>"; for_pr "$2" ;;
  path) [ $# -eq 2 ] || die "usage: worktree.sh path <issue-number>"; echo "$WT_BASE/$2" ;;
  assert) [ $# -eq 1 ] || die "usage: worktree.sh assert"; assert_worktree ;;
  *) die "usage: worktree.sh issue <issue-number> | pr <pr-number> | path <issue-number> | assert" ;;
esac
