---
name: implement
description: Build one issue and open its PR. Invoked by hand as `/implement <issue-number>` — either a `bug` or `task` straight out of status:backlog, where you work out the approach yourself, or a `feature` whose plan a human approved into status:ready. Takes exactly one issue number and never scans the issue list. Claims it, works in a dedicated worktree, runs the full merge gate, and opens the PR. Never merges, and never invokes another skill.
disable-model-invocation: true
---

# Implement an issue

You have been pointed at **one** issue that is cleared to be built. Build
exactly what it asks for, get `npm run verify` green, and open the PR. Then
stop.

This is the second of the three **unattended** phases. `/plan` handles the
features that get planned, and `/review-pr` handles review. **Never invoke
them** — a human decides when a phase begins.

**Nobody is watching you run.** You were almost certainly started by
`scripts/herd.sh` into a terminal no one is reading yet, and a question you
ask there is not a question — it is the run stopping, silently, until
somebody notices. So do not ask any. Decide what you can decide and write
the reasoning into the PR body; for the rest there is `status:blocked` and a
comment on the issue (§7), which is the same question asked where the human
will actually find it.

Everything this skill leans on that is not written here — the seven
`status:*` labels, the type labels and the route each one takes, the
`planning → ready` human gate, `scripts/status.sh`, the worktree and branch
convention, the PR conventions — is in `.claude/rules/github.md`. Read it
first.

You are here because something typed `/implement <n>`. That is the only way in: this
skill is `disable-model-invocation: true` and never fires on its own, on a
task that merely resembles its description, or at another skill's request.
**An ordinary session with a human in it does none of this** — it follows
`CLAUDE.md` and takes approval in conversation. If that is your situation,
you should not be reading this.

## Two kinds of work arrive here

The issue's **type label** says which, and it was chosen by whoever filed
the issue:

| type           | what you were handed                          | what you decide                                 |
| -------------- | --------------------------------------------- | ----------------------------------------------- |
| `bug` / `task` | the issue text. No plan, no diagram           | the approach — you are doing the plan stage too |
| `feature`      | a plan in the issue body, approved by a human | nothing structural; the plan is the contract    |

**An unplanned `bug` or `task` is the normal case, not a missing step.**
There is no `<!-- plan -->` block to find and no Excalidraw diagram to open,
and their absence is exactly what the human meant by that label: this one is
small and clear enough that the approach is not worth a round trip. Do not go
looking for a plan, do not wait for one, and do not write one into the issue.
Decide the approach, build it, and put the approach in the PR body, which is
where the reviewer will look for it.

A `feature` is the other case. Someone already made the structural calls and
a human approved them, so your job is narrower, not wider: build what the
plan says.

## Hard limits

- **Never ask a question.** There is no one in the pane to answer it.
  Decide and record it in the PR body, or block (§7).
- **Exactly one issue, and it is given to you.** `/implement <issue-number>` takes the number as its argument. If you were invoked without one, say so and stop — never list, search or scan to pick one yourself, and never work more than one in a single invocation. Choosing what to work on is the human's job, and an agent that goes looking will find work nobody queued.
- **Never merge.** Opening the PR is where you stop. `status.yml` moves the
  issue when a human merges.
- **Never file an issue unprompted.** If the work uncovers other work — a bug
  you tripped over, a refactor that suggests itself — put it in your reply, or
  comment on the issue you are already on. The issue list is the human's
  inbox, and only they decide what enters it.
- **Never widen what you were given.** On a `feature`, the approved plan is
  the contract. On a `bug` or a `task`, the issue text is. If the right
  change turns out to be materially bigger, that is a `status:blocked` and a
  question on the issue (§7), not a judgement call you make alone.
- **Never change a type label.** The type is what decided whether this work
  got a plan stage. If a `task` turns out to be feature-sized, say so and
  block — the one thing you may not do is quietly do feature-sized work
  under a `task` label, because that is the approval gate being skipped by
  an agent, which is the whole thing the labels exist to prevent.

## 1. Check it is actually yours to take

```bash
scripts/status.sh get <n>
scripts/status.sh type <n>
```

Both labels have to agree that it is yours:

| type           | status    | verdict                                             |
| -------------- | --------- | --------------------------------------------------- |
| `bug` / `task` | `backlog` | **yours**, unplanned — filing it was the approval   |
| `bug` / `task` | `ready`   | **yours**, unplanned — a human queued it explicitly |
| `feature`      | `ready`   | **yours**, planned — the plan is in the issue body  |

Anything else and you stop and say why:

- **`feature` + `backlog` or `planning`** — not approved yet. Planning is
  `/plan`'s, and `planning → ready` is a human gate you may not cross, even
  if the plan in the body looks fine.
- **`epic`** — never implemented directly; its children are.
- **no type label** — nothing can route it. Say it needs one.
- **`in-progress`** — another agent has it. Two worktrees on one issue is how
  you get a merge conflict with yourself.
- **`in-review` / `done`** — there is already a PR. `/review-pr`.
- **`blocked`** — it is waiting on a human's answer, and you are not it.

Then read the issue, and everything on it:

```bash
gh issue view <n> --comments
```

On a `feature`, the plan is in the body between the `<!-- plan` and
`<!-- /plan -->` markers, usually with a link to an Excalidraw diagram —
open it, because the shape of the change is drawn there rather than
written. If there is no plan at all, stop: an unplanned feature is `/plan`'s
job, not yours.

On a `bug` or a `task`, expect neither, and read the comments carefully
instead — with no plan in front of you, the issue text and its comments are
the entire specification.

## 2. Claim it before you write anything

```bash
scripts/status.sh set <n> in-progress
```

Before, not after. The label is how a second agent reading the issue list sees
the work is taken.

## 3. Worktree and branch

One issue = one agent = one worktree = one branch.

```bash
ROOT=$(git rev-parse --show-toplevel)
WT="$ROOT/../$(basename "$ROOT")-wt/<n>"

git -C "$ROOT" fetch origin
git -C "$ROOT" worktree add "$WT" -b <type>/<n>-<slug> origin/main
ln -s "$ROOT/node_modules" "$WT/node_modules"
ln -sfn "$ROOT/.env" "$WT/.env"
```

`<type>` comes from the issue's type label: `bug` → `fix/`, `task` →
`chore/`, `feature` → `feat/`. Branch from `origin/main`, never from local
`main`, which may be behind.

`node_modules` is symlinked, not installed — **never run `npm install` in a
worktree** unless you mean to replace that symlink. `.env` is symlinked too,
because the gate's integration tests need `DATABASE_URL` and silently skip
16 suites without it.

## 4. Build it

Read `CLAUDE.md`'s five invariants before touching anything. They are all
silent — nothing fails at the moment you break one.

Then read the `.claude/rules/` file for every area you are about to edit. They
load automatically on matching paths, and ESLint enforces the mechanical half
with error messages that name the rule file.

**Follow the existing pattern before inventing one.** This repo does the same
thing the same way in seven places. Find one and copy it; where it doesn't,
that inconsistency is the bug. On a `feature`, a new pattern is a decision
the plan did not approve. On a `bug` or a `task`, it is a decision nobody
approved at all.

While you work:

- **Comments explain why.** The code says what. Match the density around you —
  every non-obvious decision in this repo already carries a reason or a
  D-number.
- **Update contracts in the same commit** as the code that changes them.
  `docs/SCHEMA.md` and `docs/API.md` are authoritative, and a disagreement
  with reality is a bug in one of them. If an approved plan declared a
  contract frozen, comment on the issue instead of editing it.
- **Add a D-entry to `docs/DECISIONS.md`** for anything a future reader would
  want to reverse. Append-only; annotate a superseded entry rather than
  rewriting it.
- **Update `docs/STATE.md` only where your change made something in it
  untrue.** It is present tense, not a changelog — never append to record that
  work happened.
- **Prefer deleting.** If nothing imports it, remove it.

Commit in small imperative steps. Reference the issue in the body, never the
subject, so `git log --oneline` stays readable.

### Deciding the approach yourself, on a `bug` or a `task`

You are doing the plan stage as well as the build, but compressed into the
work rather than written into the issue. Four things keep that honest:

- **Say the approach in two sentences before you write anything** — to
  yourself now, and in the PR body later. If it does not fit in two, the
  issue is feature-sized and that is §7, not a longer paragraph.
- **The pattern you copy is the decision.** Find the place that already does
  this and follow it. "Which of the seven existing shapes is this one" is the
  whole architectural question on work this size, and answering it with an
  existing file is what makes a plan unnecessary.
- **Keep it local.** A migration, a new API route, a new contract entry in
  `docs/SCHEMA.md` or `docs/API.md`, or a change spanning more than a couple
  of layers means the work outgrew its label. Stop and block.
- **Nothing goes into the issue body.** That body is the human's, and a
  `bug` or a `task` has no plan block, no `planned=` timestamp and no
  diagram — `scripts/herd.sh` reads the closing plan marker to tell planned
  work from unplanned, so writing one in would misroute the issue. Your
  record is the commits and the PR body. Do not create an Excalidraw scene
  either; the diagram belongs to the plan stage this issue skipped.

## 5. The gate

```bash
docker compose up -d db
npm run verify
```

Run the whole thing, not a subset — `format:check`, `lint`, `typecheck`,
`test`, `build`, reseed, `smoke`, `test:e2e`, in an order where each step
catches what the previous cannot. In particular `typecheck` is **not** enough:
`next build` additionally validates App Router export signatures, and a page
whose default export takes a custom prop typechecks fine and fails the build.

**A non-zero skip count is a failed run wearing a pass**: the query and
session suites self-skip without `DATABASE_URL`, so `npm test` reports green
on a subset. Check the skip line reads 0, and that the pass count has not
dropped since the last run on `main`.

Never report green you have not seen. If a step fails and you cannot fix it
inside the scope you were given, that is §7.

## 6. Open the PR

```bash
git push -u origin <branch>
gh pr create --base main --title "…" --body "…"
```

The body must contain `Closes #<n>` — GitHub parses it into a real link, and
`status.sh pr-issues` reads that link rather than the text, so what drives the
status is exactly what GitHub will close. One issue per PR.

Write the body for a reviewer who has not read the plan: what changed, why,
and what you verified — with the actual numbers from the gate, not "tests
pass". Call out anything you did that the plan did not cover, rather than
letting the reviewer discover it in the diff.

On a `bug` or a `task` the body carries **the approach as well as the
change**, because the reviewer has not read a plan — there was not one, and
this PR is the first time anyone sees the call you made. A paragraph: what
you did, why that way, and the alternative you rejected if it was close. On
a `feature`, the plan already did that, so the body says what changed and
where it departed from the plan.

Open it as a draft if it is not ready. Marking it ready is what sets
`status:in-review`; never hand-set that label.

Then **stop**. Do not merge.

## 7. When you get stuck

```bash
scripts/status.sh set <n> blocked
gh issue comment <n> --body "…"
```

Comment with the precise question and what you have already ruled out, then
stop. A blocked issue is information sitting where the human looks; a guess
that got merged is a bug, and a question in an unread terminal is neither.

Block when:

- the plan, or the issue, contradicts an invariant or a contract;
- the right fix is materially larger than what you were given;
- two implementations differ in a way that outlives this PR — a table
  shape, a public contract, a pattern the next five changes will copy — and
  nothing settles which. On a `feature` the plan already settled it; on a
  `bug` or a `task` a close call you can defend goes in the PR body
  instead, and only a fork that big is worth stopping for;
- a `bug` or a `task` turns out to be feature-sized. Say so plainly: it
  wants a plan, the relabel is theirs to make, and you are not going to do
  it under the label it has.

Do not block on anything you can decide and write down in the PR body.
