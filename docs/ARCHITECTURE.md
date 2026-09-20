# Architecture

The shape of the system, and why each piece is the way it is. For what the
tables and endpoints actually are, see `SCHEMA.md` and `API.md`; for the
choices behind any of it, `DECISIONS.md`.

## The stack

| piece    | choice                               | why not the obvious alternative                             |
| -------- | ------------------------------------ | ----------------------------------------------------------- |
| runtime  | Next.js 15, App Router               | one deployable for UI and API; middleware for the auth gate |
| database | Postgres 17 (docker-compose locally) | Supabase in production                                      |
| access   | Drizzle ORM, hand-written migrations | generated migrations are unreviewable (D-001)               |
| styling  | Tailwind v4, `@theme` tokens only    | no CSS modules, no component library (D-013)                |
| markdown | react-markdown + rehype-sanitize     | never raw HTML (D-017)                                      |
| tests    | `node:test` + Playwright             | no Jest, no mocking framework (D-008)                       |
| auth     | three modes, one resolver            | see `.claude/rules/auth.md`                                 |

No state manager, no data-fetching library, no assertion library, no
animation library, no headless-UI library. The platform covers all of them
(D-021), and each one added is a thing every future reader has to learn
before they can read the code.

## The page is not the API

This is the one structural thing to understand before reading anything
else, and it is what most distinguishes this app from the template it grew
out of.

```
                         a reader                    the owner
                            │                            │
                    GET /  (HTML)                  GET /  (HTML)
                            │                            │
                            ▼                            ▼
                   app/page.tsx (server)         app/page.tsx (server)
                            │                            │
                    lib/queries/content.ts               │  … then, once the
                            │                            │  session resolves:
                            ▼                            ▼
                        Postgres              GET /api/content   (archived rows)
                                              PATCH /api/…       (every edit)
```

A reader's browser makes **no API calls**. The page is server-rendered
complete, with archived rows stripped by `publicView()`. Only after
`GET /api/session` confirms the visitor owns the site does the client fetch
anything (D-015).

So every route under `app/api/**` requires a session, without exception.
"Does this endpoint need auth?" has one answer rather than a judgement call
per route.

## Four layers, one direction

```
components/**  ──────────────►  lib/api-client.ts
  React, client-heavy               the only module that knows URL shapes
                                            │
                                         HTTP
                                            ▼
app/api/**/route.ts  ─────────►  lib/queries/**  ◄──── app/page.tsx
  await params, parse body,          the only modules that import lib/db
  call ONE query fn, respond                │        (server components may
                                            ▼         read through them)
                                       Postgres
```

Each arrow is enforced, not just documented:

- `components/**` and `app/**` cannot import `lib/db`, `drizzle-orm` or
  `postgres` (ESLint). They may import `lib/queries/**`, which is how the
  server component reads.
- `components/**` cannot call bare `fetch` (ESLint) — everything goes
  through `lib/api-client.ts`, which attaches the token and maps 401 to a
  logout.
- `lib/queries/**` is the only place a `WHERE user_id = …` is written, which
  is what makes `lib/queries/isolation.test.ts` able to cover all of it.

A handler that does more than four things — await `params`, parse the body,
call one query function, shape the response — has logic in the wrong layer.

## Who the user is, twice

Two questions that look the same and are not:

| question                          | answered by         | used by                  |
| --------------------------------- | ------------------- | ------------------------ |
| whose content is being displayed? | `lib/site-owner.ts` | `app/page.tsx`           |
| who is making this request?       | `lib/session.ts`    | every `app/api/**` route |

Keeping them in separate modules is what lets the public page be public
without becoming a query with no user attached to it. `GET /api/session`
reports both, as `user` and `isSiteOwner`, and the UI acts on the second:
a signed-in account that does not own the displayed site gets no edit
layer.

## The edit layer

`components/SiteProvider.tsx` is the container for the whole page. It owns
the content, the admin state and **every network call**; everything below
it is presentational and edits through its callbacks. It is a context
rather than props because the alternative is threading a save callback
five levels down to reach a timeline card's job title.

`components/admin/EditableText.tsx` is the primitive — a
`contenteditable` span that a double-click activates (D-016). Anything that
is not text on the page (a date, an image path) gets an `AdminStrip` of
ordinary inputs under the item instead.

## Two runtimes, two import styles

This trips everyone once. `lib/**` and `scripts/**` run under bare
`node --experimental-strip-types` for `npm test`, `npm run smoke` and
`npm run db:seed`, and Node resolves neither the `@/` alias nor an
extensionless specifier. `app/**` and `components/**` are bundled by
webpack, which resolves both.

So `lib/` uses `'../db/index.ts'` and `app/` uses `'@/lib/api-client'`.
Getting it wrong still typechecks and still builds; it fails only when a
script actually imports the file. ESLint catches it — see
`.claude/rules/imports.md`.

## The auth path

```
browser ── x-app-token ──► middleware.ts   (Edge: is this authenticated at all?)
                                 │
                                 ▼
                         route handler
                                 │  requireUserId(request)
                                 ▼
                         lib/session.ts    (Node: WHICH user is this?)
                                 │
                                 ▼
                         lib/queries/**    (WHERE user_id = …)
```

Middleware is the cheap half and is **not** what keeps accounts apart — it
cannot reach the database (D-004). `lib/session.ts` resolves the caller for
all three auth modes; `lib/auth.ts` holds the Edge-safe crypto and must
never import `node:crypto` (D-007).

Note that `/` is not in the matcher. The page is public and middleware
guards `/api/*` only.

## Pure modules

The most valuable code here has no framework in it: pure functions over
plain data, exhaustively unit-tested, with no DB and no React.
`lib/timeline.ts` is the worked example — the whole date-proportional axis,
including gap collapsing and collision spreading, with 22 tests and no DOM
(D-022). `lib/feedback/issue.ts` and `lib/feedback/user-agent.ts` are the
others.

Reach for that shape before reaching for a hook. If you are about to write a
non-trivial `useMemo`, the calculation probably belongs in `lib/` with a
test.

## What runs where

| command            | runtime                                 | needs                                 |
| ------------------ | --------------------------------------- | ------------------------------------- |
| `npm run dev`      | Next dev server, :3000                  | Postgres, seeded                      |
| `npm test`         | bare node, `--experimental-strip-types` | Postgres (or the DB suites self-skip) |
| `npm run smoke`    | bare node                               | Postgres, seeded                      |
| `npm run test:e2e` | Playwright + its own Next on :3100      | Postgres                              |
| `npm run build`    | webpack                                 | **nothing** — see D-002               |
