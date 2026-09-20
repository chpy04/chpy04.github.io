# Decisions

Append-only. Each entry is a choice a future reader would otherwise want to
reverse, with the reason and the alternatives that were rejected. Add one
when you make a call that is not obvious from the code; annotate a superseded
entry rather than rewriting it.

D-001 through D-014 came from `template-web`, which this was built on.
They are the decisions the harness itself embodies — inherit them, or
reverse them deliberately and say so in a new entry. D-015 onwards are this
application's own.

---

## D-001 — Postgres + Drizzle, with hand-written SQL migrations

Drizzle for queries and types, but migrations are hand-written plain SQL in
`drizzle/*.sql` applied by `scripts/migrate.ts`, not `drizzle-kit generate`.

Generated migrations are unreviewable: the diff that matters (is this
backfill correct? does this index lock the table?) is buried in DDL nobody
reads. Hand-writing them costs a few minutes and makes the migration the
artefact you review.

The cost is two sources of truth — `drizzle/*.sql` and `lib/db/schema.ts` —
kept in agreement by hand. That is real, and `.claude/rules/data-access.md`
says so. Rejected: `drizzle-kit push` (no history at all) and an ORM with
integrated migrations (the same reviewability problem, plus a bigger
dependency).

## D-002 — The database client is lazy

`lib/db/index.ts` exports Proxies that construct the `postgres()` client on
first query and cache it on `globalThis`.

`next build` evaluates every route module while collecting page data, so an
eager `postgres(process.env.DATABASE_URL!)` at module scope fails the build
on any machine without a live database — including CI, which deliberately
runs `build` with no `DATABASE_URL` precisely to keep this honest.

Rejected: a `getDb()` function every caller invokes. It works, but one
forgotten call site reintroduces the problem, and the Proxy makes the whole
category impossible.

## D-003 — Archive, never delete

Content rows carry `is_archived` and there are no DELETE endpoints for them.

Anything that already references a row keeps working; the row just stops
appearing in pickers. This matters most for the case nobody anticipates —
some other record, snapshot or export that quietly depended on it.

Rejected: soft-delete with a `deleted_at` timestamp. Same mechanism, but the
name invites code to treat it as gone, which is the behaviour being avoided.

## D-004 — User isolation lives in the query layer, not in middleware

`middleware.ts` can only answer "is this request authenticated at all" — it
runs on the Edge runtime and cannot reach the database. Every handler calls
`requireUserId(request)` and threads the id into query functions that filter
on it.

The failure mode of the alternative is silent: middleware that "handles
auth" invites handlers that assume scoping already happened, and a missing
`WHERE` clause then returns somebody else's rows with a 200.
`lib/queries/isolation.test.ts` is the executable form of this decision.

Rejected: Postgres row-level security. It is the stronger mechanism, but it
requires the connection to carry the user identity, which a shared pooled
connection does not, and it moves the rule somewhere the type system cannot
see it.

## D-005 — `user_id` only on root tables

Root tables (those not reachable from another table) carry `user_id`. Child
rows carry none and inherit their owner through a join to their parent.

One source of truth per fact. A `user_id` on a child row could contradict
its parent's, and nothing would notice. The cost is that child-row queries
must join — which is exactly the check that would otherwise be forgotten.

## D-006 — Three auth modes, defaulting closed

`APP_AUTH_MODE` = `dev` | `password` | `supabase`, defaulting to `dev`
outside production and `password` in production.

The default is the decision. Defaulting to `dev` everywhere would mean
shipping with no login screen by omission — a config mistake with no error
message. An unimplemented mode (`supabase`) rejects every request rather
than falling through.

Rejected: a single `NODE_ENV`-driven boolean. Three named modes make the
"which user am I, and how do you know" question answerable in one place
(`lib/session.ts`) instead of scattered across the auth path.

## D-007 — Web Crypto only in the middleware import graph

`lib/auth.ts` uses `crypto.subtle` exclusively, including for timing-safe
comparison (it hashes both sides and compares digests, because the Edge
runtime has no `timingSafeEqual`).

Anything reachable from `middleware.ts` runs on the Edge runtime, which has
no `node:crypto`. ESLint blocks the import in the two files it can see, but
the ban is transitive in a way ESLint cannot check — adding a dependency
here means checking its whole import graph.

Web Crypto is also a Node global, so the same code runs unchanged in route
handlers and under `node --test`.

## D-008 — No test framework, no assertion library

`node:test` + `node:assert/strict` for unit and integration tests,
Playwright for the browser. No Jest, no Vitest, no mocking framework.

Node's runner covers everything actually needed here and costs no install,
no config file, no transform pipeline, and no version-skew debugging. The
absence of a mocking framework is also load-bearing: query tests run against
a **real** Postgres, because the thing under test is the `WHERE` clause and
a mocked query layer asserts nothing.

## D-009 — One CI job per gate step

`format`, `lint`, `typecheck`, `test`, `build`, `smoke`, `e2e` are seven
workflows, not one.

They fail for unrelated reasons and at wildly different speeds. A formatting
mistake should not wait on a browser run, and "CI is red" should name which
kind of wrong it is without opening a log. They share
`.github/actions/setup-node-deps` so the Node version lives in one place.

`typecheck` and `build` are deliberately both present: `next build`
additionally validates App Router export signatures and resolves the webpack
config, and a page whose default export takes a custom prop typechecks fine
and fails the build.

## D-010 — Task status is a `status:*` label, not a Projects board

Projects v2 is reachable only from a classic PAT with `project` scope,
because fine-grained PATs expose Projects as an _organization_ permission.
A classic PAT cannot be restricted to one repository, so "an agent
credential that can only touch this repo" and "a credential that can move
the board" are mutually exclusive.

Labels need only `Issues: write`, which CI's default `GITHUB_TOKEN` already
has — so there is no secret whose absence can silently stop the lifecycle,
which is the failure this replaced. Labels also survive a migration to
Linear or Jira.

`scripts/status.sh` is the only thing that writes them, so "exactly one
status label at a time" is enforced in one place.

## D-011 — Three skills, each invoked by hand, never invoking each other

`/plan`, `/implement`, `/review-pr` each carry one phase, each take
exactly one issue or PR number, and each is `disable-model-invocation:
true`.

A phase boundary is a human decision, and three separate invocations is what
keeps it one. The thing that matters when nobody is watching is an agent
that **stops** where a human would otherwise have interrupted it — so the
skills are heavy with ceremony that an attended session never pays for,
because it lives in the skill files rather than in `CLAUDE.md`. `CLAUDE.md`
does not mention them at all: they are model-invocation-disabled, so an
attended session cannot reach them and should not be carrying the idea of
them around.

They also never ask. An unattended run has no one in the pane, so a question
is the run stopping silently — every open question is written to the issue
instead, as a **Key decision** in a plan, a line in the PR body, or
`status:blocked` plus a comment.

`scripts/herd.sh` is the one place that decides what to start, and it
contains no model: every branch is a label or timestamp comparison.

## D-012 — In-app feedback files a GitHub issue, screenshots on an orphan branch

`POST /api/feedback` turns a report into an issue via the REST API.
Screenshots are committed to a dedicated orphan branch (`feedback-assets`)
through the Git Data API, and the issue links the raw URL _at that commit's
sha_, which makes the link immutable.

GitHub's issue API has no attachment endpoint — the drag-and-drop uploader
in the web UI is not public. The Git Data API is used rather than the
simpler Contents API because the latter caps a file at 1 MB, well under a
Retina screenshot.

The route resolves a caller like every other handler even though it writes
nothing user-scoped: that is what stops it being an open issue-filing relay.

## D-013 — One palette, as `@theme` tokens

Every colour comes from a named token in `app/globals.css` and is used
through the generated utility (`text-ink-dim`), never as an arbitrary value
(`text-[var(--color-ink)]`) or a raw shade (`text-red-400`).

Raw shades drift: the same error banner ends up three different reds in
three files, and nothing catches it. Tokens are named for their _role_
(`--color-danger-line`), not their appearance, so a palette change is one
edit.

## D-014 — Conventions live in `.claude/rules/`, enforced by ESLint

`CLAUDE.md` carries only what must be in context for every change. Everything
directory-specific is a rules file with a `paths` glob, loaded only when a
matching file is touched, so none of it costs context on unrelated work.

The mechanical half is enforced by `eslint.config.mjs`, whose error messages
name the rule file that explains them. Prose alone is something an agent can
skim past; a failing lint rule is not. Prose and lint config are meant to
agree — changing one means changing the other.

## D-015 — The public page is a server component, not an API call

`app/page.tsx` reads `lib/queries/content.ts` directly and renders the
whole portfolio on the server. There is no public JSON endpoint, and
`lib/api-client.ts` has no function for reading content.

Two things fall out of that, both wanted. A reader gets a complete page in
one round trip with no spinner and no layout shift — which is the entire
job of a portfolio. And the API surface stays small: every route under
`app/api/**` requires a session, so "does this endpoint need auth?" has one
answer instead of a judgement call per route.

The apparent tension with invariant 1 — a query must be scoped to a user,
but a reader has no session — is resolved by `lib/site-owner.ts`, not by an
exception. Public means "rendered for someone who is not signed in", not
"unscoped": the query still gets a `userId`, and it is the owner's.

`export const dynamic = 'force-dynamic'` is load-bearing twice. It is what
makes an edit visible without a redeploy, and it is what stops `next build`
trying to prerender the page and evaluating the query layer with no
database (D-002).

## D-016 — Editing is `contenteditable` in place, behind a switch

Double-clicking any text on the page edits it where it sits
(`components/admin/EditableText.tsx`). Not an input swapped in on click,
and not a separate `/admin` form.

An input cannot inherit the surrounding typography — the 96px hero name and
the 12px category chip would each need their own sizing — and the moment
text reflows differently in the editor than on the page, editing stops
being "in place" and becomes a form that happens to be positioned nearby.

The cost is that React must not own the element's children while the DOM is
being typed into, so the component renders none during an edit and remounts
on the way out. That is the whole of the complexity in that file, and it is
why it is one file rather than a pattern repeated per field.

The **switch** is not a nicety. A project card is an `<a>`; a double-click
on a link fires the click that navigates first, so the title would be the
one string on the page you could not edit. While editing, cards and social
buttons render as plain elements instead. The toggle is therefore also how
the owner browses their own site normally, and it is persisted so it is not
a decision to make on every page load.

Things that are not text on the page — a date, an image path, a link —
cannot be double-clicked, and get an `AdminStrip` of ordinary inputs below
the item instead.

## D-017 — Content is markdown, rendered sanitized, never raw HTML

Timeline descriptions, the about paragraph and project write-ups are
markdown, rendered by `components/portfolio/Markdown.tsx` with
`rehype-sanitize` and **without** `rehype-raw`.

The original site stored timeline descriptions as HTML and rendered them
with `dangerouslySetInnerHTML`, which worked because the only markup was
two `<a>` tags the owner had typed. Making that content editable in the
browser would have meant either trusting whatever a `contenteditable`
produced, or writing a hand-rolled HTML sanitizer — and a hand-rolled
sanitizer is a liability out of all proportion to two links.

Markdown avoids the question: the edited value is plain text, and the
renderer is what decides which elements exist. `scripts/seed.ts` converts
the two anchors in the source data on the way in.

## D-018 — Images stay files; the database stores paths

`headshot_path`, `image_path`, `thumbnail_path` and the two resume paths
are strings pointing into `public/`. Nothing in the app uploads an image.

Upload means a storage bucket, a signing flow, a size and type policy, and
a broken-link story — a feature in its own right, and not the one that was
asked for. Dropping a file into `public/` and pasting its path is a
perfectly good workflow for a portfolio whose images change a few times a
year, and it keeps the deploy artifact self-contained.

The admin strip edits the path, so adding an image is still a one-line
change with no redeploy of content — only of the file itself.

## D-019 — The feedback widget ships locally and nowhere else

`lib/feedback/enabled.ts` returns false when `VERCEL` is set. The widget is
a development tool; on the public portfolio it would be a button offering
strangers a way to open issues on the owner's repo.

`VERCEL` rather than `NODE_ENV` because a local `next build && next start`
is still local, and the point of running it is to check what you are about
to deploy. `FEEDBACK_ENABLED` overrides in both directions.

Both halves are gated. The route returns `404` when disabled, not just the
button hidden — hiding a control while leaving its endpoint open is not a
gate.

## D-020 — With no repo configured, feedback is written to a file

`fileFeedback()` falls back to `lib/feedback/local-sink.ts`, which writes
the report as markdown into `feedback/` with its screenshot beside it.

The template refused with a `503` when `GITHUB_TOKEN` was unset. That is
right for a deployment that was _meant_ to be wired up and is not; it is
wrong for a project that has no repo yet, where it makes the widget useless
exactly when it is most wanted.

The fallback is only for a **missing configuration**. A token that GitHub
then rejects still fails loudly as a `502`, because that is a broken setup
rather than an unfinished one — and the widget always says which of the two
sinks took the report, so the fallback is never silent.

## D-021 — Three UI dependencies from the original site were dropped

The site this replaces used `@headlessui/react` for its mobile menu and
write-up modal, `framer-motion` for the timeline panel transition, and
`gsap` for the hero's entrance.

All three are now platform features: a native `<dialog>` with
`showModal()` gives the focus trap, Escape handling, backdrop and page
inertness that the modal needed; the menu is a `useState` and a
conditional; and both animations are CSS keyframes declared as `--animate-*`
theme tokens.

The page is visually unchanged — typography, colours and dot positions were
compared against the original at 1440px — and there are three fewer
dependencies for a future reader to learn. This is CLAUDE.md's "don't add a
dependency to solve something the platform does", applied to inherited code
rather than new code.

`react-markdown` and its two plugins stayed: rendering and sanitizing
markdown is not something the platform does.

## D-022 — The timeline axis is a pure module, not a hook

`lib/timeline.ts` holds every calculation the timeline does — the
piecewise-linear scale that collapses multi-year gaps, the year labels, the
two-pass algorithm that nudges same-day entries apart — and
`lib/timeline.test.ts` covers it with no DOM and no database.

In the original this lived in `components/Timeline/utils.ts` and was
untested. The cases that actually break it are all arithmetic: a gap one
day either side of the compression threshold, a year label falling inside a
collapsed gap, three entries on the same date. Each is a line in a unit
test and a twenty-minute investigation in a browser.

## D-023 — The issue's type label decides whether there is a plan stage

This one amends the inherited harness rather than the app, so it also lives
in `template-web`, where it is D-015. Changing it here means changing it
there.

Whoever files an issue picks `bug`, `task` or `feature`, and that label is
the route: a `bug` or a `task` goes straight from `status:backlog` to
`/implement`, while a `feature` goes to `/plan` and waits at the
`planning → ready` approval gate before any code. `/implement` therefore
runs in two modes — from an approved plan, or from nothing but the issue
text, deciding the approach itself and writing it into the PR body.

Before this, `/triage` ran on every issue and sized it: Track A (small) it
planned in five lines and **self-approved** straight to `status:ready`,
Track B it planned properly and left at the gate. That put both the sizing
and the decision to skip the only gate inside the agent, on a judgement call
the table in that skill admitted was often close. It also spent a full agent
run writing a five-line plan for a typo fix.

A human already knows which kind of thing they are filing, at the moment
they file it, for free. Moving the call to the issue template makes it a
human's, makes it visible on the list without opening the issue, and leaves
no way for an agent to route itself around an approval — no skill may write
a type label, and `/implement` blocks rather than quietly building a `task`
that turned out to be feature-sized.

The cost is mislabelling: a `task` that should have been a `feature` gets
built without anyone seeing the approach first. That is bounded by the PR
review, and by `/implement` blocking when the work outgrows its label.
Rejected: keeping agent-side sizing but removing the self-approval (an extra
round trip on every typo), and a fourth `needs-plan` label orthogonal to
type (two labels saying one thing, and they can disagree).

Epics keep a plan stage and gain a second pass: `/plan` writes the
decomposition, a human approves it, and only then does a second `/plan`
create the children. Children are live work the moment they exist — a `task`
child is launched straight at `/implement` by `herd.sh` — so creating them
before the approval would start code on an unapproved epic.

## D-024 — `herd.sh` creates the worktree; an agent never starts in the main checkout

`scripts/worktree.sh` creates or reuses the worktree for an issue or a PR,
and `herd.sh` calls it **before** launching, so a code-writing agent's cwd
is its own worktree from its first command. If the worktree cannot be made,
the agent is not started at all.

Before this, the worktree was a block of bash in `/implement`'s SKILL.md
for the agent to copy, and the agent was started with `--cwd` set to the
main checkout. So "did this agent work in the main checkout" was answered
by whether a model followed prose — and every way of getting it wrong is
silent at the time: two `next build` processes in one checkout corrupt
`.next` and surface as `ENOENT .next/routes-manifest.json` in a _different_
agent's run, and a commit lands on whichever branch the checkout is on,
usually `main`.

`assert` stays in the skills as the second half, because a human typing
`/implement 12` by hand gets no herd and no pre-made worktree. Belt and
braces is right here: the cheap check runs before every first write.

`/plan` is deliberately exempt and runs in the main checkout. It writes to
the issue through `gh` and never to a file, so a worktree would buy nothing
— which is why the skill instead forbids it from building, running the gate
or editing anything.

Rejected: keeping creation in the skill and adding only the assertion (the
agent still starts in the main checkout, so every read, and any slip before
the first assert, happens there); and giving `/plan` a worktree too (a
directory and a branch per plan, to hold no changes).

Not solved by this: the **database is still shared**. Worktrees isolate the
filesystem and the branch, not Postgres on :5434, so two agents running
`npm run verify` at once still collide on `npm run db:seed -- --force`,
which truncates. The fixtures are written for a shared database, but the
reseed is not.

## D-025 — The timeline's step buttons flank the card, not the dot

"Arrows to the left and right of the current one" reads most naturally as
beside the selected dot, and that is not where they are. Two entries may sit
`MIN_DOT_GAP` — 2.4% — apart, so a pair of dot-anchored arrows would sit on
top of their neighbours, and every step would move them horizontally by an
unpredictable amount. A control that relocates each time you press it is not
a control you can press five times.

Beside the card they are stationary, they read as the carousel control they
are, and at laptop width and above they occupy dead space the card's
`max-w-3xl` already leaves empty. They are flex siblings of the card rather
than absolutely positioned in that dead space, because at tablet width the
card fills the shell and there is none — as siblings the card narrows, as
overlays they would land on top of it.

The dot stays the thing the arrows move. What says which dot that is, is the
leader line from the dot down to the card's top edge — emphasising the dot
alone does not answer "which one is being shown" when the answer is 200px
below and centred, with nothing joining the two.

Rejected: arrows on the axis itself (above), and wrapping from the newest
entry round to the oldest instead of disabling at the ends, which throws
away the one thing a date-proportional axis is for — knowing where on it
you are.

This is the most reversible call in the change. Moving the arrows onto the
axis touches nothing else: the stepping is `move()` plus a clamp, and the
leader line is independent of where the buttons are.
