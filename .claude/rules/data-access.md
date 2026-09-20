---
paths:
  - 'lib/queries/**'
  - 'lib/db/**'
  - 'drizzle/**'
---

# Data access

`docs/SCHEMA.md` is the contract. `lib/queries/**` is the only place allowed
to import `lib/db` — ESLint enforces that boundary from the other side.

`lib/queries/projects.ts` is the worked example for everything below. Read
it before writing a new query module; it is meant to be copied.

There are four content modules — `profile.ts`, `socials.ts`, `projects.ts`,
`timeline.ts` — plus `content.ts`, which composes them for the public page
and contains no SQL of its own. Keep it that way: the `WHERE user_id = …`
that keeps accounts apart stays written once per table.

## Every query takes a `userId`

It is the **first parameter** of every exported function, and every
statement filters on it — directly, or through a join to the parent.

A missing filter is silent: the query still returns rows, just somebody
else's. `lib/queries/isolation.test.ts` holds one case per way of addressing
a row by id, and **you add to it when you add a query**. That file is the
executable form of invariant 5 in `CLAUDE.md`.

## Ownership lives on root tables only

Root tables (the ones not reachable from another table) carry `user_id`.
Child rows carry none and inherit their owner through a join to their parent
(D-005). One source of truth per fact: a `user_id` on a child could
contradict its parent's, and nothing would notice.

Here that is `project` (root, has `user_id`) and `project_category`
(child, does not). So a category query joins back to `project`:

```ts
const [row] = await db
  .select({ projectId: projectCategory.projectId })
  .from(projectCategory)
  .innerJoin(project, eq(project.id, projectCategory.projectId))
  .where(and(eq(projectCategory.id, categoryId), eq(project.userId, userId)))
  .limit(1);
if (!row) throw new NotFoundError(`category ${categoryId} not found`);
```

**Ids arriving in a request body are the subtle path.** They carry no owner,
and nothing was looked up before the write. Re-check every one of them
against the caller first — `reorderProjects` does. Skipping that check lets
one user reorder, or adopt, another's rows.

## Never return a raw DB row

Every exported query maps rows through a local `toWire()` before returning.
A spread (`{ ...row, notes }`) typechecks fine against the wire type and
still ships `userId`, `createdAt` and foreign keys to the browser, silently
widening the API past `docs/API.md`.

```ts
function toWire(row: typeof project.$inferSelect, categories: ProjectCategory[]): Project {
  return { id: row.id, title: row.title, /* … */ categories };
}
```

Row types are derived at the use site with `typeof table.$inferSelect`.
Don't build a library of exported `*Record` aliases; they go stale unused.

## Break every ordering tie on `id`

```ts
.orderBy(asc(projectCategory.sortOrder), asc(projectCategory.id))
```

`sort_order` is not unique and `created_at` ties for every row written in
one transaction (`now()` is transaction-start time). An unbroken tie lets
Postgres return rows in physical order, which changes after any UPDATE —
producing a test that fails once a week and nowhere near the cause.

## Errors

Throw `NotFoundError` for a missing row and `BadRequestError` for a request
that is well-formed but refers to something invalid. Both come from
`lib/queries/errors.ts` and the route layer maps them. A bare
`throw new Error()` is a 500 — use it only for "this cannot happen"
invariants.

**Another user's row is a `NotFoundError`, never a 403.** A 403 confirms the
id exists.

## Archive, never delete

No content row is deleted. `is_archived` hides it from pickers; anything
that already references it keeps working (D-003). Note that the query layer
deliberately does **not** filter archived rows out — a caller that cannot
see an archived row cannot un-archive it either. Filtering is the UI's job.

## The DB client must stay lazy

`lib/db/index.ts` exports Proxies that construct the `postgres()` client on
first query and cache it on `globalThis`. Never hoist a
`postgres(...)`/`drizzle(...)` call to module scope: `next build` evaluates
every route module while collecting page data, so an eager client breaks the
build on any machine without a live `DATABASE_URL`, including CI (D-002).

## Migrations

Two independent sources of truth that must be kept in agreement by hand:

1. A new numbered plain-SQL file in `drizzle/` (no ORM migration DSL).
2. The matching edit to `lib/db/schema.ts`.

Nothing generates one from the other (D-001). **Never edit an applied
migration** — `scripts/migrate.ts` keys on filename, so an edited file is
simply never re-run and every database that already applied it diverges in
silence.

Then `npm run db:migrate` (idempotent), `npm run db:seed -- --force`, and
`npm run smoke`.
