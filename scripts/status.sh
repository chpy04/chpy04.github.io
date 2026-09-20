#!/usr/bin/env bash
#
# Set an issue's lifecycle status, and find the issues a PR closes.
#
# Status lives in a `status:*` label on the issue itself. One implementation,
# used from two places: agents run it by hand for the transitions only they
# know about (-> planning, -> in-progress, -> blocked), and
# .github/workflows/status.yml runs it for the ones inferable from git
# events. Keeping it in one file is why the status can never disagree with
# itself.
#
# Labels, not a Projects v2 board, because a board is unreachable from a
# repo-scoped credential: Projects exists only as an *organization* permission
# on a fine-grained PAT, so a user-owned board needs a classic PAT with
# `project` scope -- which cannot be restricted to one repository. A label is
# an ordinary `Issues: write`, so CI's default GITHUB_TOKEN is enough and
# there is no secret to rotate or forget. Labels also survive a migration to
# Linear or Jira, where a bespoke GitHub board would not.
#
# SETUP: the seven labels must exist in the repo before this works. Run
# `scripts/status.sh init-labels` once.
#
# Usage:
#   scripts/status.sh set <issue-number> <status>
#   scripts/status.sh get <issue-number>
#   scripts/status.sh pr-issues <pr-number>
#   scripts/status.sh init-labels
#
# <status> is accepted in either dialect -- "In Progress" as the lifecycle
# table in CLAUDE.md writes it, or `in-progress` as the label spells it.

set -euo pipefail

PREFIX="status:"

# The repo this checkout points at. Inferred from the `origin` remote so a
# fresh clone of the template needs no edit; override with APP_REPO when
# running against a different one.
REPO="${APP_REPO:-$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null || true)}"

# The seven the lifecycle defines. Load-bearing: an unknown status is a typo,
# and adding an unknown label via the API would have GitHub silently create it
# in a random colour rather than fail.
STATUSES=(backlog planning ready in-progress in-review blocked done)

# Colours are cosmetic but the ordering they imply is not: cold for waiting,
# warm for active, red for stuck, green for finished.
declare -a LABEL_COLORS=(
  "backlog:ededed"
  "planning:c5def5"
  "ready:0e8a16"
  "in-progress:fbca04"
  "in-review:5319e7"
  "blocked:d93f0b"
  "done:6f42c1"
)

die() {
  echo "status: $*" >&2
  exit 1
}

[ -n "$REPO" ] || die "cannot determine the repo -- is gh authenticated, and does this checkout have an origin remote? (or set APP_REPO=owner/name)"

# "In Progress" / "in progress" / "in-progress" all mean status:in-progress.
normalise() {
  local s
  s=$(tr '[:upper:]' '[:lower:]' <<<"$1" | tr ' _' '-')
  s=${s#"$PREFIX"}
  for known in "${STATUSES[@]}"; do
    [ "$s" = "$known" ] && { echo "$PREFIX$s"; return; }
  done
  die "no status named '$1' (one of: ${STATUSES[*]})"
}

# The label set on an issue, filtered to ours.
current() {
  gh api "repos/$REPO/issues/$1/labels" --jq ".[].name | select(startswith(\"$PREFIX\"))"
}

# Exactly one status label at a time. Removing the old ones before adding the
# new one would leave the issue statusless if the add then failed, so the new
# label goes on first -- a moment wearing two is recoverable, wearing none is
# invisible.
set_status() {
  local issue="$1" want
  want=$(normalise "$2")

  gh api "repos/$REPO/labels/$want" >/dev/null 2>&1 ||
    die "the label '$want' does not exist in $REPO -- run 'scripts/status.sh init-labels' rather than letting the API invent one"

  gh api "repos/$REPO/issues/$issue/labels" -f "labels[]=$want" >/dev/null ||
    die "issue #$issue not found in $REPO"

  local stale
  stale=$(current "$issue" | grep -vFx "$want" || true)
  for label in $stale; do
    gh api -X DELETE "repos/$REPO/issues/$issue/labels/$label" >/dev/null
  done

  echo "status: #$issue -> $want"
}

get_status() {
  local found
  found=$(current "$1")
  [ -n "$found" ] || die "#$1 has no $PREFIX label"
  echo "$found"
}

# Idempotent: creates the seven status labels plus `feedback` and `epic`.
# Run once per repo. Everything else here refuses to invent a label.
init_labels() {
  local created=0
  for entry in "${LABEL_COLORS[@]}"; do
    local name="$PREFIX${entry%%:*}" color="${entry##*:}"
    if gh api "repos/$REPO/labels/$name" >/dev/null 2>&1; then
      echo "  exists  $name"
    else
      gh api "repos/$REPO/labels" -f name="$name" -f color="$color" >/dev/null
      echo "  created $name"
      created=$((created + 1))
    fi
  done

  # `feedback` marks an issue the in-app widget filed; `epic` is applied by
  # hand and is what routes an issue down /triage's epic track.
  for entry in "feedback:1d76db" "epic:b60205"; do
    local name="${entry%%:*}" color="${entry##*:}"
    if gh api "repos/$REPO/labels/$name" >/dev/null 2>&1; then
      echo "  exists  $name"
    else
      gh api "repos/$REPO/labels" -f name="$name" -f color="$color" >/dev/null
      echo "  created $name"
      created=$((created + 1))
    fi
  done

  echo "status: $created label(s) created in $REPO"
}

# The issues a PR closes, via the `Closes #n` links GitHub itself parses --
# not a regex over the body, so it agrees with what GitHub will actually close.
pr_issues() {
  gh api graphql -f owner="${REPO%%/*}" -f repo="${REPO##*/}" -F pr="$1" -f query='
    query($owner: String!, $repo: String!, $pr: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $pr) {
          closingIssuesReferences(first: 20) { nodes { number } }
        }
      }
    }' --jq '.data.repository.pullRequest.closingIssuesReferences.nodes[].number'
}

case "${1:-}" in
  set) [ $# -eq 3 ] || die "usage: status.sh set <issue-number> <status>"; set_status "$2" "$3" ;;
  get) [ $# -eq 2 ] || die "usage: status.sh get <issue-number>"; get_status "$2" ;;
  pr-issues) [ $# -eq 2 ] || die "usage: status.sh pr-issues <pr-number>"; pr_issues "$2" ;;
  init-labels) [ $# -eq 1 ] || die "usage: status.sh init-labels"; init_labels ;;
  *) die "usage: status.sh set <issue-number> <status> | get <issue-number> | pr-issues <pr-number> | init-labels" ;;
esac
