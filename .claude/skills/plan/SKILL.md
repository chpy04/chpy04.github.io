---
name: plan
description: Plan one feature, decompose one epic, or re-plan one whose plan got feedback. Invoked by hand as `/plan <issue-number>` for work running without a human in the loop; it takes exactly one issue number and never scans the issue list. Only `feature` and `epic` issues have a plan stage — a `bug` or a `task` goes straight to `/implement`. Never writes code, and never invokes another skill.
disable-model-invocation: true
---

# Plan an issue

You have been pointed at **one** issue that a human labelled `feature` or
`epic`. Write the approach into it at the depth that label calls for, leave
it at the approval gate, and stop.

This is the first of the three **unattended** phases; `/implement` and
`/review-pr` are the other two. **Never invoke them** — a human decides when
a phase begins, and that is the point of having three separate skills. This
one exists to make an agent stop where a human would otherwise have
interrupted it.

**Nobody is watching you run.** You were almost certainly started by
`scripts/herd.sh` into a terminal that no one is reading yet, and a question
you ask there is not a question — it is the run stopping, silently, until
somebody notices. So do not ask any. Everything you would want to ask has a
written home instead: a call you can make goes in **Key decisions**, where
the approval gate is the human answering it, and a call you genuinely cannot
make goes in `status:blocked` with the question in a comment (§9). Both of
those leave a record on the issue. A prompt waiting in a pane leaves nothing.

Everything this skill leans on that is not written here — the seven
`status:*` labels, the type labels and the route each one takes, the
`planning → ready` human gate, `scripts/status.sh`, the worktree and branch
convention, the PR conventions — is in `.claude/rules/github.md`. Read it
first.

You are here because something typed `/plan <n>`. That is the only way in: this
skill is `disable-model-invocation: true` and never fires on its own, on a
task that merely resembles its description, or at another skill's request.
**An ordinary session with a human in it does none of this** — it follows
`CLAUDE.md` and takes approval in conversation. If that is your situation,
you should not be reading this.

## Hard limits

- **Never write code.** Not in the plan, not in a scratch file. You are
  deciding things a human would want to overrule — architecture, structure,
  the shape of the data. A code block in a plan is you deciding something
  that was never yours to decide, and it is what `/implement` is for.
- **Never ask a question.** There is no one in the pane to answer it.
  Decide, write the decision down where the human will read it, and let them
  overrule it at the gate — or block (§9) if it is not yours to decide.
- **Exactly one issue, and it is given to you.** `/plan <issue-number>` takes the number as its argument. If you were invoked without one, say so and stop — never list, search or scan to pick one yourself, and never work more than one in a single invocation. Choosing what to work on is the human's job, and an agent that goes looking will find work nobody queued.
- **You plan features and epics, and nothing else.** A `bug` or a `task`
  has **no plan stage** — the human decided that when they chose the label,
  and `/implement` takes one straight out of `status:backlog`. If you were
  pointed at one, say so and stop. If you think it was mislabelled, say
  that too; relabelling it is the human's move, not yours.
- **Never file an issue unprompted.** The single exception is an approved
  epic's children (§4), which are sub-issues of a decomposition a human has
  already signed off. Absent that, no — if you notice other work worth
  doing, say so in your reply. A new request that arrives mid-task is scope
  creep onto _this_ issue, and the plan gets updated rather than split.
- **Never set `status:ready`.** `planning → ready` is the human approval
  gate (`.claude/rules/github.md`), and it is the only gate in front of a
  feature. You write the plan and stop; a human moves the label.
- **Never change a type label.** The type is the routing decision — whether
  this work gets planned at all — and it belongs to whoever filed the issue.
- **You are read-only on the working tree.** Unlike `/implement` and
  `/review-pr`, you run in the **main checkout** — there is no worktree,
  because what you produce goes to the issue through `gh`, not to a file.
  So: edit nothing, create nothing, and **never run a build or the gate**.
  A `next build` here corrupts `.next` for every agent working in a
  worktree off this checkout, and it proves nothing about a plan. Leave the
  checkout exactly as you found it.

## 1. Check it is yours to plan

```bash
scripts/status.sh get <n>
scripts/status.sh type <n>
```

Both labels decide what happens next, and only these pairings are work:

| type             | status                       | what you do                                         |
| ---------------- | ---------------------------- | --------------------------------------------------- |
| `feature`        | `backlog`                    | plan it — §3                                        |
| `feature`        | `planning`, no plan yet      | plan it — §3                                        |
| `feature`/`epic` | `planning`, plan in the body | re-plan it: answer the feedback — §8                |
| `epic`           | `backlog`                    | pass one: requirements and the children list — §4   |
| `epic`           | `ready`                      | pass two: create the children a human approved — §4 |

Everything else is a stop, and you say which one it was:

- **`bug` or `task`, any status** — no plan stage. `/implement` takes it
  from `status:backlog`. If you think it is really a feature, say so; the
  relabel is the human's.
- **no type label** — say it needs `bug`, `task` or `feature` before
  anything can route it.
- **`feature` + `ready`** — approved already, and `/implement` has it.
- **`in-progress`** — an agent has it. Re-planning underneath them is how
  two agents collide.
- **`in-review` or `done`** — there is a PR; that is `/review-pr`.
- **`blocked`** — it is waiting on a human, not on a plan.

## 2. Read enough to plan it

```bash
gh issue view <n> --comments
```

Then read what the change would actually touch. Always `CLAUDE.md` (the five
invariants) and `docs/STATE.md`. Then, as relevant: `docs/ARCHITECTURE.md`,
the contracts (`docs/SCHEMA.md`, `docs/API.md`),
and the `.claude/rules/` file for each area the work lands in.

Read the code too. You are not writing it, but a plan built without looking is
a guess, and this repo does the same thing the same way in seven places — the
right plan is usually "copy the one in `lib/queries/experience.ts`", and you
can only say that if you looked.

## 3. Feature: a plan a human can disagree with

In the issue body (§5):

- **Requirements** — what must be true when this is done. Observable, not
  implementation.
- **Key decisions** — the two to five calls you made that a human might
  overrule, each with its reason. This is the part being approved.
- **Also changed** — the contracts, docs and rules that move with it.
- **Deliberately out** — what you are not doing, so scope creep is visible.

Plus a diagram (§6). Then `scripts/status.sh set <n> planning` and **stop**.
Say in your reply that it is waiting on the human's approval.

A feature that turns out to be small still stops at the gate. Write four
lines instead of forty and leave it in `planning` — the label is what says
this one gets a round trip, and promoting your own plan is the one move you
do not have.

## 4. Epic: two passes, with the gate between them

An epic is not implemented. It is decomposed into children that are, and it
takes **two** invocations to do that — because an epic's children are live
work the moment they exist. A child labelled `task` is launched straight at
`/implement` by `scripts/herd.sh`, so creating the children before a human
approved the decomposition would start code on an unapproved epic. The gate
goes between the two passes.

### Pass one — `epic` + `status:backlog`

The issue body gets product requirements and a diagram — what the initiative
is for, what will be true at the end, the pieces and how they fit — and **no
implementation plan**, because each child gets its own.

It goes between the plan markers exactly as a feature's does (§5), timestamp
and all. `scripts/herd.sh` reads the closing marker to tell a planned issue
from an unplanned one, so an epic whose requirements sit outside the markers
reads as unplanned and gets planned again on the next run.

It also gets **the children you intend to create**, as a list, each with the
type label you would give it:

```
- `feature` — Editable project categories (needs its own plan)
- `task` — Backfill the category seed data
- `bug` — Sort order ties render out of order
```

That list is load-bearing, and it is the part the human is really approving.
A type is a routing decision: proposing `task` is proposing that that child
never gets a plan of its own. One PR's worth of work per child.

Then `scripts/status.sh set <n> planning` and **stop**.

### Pass two — `epic` + `status:ready`

A human approved the decomposition. Create the children exactly as the
approved list says — same titles, same type labels, nothing added:

```bash
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)

# `gh issue create` has no --json: it prints the new issue's URL, and the
# number is its last path segment.
url=$(gh issue create --title "…" --body "…" --label feature)
child=${url##*/}

gh api "repos/$REPO/issues/<n>/sub_issues" \
  -f sub_issue_id="$(gh api "repos/$REPO/issues/$child" --jq .id)"
scripts/status.sh set "$child" backlog
```

Each child is left in `status:backlog` to take its own route — `/plan` if
it is a `feature`, `/implement` if it is a `bug` or a `task`. **Do not plan
them here**, and do not implement them.

Then `scripts/status.sh set <n> in-progress` and stop. The epic wears
`in-progress` for as long as its children are open: it is neither waiting on
you nor on an agent, and that label is what keeps anything from picking it
up again. A human closes it when the last child lands.

## 5. Where the plan goes

Into the **issue body**, fenced by markers, below whatever the human wrote:

```
<!-- plan planned=2026-09-19T20:31:00Z -->
## Plan
…
<!-- /plan -->
```

Both markers are read by machines. `scripts/herd.sh` looks for the closing
one to tell a planned issue from an unplanned one, and the `planned=`
timestamp is what a re-plan (§8) uses to tell feedback from the discussion
that preceded the plan. Use `date -u +%Y-%m-%dT%H:%M:%SZ`.

Read the body, keep everything above `<!-- plan`, and replace
anything between the markers. A re-plan then _replaces_ the old one instead of
burying it three comments deep, and the human's original report is never
touched.

```bash
gh issue view <n> --json body -q .body   # read, split on the marker
gh issue edit <n> --body-file <file>     # write back
```

## 6. Diagrams

Every issue that reaches this skill gets one — that is another thing the
`feature` label bought. (A `bug` or a `task` has no plan and therefore no
diagram, and `/implement` is written to expect none.)

Use the Excalidraw MCP. If it is not configured for this project, say so and
write the plan without a diagram rather than skipping the plan — the diagram
is the nice half, the **Key decisions** section is the half being approved.

One scene per issue, in the `plans` collection:

1. `list_collections` → find `plans`; `create_collection` if it is missing.
2. `create_collection_scene` with name `#<n> — <issue title>`.
3. `read_diagram_format` — the server requires it before the first write.
4. `create_diagram` with semantic nodes and edges.
5. `take_screenshot` and **look at it**. Overlapping labels and 8:1 aspect
   ratios are normal on the first attempt; fix them before linking it.
6. Link it in the plan as
   `https://app.excalidraw.com/s/<workspaceId>/<sceneId>` — the workspace id
   comes back on every scene's metadata, and that `/s/` path is the app's
   real scene route. Get it wrong and the link opens an empty editor rather
   than failing, so paste it once and check it loads.

Draw the **shape of the change**, at the altitude a human reviews at:

- the primary flow — what calls what, in what order
- any schema change: which tables are new, which gain columns, how they
  relate. Table names and relationships, not every column and type.

Two things that will bite you. `create_diagram` lays out one chain per layer,
so a long linear flow comes out 1:4 or worse — make board states the nodes and
put the actors on the edges rather than alternating them. And antiparallel
edges land both labels on the same midpoint, so label at most one of them.

## 7. Decide it; never ask it

The urge to ask is strongest exactly where the plan is most valuable — an
abstracted versus a concrete table, one endpoint versus three, a new
dependency versus hand-rolling it. **Ask none of them.** Pick the one you
would defend, write it in **Key decisions** with the alternative you rejected
and why, and stop. The approval gate is that question, asked in a form the
human can answer on their own schedule and in a form that is still there
tomorrow.

The smaller ones — "which shade of grey", "should I also update the docs",
"is this okay" — do not even earn a line in **Key decisions**. Decide them
and move on.

`AskUserQuestion` is not available to you in any of this. An unattended run
has no one to prompt.

## 8. Re-planning: answering feedback on a plan you already wrote

An issue sitting in `status:planning` is waiting on a human. When that human
has responded with feedback rather than approval, `/plan` is pointed at it
again to answer them. This is the same job on an epic, where the feedback is
usually about the decomposition — a child that should be two, or one that is
a `feature` rather than a `task`.

### Find what is new

The opening marker records when the plan was written:

```
<!-- plan planned=2026-09-19T20:31:00Z -->
```

Feedback is anything that arrived after that timestamp, from two places:

**Issue comments.**

```bash
gh issue view <n> --json comments \
  --jq '.comments[] | select(.createdAt > "<planned>") | {author: .author.login, body}'
```

**Annotations on the diagram.** Excalidraw's own comment feature is not
reachable — comments live on a different host behind a browser session, and
the API the MCP wraps has no endpoint for them. So canvas feedback arrives as
ordinary scene elements: a sticky note or a text box dropped on the diagram.
Read them with `search_scene_content` or `get_scene_content` and treat every
standalone text element that is not one of your own node or edge labels as a
note to you.

If both come back empty, say so and stop. Do not rewrite a plan nobody
questioned.

### Answer every piece of it

Each note is exactly one of three things, the same as a code review:

- **Take it.** Change the plan. Say what you changed.
- **Push back.** You think it is wrong, or it breaks something they cannot see
  from the plan — an invariant, a contract, a D-number. Say so, with the
  reason, and leave the decision to them. Do not quietly comply with a change
  you believe is wrong.
- **Out of scope.** A real point that belongs to a different issue. Say that
  plainly rather than absorbing it.

### Write it back

Rewrite the plan between the markers with a fresh `planned=` timestamp, and
regenerate the diagram if any of the feedback touched it — `create_diagram`
with `clearExisting: true`, which also clears the annotations now that they are
answered.

Then post **one** issue comment summarising what you did with each piece of
feedback: taken, pushed back on (and why), or deferred. That comment is how
the human sees they were heard without diffing two versions of a plan.

Leave the issue in `status:planning`. It is still waiting on the same human,
who now has your answers.

## 9. When it is not yours to decide

```bash
scripts/status.sh set <n> blocked
gh issue comment <n> --body "…"
```

Rare, because a plan is the one artefact that can hold an open question
without stalling: an alternative you are unsure about is a line in **Key
decisions**, not a blocker. Block only when you cannot write a plan at all —
the issue contradicts an invariant or a contract and there is no reading of
it that does not, or it is asking for something that is not in this codebase
and you cannot tell what it means.

Comment with the precise question and what you have already ruled out, then
stop. A blocked issue is information sitting where the human looks; a
question in a terminal is not.

## Length

**Never a wall of text.** A feature plan is tens of lines, not hundreds. If
what you are writing does not fit, that is the signal it should have been an
epic — say so in your reply and stop, rather than keep typing.

Leave out edge cases, error handling, naming, and anything a competent
implementer will work out. Those belong to `/implement`. What only you can
supply is the shape: the requirements and the handful of decisions a human
might want to reverse. Write it for a reader who has not seen the code.
