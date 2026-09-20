# Review

What to look for in a diff here, roughly in the order that finds the most.

Everything below is something that **does not fail loudly** — the things
that do are already covered by `npm run verify`, and re-checking them by eye
is wasted review.

## The five invariants

They are in `CLAUDE.md` and they are all silent. Concretely, in a diff:

1. **A new DELETE.** On content, there should not be one — `isArchived` is
   the mechanism (D-003).
2. **A new escape/sanitise step** on content the user authored. Ask what it
   would do to the rows already in the database.
3. **A `postgres(...)` or `drizzle(...)` call at module scope.** Breaks
   `next build` on any machine with no database (D-002).
4. **A new import in the `middleware.ts` graph.** Anything reachable from it
   that touches `node:crypto` breaks on the Edge runtime, and ESLint can
   only see two files' worth of that graph (D-007).
5. **A query without a `userId` filter.** The commonest real bug, because it
   returns rows either way. Every new id-taking query wants a case in
   `lib/queries/isolation.test.ts`.

## Layering

- Does a component call `fetch`, or import `lib/db`? (ESLint catches both,
  but a `// eslint-disable` does not.)
- Does a route handler do more than: await `params`, parse body, call one
  query function, shape the response?
- Does a query return a spread of the row? `{ ...row, notes }` typechecks
  against the wire type and ships `userId` and timestamps to the browser.

## Ordering

Any new `orderBy` that does not break its tie on `id`. `sort_order` and
`created_at` are both non-unique, and the resulting flake shows up weeks
later somewhere unrelated.

## Contracts

`docs/SCHEMA.md`, `docs/API.md` — changed in the **same commit** as the code,
or not changed because nothing they describe moved. A PR that edits a
handler and not `API.md` is one of those two, and it is worth knowing which.

## Comments

The convention here is that comments explain **why**, and the density is
high. A non-obvious decision with no comment naming its reason is the thing
that gets "cleaned up" by the next reader. A comment restating the code is
the opposite problem.

## Tests

- New behaviour without a test at the cheapest tier that could prove it.
- An e2e test for something that is really a calculation — extract it.
- A query test that mocks the database. It asserts nothing; the `WHERE`
  clause is the thing under test (D-008).
