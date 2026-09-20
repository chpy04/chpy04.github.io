---
paths:
  - '.github/**'
  - 'scripts/status.sh'
  - 'scripts/herd.sh'
  - '.claude/skills/**'
---

# GitHub: issues, status, and PRs

**This is the unattended pipeline's rulebook, and nothing else reads it.**
It is the shared half of `/plan`, `/implement` and `/review-pr` — the
lifecycle those three move an issue through, plus the commands and the
conventions for the plumbing itself.

An ordinary session with a human in it does **none** of this. It follows
`CLAUDE.md`: branch, build, gate, commit, approval in conversation. Do not
file an issue, do not move a label, do not post a plan and wait. If you are
reading this because you opened a file under `.github/`, you want the
mechanics below, not the lifecycle.

## The type label decides the route

Two labels describe an issue. Its **type** — `bug`, `task`, `feature`, or
`epic` — says what kind of work it is and therefore which route it takes.
Its **status** says where on that route it currently is.

The type is applied by whoever files the issue: the three templates each
apply their own, and `epic` goes on by hand. **No agent chooses it and no
agent changes it**, because it is the decision that says whether the work
gets a plan and an approval step at all — an agent that could set it could
delete the only gate standing in front of itself.

| type      | plan stage | route                                                                       |
| --------- | ---------- | --------------------------------------------------------------------------- |
| `bug`     | no         | `backlog` → `/implement` → PR                                               |
| `task`    | no         | `backlog` → `/implement` → PR                                               |
| `feature` | yes        | `backlog` → `/plan` → `planning` → **human** → `ready` → `/implement` → PR  |
| `epic`    | yes, twice | `backlog` → `/plan` → `planning` → **human** → `ready` → `/plan` → children |

**Filing a bug or a task is the approval.** There is no second gate in front
of it, which is why `/implement` may take one straight out of
`status:backlog` and why it will not find a plan when it gets there. That is
the trade the label makes: work small enough that the approach is not worth
a round trip skips the round trip, and `/implement` does the deciding inline
and writes it into the PR body instead of into the issue.

A `feature` is the case where the approach _is_ worth a round trip, and its
gate is `planning → ready`. An `epic` is a decomposition rather than a piece
of work: `/plan` writes its requirements and the children it proposes,
a human approves that list, and only then — a second `/plan` — do the
children get created, each with its own type label and its own route.

What an agent may always do is **say the label is wrong**. `/implement`
blocks a `task` that turns out to be feature-sized and says it needs a plan;
`/plan` stops on a `bug` and says it does not. The relabel is the human's.

## The lifecycle, and where each skill stops

Task state is one `status:*` label on the issue — the only record there is.
Nothing in `docs/` tracks progress.

| label                | means                                                                   | set by    |
| -------------------- | ----------------------------------------------------------------------- | --------- |
| `status:backlog`     | filed and queued: a `bug`/`task` is ready to build, a `feature` to plan | automatic |
| `status:planning`    | an agent is writing the approach into a `feature` or `epic`             | agent     |
| `status:ready`       | the plan is approved; **no agent has it yet**                           | **human** |
| `status:in-progress` | an agent has claimed it and is working                                  | agent     |
| `status:in-review`   | PR is open and not a draft                                              | automatic |
| `status:blocked`     | an agent needs a decision only a human can make                         | agent     |
| `status:done`        | PR merged, issue closed                                                 | automatic |

| skill             | phase                             | ends at                           |
| ----------------- | --------------------------------- | --------------------------------- |
| `/plan <n>`       | plan a feature, decompose an epic | `status:planning`, for a human    |
| `/implement <n>`  | build it and open the PR          | a PR, never a merge               |
| `/review-pr <pr>` | answer review until mergeable     | green and answered, never a merge |

**The three never invoke each other**, and none of them can invoke itself —
each is `disable-model-invocation: true`, so a slash command is the only way
in. A phase boundary is a human decision, and three separate invocations is
what keeps it one. `scripts/herd.sh` is what starts them: it reads every
open issue and launches one agent per issue on the skill that issue's type
and status call for.

### planning → ready is a human gate

Only a `feature` or an `epic` ever reaches it — that is what those labels
buy, and it is the whole difference between them and a `task`.

No agent may decide its own plan is approved. You set `status:planning`,
write the plan into the issue, and **stop there**. A human swaps the label
for `status:ready`; that move is the approval, and it is what says code may
start.

`ready` and `in-progress` are deliberately separate, because "approved" and
"someone is on it" are different facts and the tracker is useless if it
cannot tell them apart. `ready` is a queue of blessed work waiting for an
agent — as, for a `bug` or a `task`, is `backlog`. Moving into
`in-progress` is how an agent **claims** an issue — do it before writing
code, so a second agent can see the work is taken.

So: `planning` waits on a human. `ready` waits on an agent. `in-progress`
means an agent already has it, including one reworking a PR after review.

### The skills are unattended, and do not ask

`herd.sh` opens a terminal per issue and nobody is reading it yet. A
question asked there is the run stopping, silently. So the skills decide
what they can decide and write the reasoning where a human will find it —
**Key decisions** in a plan, the PR body on unplanned work — and where they
genuinely cannot decide, `scripts/status.sh set <n> blocked` plus a comment
with the precise question. A blocked issue is information; a guess that got
merged is a bug; a prompt waiting in an unread pane is neither.

### One issue, one agent, one worktree, one branch

`scripts/worktree.sh` owns this, and `herd.sh` calls it **before** it starts
an agent, so a code-writing agent's cwd is its worktree from its first
command and the main checkout is never where it lands. If the worktree
cannot be made, the agent is not started — running it in the main checkout
is the outcome being avoided, not an acceptable fallback.

```bash
scripts/worktree.sh issue <n>    # /implement: a new branch off origin/main
scripts/worktree.sh pr <pr>      # /review-pr: the PR's own branch
scripts/worktree.sh assert       # fail unless $PWD is a linked worktree
```

`issue` and `pr` print the path and are idempotent, so a skill invoked by
hand can call the same command the herd did and get the same directory.
`assert` is what each skill runs before its first write, which is the half
that still matters when a human types `/implement 12` themselves.

Worktrees live at `../<repo>-wt/<n>/`, keyed by **issue** number even for
`/review-pr`, so review lands in the directory the branch was built in
rather than a second copy of it. Branch `feat/<n>-<slug>` for a `feature`,
`fix/` for a `bug`, `chore/` for a `task` — the script derives it from the
type label and the title. `node_modules` and `.env` are symlinked in from
the main checkout; don't run `npm install` in a worktree unless you mean to
replace that symlink.

**`/plan` is the exception, and runs in the main checkout.** It writes to
the issue through `gh`, never to a file, so a worktree would buy nothing —
which is exactly why it is also forbidden to build, run the gate, or edit
anything. Two `next build` processes in one checkout corrupt `.next`, and
the agent that pays for it is whichever one is working in a worktree off it.

## Exactly one label at a time

**An issue wears exactly one of the seven above.** `scripts/status.sh` is
what enforces that —
it adds the new label before stripping the old ones, because an issue briefly
wearing two is recoverable and an issue wearing none is invisible. Never add
or remove a `status:` label by hand or through `gh issue edit`; that is how an
issue ends up in two states at once.

Those names are load-bearing. `status.sh` validates against the list above and
fails loudly on anything else, because adding an unrecognised label through the
API would have GitHub silently create it in a random colour rather than fail.

## Setting it

```bash
scripts/status.sh set <issue-number> "In Progress"   # or: in-progress
scripts/status.sh get <issue-number>
scripts/status.sh pr-issues <pr-number>              # the issues a PR closes
scripts/status.sh init-labels                        # once per repo, at setup
```

```bash
scripts/status.sh type <issue-number>                # bug | task | feature | epic
```

It reads the repo from this checkout's `origin` remote, so a fresh clone
needs no edit; `APP_REPO=owner/name` overrides it. The seven status labels
must exist before `set` will work — `init-labels` creates them, plus the
four type labels and `feedback`, and is idempotent. `type` fails loudly on
an issue wearing none of them or more than one, because a routing decision
that is missing or ambiguous is not one an agent may resolve for itself.

`set` takes either dialect — `"In Progress"` as the lifecycle table above
writes it, or `in-progress` as the label spells it.

Agents set `planning` (starting to plan), `in-progress` (claiming work, and
on an epic whose children now exist) and `blocked`. Everything else is either automatic
(`.github/workflows/status.yml`) or the human's — `planning → ready` is the
approval gate, and an agent must never make that move itself. Claiming an
issue out of `ready` is fine and expected; promoting your own plan out of
`planning` is not.

## Why not a Projects board

Task status used to be a user-owned Projects v2 board (D-010). Two problems,
one fatal:

Projects v2 is reachable only from a classic PAT with `project` scope, because
fine-grained PATs expose Projects as an _organization_ permission and the board
was owned by a user account. A classic PAT cannot be restricted to one
repository, so "an agent credential that can only touch this repo" and "an
agent credential that can move the board" were mutually exclusive.

And it failed silently. `board.yml` read a `BOARD_TOKEN` secret that was never
set, and was written to no-op rather than fail when it was absent — so the
board sync was dead for the board's entire life without ever reddening a check.
Labels need only `issues: write`, which the default `GITHUB_TOKEN` already has,
so there is no longer a secret whose absence can quietly stop the lifecycle.

Labels also survive a migration to Linear or Jira, where a bespoke GitHub board
would not.

## Tokens

Agents working in this repo authenticate as a **fine-grained PAT restricted to
this repository**, supplied as `GH_TOKEN` through `.claude/settings.local.json`
(gitignored, project-scoped — it deliberately does not apply to any other
checkout). It needs, on this repository only:

| permission      | level | for                                             |
| --------------- | ----- | ----------------------------------------------- |
| Contents        | RW    | branches, the `feedback-assets` orphan branch   |
| Issues          | RW    | issues, comments, `status:*` labels, sub-issues |
| Pull requests   | RW    | opening PRs, review replies                     |
| Workflows       | RW    | editing anything under `.github/workflows/`     |
| Actions         | RW    | reading CI results, re-running failed jobs      |
| Commit statuses | Read  | the gate's verdict on a PR                      |

No account-level permission is needed, and **no `project` scope** — that
requirement died with the board. The same token can serve the app's
`GITHUB_TOKEN` for the feedback widget, which needs only Contents and Issues.

CI needs no secret at all: `status.yml` runs on the default `GITHUB_TOKEN`.

## Agents do not file issues unprompted

An issue is a human-requested behaviour, and only a human decides one exists.
Two things count as that decision: the human asking outright ("make a separate
issue for this"), and an `epic` a human has already approved, whose children
`/plan` then creates as sub-issues. Nothing else — a bug you tripped over, a
refactor that suggests itself, a follow-up the PR made obvious — goes in your
reply or as a comment on the issue you are already working.

A new request arriving mid-task is **scope creep onto the current issue**, and
that is the normal case rather than a problem. Extend the issue and update its
plan; do not split the work on your own initiative.

## Issue templates

`.github/ISSUE_TEMPLATE/*.yml` — `bug`, `task`, `feature`. Each applies its
own label, and that label is the routing decision above, so picking the
template is how the filer says whether the work gets a plan stage. The
`epic` label is separate and applied by hand; it is never inferred.

Choosing between them is a human judgement and belongs in the template
descriptions, not in an agent: a `task` is work whose approach is obvious
and local, a `feature` is work where a human might say "no, do it the other
way".

The in-app feedback widget files issues through the REST API
(`lib/feedback/issue.ts`), which **bypasses templates entirely** — so it
applies the type label itself, `bug` or `feature`, and a feature filed from
the widget takes the planning route like any other. Keep the `bug`
template's fields aligned with the body that widget generates, or the
tracker ends up with two dialects of bug report.

## PRs

- `Closes #<n>` in the body, not the title. GitHub parses it into a real link,
  and `status.sh pr-issues` reads that link rather than regexing the body — so
  what changes the status is exactly what GitHub will close.
- One issue per PR. A PR that closes three issues is three tasks wearing a
  trench coat, and each of them loses the ability to say where it is.
- Draft means "not ready": `status.yml` leaves a draft PR's issue alone.

## Workflow conventions

The existing workflows are one job each, named for the gate step they run
(`format`, `lint`, `typecheck`, `test`, `build`, `smoke`, `e2e`), sharing
`.github/actions/setup-node-deps` so the Node version lives in one place
(D-009). `status.yml` is the exception that does not run the gate at all;
keep it that way, and keep CI concerns out of it.
