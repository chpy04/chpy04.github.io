---
paths:
  - '**/*.test.ts'
  - 'e2e/**'
  - 'scripts/**'
  - 'playwright.config.ts'
---

# Tests

Three tiers, three purposes. No mocking framework, no assertion library —
`node:test` + `node:assert/strict` and Playwright, nothing else (D-008).

## `lib/**/*.test.ts` — `npm test`

Runs under `node --experimental-strip-types`, so imports need explicit
`.ts` extensions (see `.claude/rules/imports.md`).

Two kinds live side by side:

- **Pure logic** (`auth`, `auth-mode`, `feedback/issue`, `feedback/drag`,
  `feedback/user-agent`, `feedback/github`) — no DB, always runs.
- **Query integration** (`lib/queries/*.test.ts`, `lib/session.test.ts`) —
  hits a **real Postgres**, never a mock. Each file self-skips via
  `{ skip: !process.env.DATABASE_URL }` when there is no database.

That skip is a trap worth knowing: without `DATABASE_URL` those suites
vanish and `npm test` still reports green. The `test` script passes
`--env-file-if-exists=.env` for exactly that reason, and CI asserts the
skip count is **zero**. If your test count drops, your `.env` is missing,
not your code.

Fixtures (`lib/queries/test-fixtures.ts`) never assume an empty database and
never touch rows they did not create — the dev DB is shared between
worktrees. Rows are tagged with a random suffix. Every DB test file needs a
top-level `after(closeTestDb)` or the process will not exit.

**`lib/queries/isolation.test.ts` is special.** It is the executable form of
"every query is scoped to a user", and the first thing to run after touching
anything under `lib/queries/`. Add a case whenever you add a query that
takes an id.

## `e2e/**` — `npx playwright test`

One spec per behavioural promise. They drive the real UI against a real dev
server and a real Postgres — `docker compose up -d db` must already be
running; `globalSetup` seeds and `webServer` starts Next on :3100 under
`APP_AUTH_MODE=password`.

Shared helpers go in `e2e/support.ts` (`signIn`, `editInPlace`,
`uniqueTitle`). Assert on user-visible behaviour, and where the claim is
"this actually reached the database", **reload the page** rather than
trusting React state.

Give rows a unique title (`uniqueTitle`) — the database is shared and a
fixed string collides with itself on the second run.

These tests mutate seeded content. Reseed before running `npm run smoke`.

## `scripts/smoke.ts` — `npm run smoke`

Not a unit test: the acceptance bar. It reads **live** database state
through the query layer and asserts the app's core promise still holds —
catching migrations that were never applied, seeds that no longer match the
schema, and orderings that only tie in real data.

**Replace its assertions when you replace the demo resource.** A smoke test
asserting nothing about your app is worse than none: it is a green check
that means nothing.

## Adding a test

New behaviour needs a test at the cheapest tier that can prove it. Pure
logic belongs in `lib/`, not in a Playwright spec — if you find yourself
wanting an e2e test for a calculation, extract the calculation.
