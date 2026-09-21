# CLAUDE.md

Deliberately thin. It carries what must be in context for _every_ change;
everything directory-specific lives in `.claude/rules/`, which loads only
when you touch matching files. Read `docs/STATE.md` first, then
`docs/ARCHITECTURE.md`. Both describe what exists; what is being _worked on_
is not in `docs/` at all.

## What this is

Chris Pyle's portfolio site: Next.js 15 + Postgres, with the content in the
database and every string on the page editable in place by its owner. It
was built on `../../template-web` and keeps that harness — three auth
modes, the feedback widget, the merge gate, `.claude/rules/`.

**The page is not the API.** `app/page.tsx` server-renders the whole
portfolio from `lib/queries/content.ts`; a reader's browser makes no API
calls at all. Every route under `app/api/**` therefore requires a session,
without exception, and exists for the edit layer. Read D-015 before adding
an endpoint — it is the structural decision the rest of the app hangs off.

The worked example to copy is `project` + `project_category`: a root table
with an owner and a child table without one, through migration, schema,
queries, validation, route, client, component, isolation test, e2e spec,
seed and smoke.

## Five invariants

Breaking any of these is silent — nothing fails loudly at the moment you do it.

1. **Every query is scoped to a user.** Handlers begin with
   `const userId = await requireUserId(request)` (`lib/session.ts`) and pass
   it down; the query layer filters on it. Isolation is enforced in the
   queries, **not** in `middleware.ts`, which runs on the Edge and cannot
   reach the database. Another user's id must read as "not found", never
   "forbidden". `lib/queries/isolation.test.ts` is the executable form of
   this paragraph and the first thing to run after touching any query.

   The public page is **not** an exception. It has no session, so it scopes
   to the _site owner_ (`lib/site-owner.ts`) — a real `userId`, through the
   same `WHERE`. "Public" describes the reader, never the query (D-015).

2. **`user_id` lives only on root tables.** Child rows carry no owner and
   inherit one through a join to their parent (D-005). A `user_id` on a
   child could contradict its parent's and nothing would notice.
3. **Archive, never delete.** No DELETE endpoints on content. `is_archived`
   hides it; anything that already references it keeps working (D-003).
4. **The DB client stays lazy.** Never hoist `postgres(...)`/`drizzle(...)`
   to module scope; `next build` evaluates every route module and would fail
   on any machine without a live `DATABASE_URL` (D-002).
5. **Nothing in the `middleware.ts` import graph may touch `node:crypto`.**
   Middleware runs on the Edge runtime. `lib/auth.ts` is Web Crypto only
   (D-007), and the ban is transitive in a way ESLint cannot check.

One more that is not quite an invariant but bites as often: **break every
ordering tie on `id`.** `sort_order` is not unique and `created_at` ties for
every row written in one transaction.

## Auth modes

`APP_AUTH_MODE` = `dev` | `password` | `supabase`, defaulting to `dev`
outside production and `password` in production (`lib/auth-mode.ts`). `dev`
means **no login at all**: the session is the first user in `users`, which
is whoever `npm run db:seed` created — which is why the page is editable
the moment you start it locally. `password` puts the edit layer behind
`/login`. `supabase` is a written-but-unimplemented seam
(`lib/auth-supabase.ts`) that fails closed.

What auth gates here is **editing, not reading**. The portfolio renders for
everyone in every mode; a failed session check means no edit affordances,
not a login screen. The browser suite pins `APP_AUTH_MODE=password` so it
drives the real one; dev and supabase modes are covered in-process by
`lib/session.test.ts`.

## Merge gate

```
npm run verify
```

That is `format:check`, `lint`, `typecheck`, `test`, `build`, reseed,
`smoke`, `test:e2e` — in an order that works. Requires
`docker compose up -d db`, which serves Postgres on **:5434** (the template
this came from uses 5433, and the two run side by side).

**Stop any `next dev` you have running in this checkout first.** `test:e2e`
starts its own on :3100, and two dev servers sharing one `.next` corrupt it
— which surfaces later as a request that hangs for ever on
`○ Compiling /api/… `, and looks exactly like the feature you just wrote
being broken.

Run the whole thing, not a subset. Each step catches something the previous
one cannot:

- `typecheck` is **not** enough on its own. `next build` additionally
  validates App Router export signatures and resolves the webpack config; a
  page default export taking a custom prop typechecks fine and fails the
  build.
- `test` needs `DATABASE_URL` or the integration suites silently self-skip
  and still report green. Check the skip count is **0**.
- `smoke` reads live DB state and a prior Playwright run leaves edited
  content behind — hence the reseed before it.

## Directory rules

`.claude/rules/` holds the conventions for each part of the tree, loaded
when you edit matching files. ESLint enforces the mechanical half and its
error messages name the rule file (D-014).

| rule             | applies to                                  |
| ---------------- | ------------------------------------------- |
| `imports.md`     | all TS/TSX — two import regimes, by runtime |
| `api-routes.md`  | `app/api/**`                                |
| `data-access.md` | `lib/queries/**`, `lib/db/**`, `drizzle/**` |
| `components.md`  | `components/**`, `app/**/*.tsx`             |
| `styling.md`     | the same, plus `app/globals.css`            |
| `auth.md`        | the auth + middleware graph                 |
| `testing.md`     | `**/*.test.ts`, `e2e/**`, `scripts/**`      |
| `docs.md`        | `docs/**`                                   |
| `github.md`      | `.github/**`, `scripts/status.sh`           |

## Contracts

`docs/SCHEMA.md` and `docs/API.md` are authoritative. Code must match them;
a disagreement is a bug in one of them to be fixed deliberately, not papered
over. Update the contract in the same commit as the code.

## How to work here

- **Follow the existing pattern before inventing one.** Find the place that
  already does this and copy it; where the codebase disagrees with itself,
  that inconsistency is the bug.
- **Comments explain why.** The code says what. Every non-obvious decision
  in this repo carries a comment naming its reason or its D-number — match
  that density, and add a D-entry to `docs/DECISIONS.md` for anything a
  future reader would want to reverse.
- **Prefer deleting.** If nothing imports it, remove it.
- **Keep logic pure and testable.** The valuable modules here are pure
  functions with exhaustive unit tests and no framework. Reach for that
  shape before reaching for a hook.
- **Don't add a dependency** to solve something the platform does. There is
  no test framework, no assertion library, and no state manager. That is
  deliberate (D-008).
- **`docs/` describes the present tense.** It says what exists, never what
  is planned or in flight. A change updates `docs/STATE.md` only where it
  changed what is true, not to record that it happened — git is the record
  of that.

## Content, and what is not content

Text, links and dates are rows, edited on the page. **Images are objects in
a Supabase Storage bucket** and the database stores their URLs (D-026).
Nothing image-shaped lives in `public/` any more; adding one is a drop on
the page, not a commit.

The bytes never pass through the app. `POST /api/uploads` signs a URL for
one object key built from the caller's own user id, and the browser PUTs
the file to Supabase itself (D-027) — which is what gets a 20 MB GIF past
a 4.5 MB request-body ceiling. The allowlist and the size limit live in
`lib/storage/media.ts` and are mirrored on the bucket; uploads are never
deleted, for the same reason content is archived rather than deleted.

Long-form text — the about paragraph, timeline descriptions, project
write-ups — is **markdown**, rendered through
`components/portfolio/Markdown.tsx` with `rehype-sanitize` and never
`rehype-raw` (D-017). If you find yourself reaching for
`dangerouslySetInnerHTML`, that is the decision to raise, not to make.

## How the work lands

Understand the request, branch, build it, get `npm run verify` green,
commit. Approval happens in conversation — "go ahead" is the whole gate.

There is no ceremony to perform. No issue to file, no label to move, no plan
to post and wait on. If a GitHub issue already exists and the human named
it, reference it in the commit body; if one does not, **do not create one** —
the issue list is the human's inbox, and an agent that files its own work
item has quietly promoted its own idea to a commitment nobody made. Say it
in your reply instead.

## Branches and worktrees

**Never commit to `main`.** Branch `feat/<slug>`, `fix/<slug>` or
`chore/<slug>`.

If several agents share this checkout, "nobody else is touching this" is
never safe to assume. Two `next dev`/`next build` processes in one checkout
corrupt `.next` — it surfaces as `ENOENT .next/routes-manifest.json` or
`PageNotFoundError: Cannot find module for page: /api/...` and random e2e
failures, and it is never a real regression (`rm -rf .next` and re-run). So
if another agent is live, take a worktree:

```bash
ROOT=$(git rev-parse --show-toplevel)
WT="$ROOT/../$(basename "$ROOT")-wt/<slug>"

git -C "$ROOT" worktree add "$WT" -b <type>/<slug> origin/main
ln -s "$ROOT/node_modules" "$WT/node_modules"
ln -sfn "$ROOT/.env" "$WT/.env"
```

Worktrees live outside the repo and are never committed. `node_modules` and
`.env` are symlinked in — don't run `npm install` in a worktree unless you
mean to replace that symlink.
