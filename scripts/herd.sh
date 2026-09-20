#!/usr/bin/env bash
#
# Open one Claude terminal per open issue, on the skill that issue's type and
# status call for.
#
# This is the unattended path of the lifecycle in .claude/rules/github.md,
# driven from the outside: the three skills each take exactly one issue and deliberately
# refuse to scan the list, because "what gets worked on" is a human decision.
# This script *is* that decision, made once and in the open -- it reads every
# open issue, maps the pair (type, status) to the one skill whose entry
# conditions that pair satisfies, and starts an agent per match.
#
# There is no model in this loop. Every branch below is a label comparison or
# a timestamp comparison, so two runs against the same tracker state launch
# the same terminals. If it ever surprises you, `--dry-run` prints the whole
# decision table without touching Herdr.
#
# The route depends on two labels, not one: the *type* says whether the work
# has a plan stage at all, and the *status* says where on that route it is.
# Whoever files the issue picks the type, which is the point -- an agent that
# could set it could route itself around the only gate it has.
#
#   backlog  + bug|task  -> /implement <n>   no plan stage; filing it was the go
#   backlog  + feature   -> /plan <n>        needs a plan and an approval
#   backlog  + epic      -> /plan <n>        pass one: requirements + children
#   planning + feat|epic -> /plan <n>        ONLY if feedback postdates the plan
#   ready    + epic      -> /plan <n>        pass two: create the children
#   ready    + anything  -> /implement <n>   a human approved the plan
#   in-review            -> /review-pr <pr>  the open PR that closes it
#   in-progress          -> skip             an agent already claimed it
#   blocked              -> skip             waiting on a human decision
#
# `planning` is the subtle one. It means a plan is written and sitting at the
# human approval gate, which is not work an agent can advance -- except in the
# one case `/plan` names as re-planning, where a human has left feedback and
# somebody has to answer it. So a planning issue launches only when a comment
# is newer than the last edit to the body the plan lives in. Absent that, the
# issue is waiting on you and gets no terminal.
#
# An epic takes /plan twice, with the approval gate between: its children are
# live work the moment they exist -- a `task` child is launched straight at
# /implement by this script -- so they are not created until the epic itself
# reaches `ready`.
#
# Agents that write code are started *inside their own worktree*, not in the
# main checkout: `scripts/worktree.sh` makes it and the tab opens there. That
# used to be a block of bash in the skill file for the agent to copy, which
# made "did it work in the main checkout" a question about whether a model
# followed prose. If the worktree cannot be made, the agent is not started at
# all -- launching it in the main checkout is the outcome worth avoiding.
#
# Usage:
#   scripts/herd.sh [--dry-run] [--workspace <id>]
#
# Requires: gh (authenticated), jq, and a running Herdr server.

set -euo pipefail

# Native flags handed to each `claude`, after Herdr's own arguments.
#
# --strict-mcp-config is not optional. A fresh claude in a repo with a
# .mcp.json stops at "New MCP server found in this project: <name>" and
# waits, so `agent start` returns agent_not_ready and the prompt is never
# delivered. These agents want git, gh and npm, never an MCP server, so the
# fix and the right configuration are the same thing.
#
# bypassPermissions is what makes "unattended" true: /implement's merge gate
# is `npm run verify`, and an agent that has to ask before running bash has
# not been launched, it has been parked. The blast radius is bounded by the
# skills themselves -- none of the three merges, force-pushes, or files an
# issue, and each stops at its phase boundary.
CLAUDE_ARGS=(--strict-mcp-config --permission-mode bypassPermissions)

# The skills worktree themselves (`../<repo>-wt/<n>/`), so every agent starts
# in the main checkout and branches from there. Derived from this script
# rather than $PWD so the script works when run from anywhere.
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

# Inferred from the `origin` remote so a fresh clone of the template needs no
# edit; override with APP_REPO when running against a different one.
REPO="${APP_REPO:-$(cd "$ROOT" && gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null || true)}"

DRY_RUN=0
WORKSPACE=""

die() {
  echo "herd: $*" >&2
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --workspace) [ $# -ge 2 ] || die "--workspace needs an id"; WORKSPACE="$2"; shift 2 ;;
    -h|--help) awk 'NR>1 { if (!/^#/) exit; sub(/^# ?/, ""); print }' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) die "unknown argument '$1' (usage: herd.sh [--dry-run] [--workspace <id>])" ;;
  esac
done

for tool in gh jq herdr; do
  command -v "$tool" >/dev/null 2>&1 || die "$tool is not on PATH"
done

[ -x "$ROOT/scripts/worktree.sh" ] || die "scripts/worktree.sh is missing or not executable -- it is what keeps agents out of the main checkout"

[ -n "$REPO" ] || die "cannot determine the repo -- is gh authenticated, and does this checkout have an origin remote? (or set APP_REPO=owner/name)"

# Herdr's CLI reports server errors as JSON with an `.error` key, and does not
# reliably use a non-zero exit status to do it (`agent get <missing>` exits 0).
# So every call goes through here and the JSON is what decides.
herdr_api() {
  local out rc=0
  out=$("$@" 2>&1) || rc=$?
  local err
  err=$(jq -r '.error.message // empty' <<<"$out" 2>/dev/null || true)
  if [ -n "$err" ]; then
    echo "$err" >&2
    return 1
  fi
  [ "$rc" -eq 0 ] || { echo "$out" >&2; return 1; }
  printf '%s' "$out"
}

# One query for both halves of the mapping: the issues, and the open PRs whose
# `Closes #n` links tell an in-review issue which PR is its own. The links come
# from closingIssuesReferences -- what GitHub itself will close -- rather than
# a regex over the body, for the same reason `status.sh pr-issues` does.
fetch() {
  gh api graphql -f owner="${REPO%%/*}" -f repo="${REPO##*/}" -f query='
    query($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        issues(states: OPEN, first: 100) {
          nodes {
            number
            title
            body
            createdAt
            lastEditedAt
            labels(first: 20) { nodes { name } }
            comments(last: 1) { nodes { createdAt } }
          }
        }
        pullRequests(states: OPEN, first: 100) {
          nodes {
            number
            isDraft
            closingIssuesReferences(first: 5) { nodes { number } }
          }
        }
      }
    }'
}

# The whole decision, in one place, as data. Emits TSV:
#   <issue>  run|skip  <skill>  <arg>  <reason>  <title>
#
# Skip rows carry "-" for skill and arg rather than "". Tab is an IFS
# whitespace character, so bash's `read` folds a run of them into one
# separator and an empty middle field would silently shift every later field
# one to the left.
#
# ISO 8601 timestamps are all UTC and fixed-width here, so `>` on the strings
# is a correct chronological compare and needs no date parsing.
#
# "Has a plan" is the *closing* marker, `<!-- /plan -->`. The opening one
# carries a `planned=` timestamp (`<!-- plan planned=... -->`), so matching on
# `<!-- plan -->` finds nothing and every planned issue reads as unplanned.
DECIDE='
  .data.repository as $r
  | ([ $r.pullRequests.nodes[]
       | select(.isDraft | not) as $p
       | $p.closingIssuesReferences.nodes[]
       | { key: (.number | tostring), value: $p.number } ] | from_entries) as $prOf
  | $r.issues.nodes[]
  | . as $i
  | [ .labels.nodes[].name ] as $names
  | ($names | map(select(startswith("status:")))) as $labels
  | ($labels[0] // "" | ltrimstr("status:")) as $s
  | ($names | map(select(. == "bug" or . == "task" or . == "feature"))) as $types
  | (if ($names | any(. == "epic")) then "epic" else ($types[0] // "") end) as $t
  | (.body | test("<!-- /plan -->")) as $planned
  | (.lastEditedAt // .createdAt) as $bodyAt
  | (.comments.nodes[0].createdAt // "") as $commentAt
  | (if ($labels | length) == 0 then
       ["skip", "-", "-", "no status: label -- scripts/status.sh set \($i.number) backlog"]
     elif ($labels | length) > 1 then
       ["skip", "-", "-", "wears \($labels | join(" + ")) -- scripts/status.sh set \($i.number) <one>"]
     elif $t == "" then
       ["skip", "-", "-", "no type label -- add bug, task or feature"]
     elif ($t != "epic" and ($types | length) > 1) then
       ["skip", "-", "-", "wears \($types | join(" + ")) -- an issue has one type"]
     elif $s == "backlog" then
       (if $t == "bug" or $t == "task" then
          ["run", "implement", ($i.number | tostring), "\($t), no plan stage"]
        else
          ["run", "plan", ($i.number | tostring), "unplanned \($t)"]
        end)
     elif $s == "planning" then
       (if $t == "bug" or $t == "task" then
          ["skip", "-", "-", "a \($t) has no plan stage -- scripts/status.sh set \($i.number) backlog"]
        elif ($planned | not) then
          ["run", "plan", ($i.number | tostring), "status:planning with no plan in the body"]
        elif ($commentAt != "" and $commentAt > $bodyAt) then
          ["run", "plan", ($i.number | tostring), "feedback left since the plan"]
        else
          ["skip", "-", "-", "plan written, waiting on your approval"]
        end)
     elif $s == "ready" then
       (if $t == "epic" then
          ["run", "plan", ($i.number | tostring), "epic approved -- create its children"]
        else
          ["run", "implement", ($i.number | tostring), "plan approved"]
        end)
     elif $s == "in-review" then
       ($prOf[$i.number | tostring] as $pr
        | if $pr == null then
            ["skip", "-", "-", "status:in-review but no open non-draft PR closes it"]
          else
            ["run", "review-pr", ($pr | tostring), "PR #\($pr)"]
          end)
     elif $s == "in-progress" then
       ["skip", "-", "-", "an agent already has it"]
     elif $s == "blocked" then
       ["skip", "-", "-", "waiting on a human decision"]
     else
       ["skip", "-", "-", "status:\($s)"]
     end) as [$action, $skill, $arg, $reason]
  | [ ($i.number | tostring), $action, $skill, $arg, $reason, $i.title ] | @tsv
'

# Where the tabs land. The calling pane's workspace is the useful default --
# you run this from the workspace you are working the repo in.
if [ -z "$WORKSPACE" ]; then
  WORKSPACE="${HERDR_WORKSPACE_ID:-}"
fi
if [ -z "$WORKSPACE" ]; then
  WORKSPACE=$(herdr_api herdr workspace list | jq -r '.result.workspaces[0].workspace_id // empty') ||
    die "cannot reach the Herdr server -- is it running?"
  [ -n "$WORKSPACE" ] || die "no Herdr workspace to put tabs in"
fi

# Idempotence, so the script is safe to re-run as the tracker moves. Keyed on
# the tab rather than the agent: an agent's name is released the moment it
# exits, but the tab stays until you close it -- and a finished agent's output
# is exactly the thing you have not read yet. Closing the tab is what says
# "done with this one", and only then does a rerun open it again.
existing=$(herdr_api herdr tab list --workspace "$WORKSPACE" | jq -r '.result.tabs[].label // empty') ||
  die "cannot list tabs in workspace $WORKSPACE"

has_tab() {
  grep -q "^#$1 " <<<"$existing"
}

# Where the agent is started. /implement and /review-pr write code, commit
# and run the gate, so each gets a worktree of its own and never has the main
# checkout as its cwd. /plan only reads the tree -- what it writes goes to the
# issue through `gh` -- so it runs in the main checkout and leaves it alone.
workdir_for() {
  local skill="$1" arg="$2"
  case "$skill" in
    implement) "$ROOT/scripts/worktree.sh" issue "$arg" ;;
    review-pr) "$ROOT/scripts/worktree.sh" pr "$arg" ;;
    *) echo "$ROOT" ;;
  esac
}

launch() {
  local num="$1" skill="$2" arg="$3" cwd="$4" label pane out
  label="#$num $skill"

  out=$(herdr_api herdr tab create \
    --workspace "$WORKSPACE" --cwd "$cwd" --label "$label" --no-focus) ||
    { echo "  ! could not create a tab for #$num" >&2; return 1; }

  pane=$(jq -r '.result.root_pane.pane_id // empty' <<<"$out")
  [ -n "$pane" ] || { echo "  ! tab for #$num came back without a pane" >&2; return 1; }

  # Returns only once Herdr has detected Claude in that pane and considers it
  # ready for input, so the prompt below cannot race the agent's startup.
  herdr_api herdr agent start "issue-$num" --kind claude --pane "$pane" \
    -- "${CLAUDE_ARGS[@]}" >/dev/null ||
    { echo "  ! claude did not come up in $pane for #$num" >&2; return 1; }

  herdr_api herdr agent prompt "issue-$num" "/$skill $arg" >/dev/null ||
    { echo "  ! could not send /$skill $arg to #$num" >&2; return 1; }

  echo "  $label  ->  /$skill $arg  ($pane, $cwd)"
}

# Read the tracker before printing anything. Inside a process substitution a
# failing `gh` is invisible -- the loop reads nothing and the run cheerfully
# reports "0 would start", which is indistinguishable from an empty backlog.
plan=$(fetch | jq -r "$DECIDE") || die "could not read $REPO -- is gh authenticated?"

ran=0
failed=0
skipped=0
held=0

echo "herd: $REPO -> workspace $WORKSPACE"
if [ "$DRY_RUN" -eq 1 ]; then
  echo "      (dry run -- nothing will be started)"
fi
echo

while IFS=$'\t' read -r num action skill arg reason title; do
  [ -n "$num" ] || continue

  if [ "$action" = "skip" ]; then
    printf -- '- #%-4s %-46.46s  %s\n' "$num" "$title" "$reason"
    skipped=$((skipped + 1))
    continue
  fi

  if has_tab "$num"; then
    printf -- '- #%-4s %-46.46s  %s\n' "$num" "$title" "tab already open -- close it to rerun"
    held=$((held + 1))
    continue
  fi

  printf -- '+ #%-4s %-46.46s  /%s %s (%s)\n' "$num" "$title" "$skill" "$arg" "$reason"
  if [ "$DRY_RUN" -eq 1 ]; then
    ran=$((ran + 1))
    continue
  fi

  # No worktree, no agent. Falling back to the main checkout would be two
  # agents in one .next and a commit on whatever branch it happens to be on,
  # which is worse than this issue waiting for the next run.
  if ! cwd=$(workdir_for "$skill" "$arg"); then
    echo "  ! could not get a worktree for #$num -- not starting it in the main checkout" >&2
    failed=$((failed + 1))
    continue
  fi

  if launch "$num" "$skill" "$arg" "$cwd"; then
    ran=$((ran + 1))
  else
    # One issue failing to launch is not a reason to abandon the rest.
    failed=$((failed + 1))
  fi
done <<<"$plan"

echo
if [ "$DRY_RUN" -eq 1 ]; then
  echo "herd: $ran would start, $held already open, $skipped left alone"
else
  summary="herd: $ran started, $held already open, $skipped left alone"
  [ "$failed" -eq 0 ] || summary="$summary, $failed FAILED"
  echo "$summary"
  [ "$failed" -eq 0 ] || exit 1
fi
