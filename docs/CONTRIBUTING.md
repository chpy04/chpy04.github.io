# Contributing

How to do the things that come up, in the order they come up.

## The gate

```bash
docker compose up -d db
npm run verify
```

`format:check`, `lint`, `typecheck`, `test`, `build`, reseed, `smoke`,
`test:e2e` — in an order where each step catches what the previous cannot.
Run the whole thing, not a subset (D-009).

Three things worth knowing:

- **`typecheck` is not enough on its own.** `next build` additionally
  validates App Router export signatures and resolves the webpack config. A
  page whose default export takes a custom prop typechecks fine and fails
  the build.
- **`test` needs `DATABASE_URL`.** Without it the `lib/queries` suites
  self-skip and the run still reports green. If your test count drops, your
  `.env` is missing, not your code. CI asserts the skip count is zero.
- **`smoke` reads live database state.** A prior Playwright run leaves
  edited rows behind, hence the reseed before it.

## Adding an endpoint

1. A zod schema in `lib/validation.ts`.
2. A query function in `lib/queries/<resource>.ts` — `userId` first
   parameter, filter on it, return through a `toWire()`.
3. A case in `lib/queries/isolation.test.ts` if it takes an id.
4. A handler in `app/api/<resource>/route.ts`, wrapped in `withApiErrors`,
   starting with `requireUserId(request)`.
5. A function in `lib/api-client.ts`.
6. `docs/API.md`, **in the same commit**.

Then `npm run verify`.

## Adding a table

1. A new numbered plain-SQL file in `drizzle/`.
2. The matching edit to `lib/db/schema.ts`.
3. The matching edit to `docs/SCHEMA.md`.

Nothing generates one from the other — that is the cost of D-001. Then:

```bash
npm run db:migrate          # idempotent; skips what is already applied
npm run db:seed -- --force
npm run smoke
```

Decide the ownership question explicitly: is the new table reachable from
another row? If yes it gets **no** `user_id` and inherits its owner through
a join (D-005).

## Changing the schema of an existing table

Never edit an applied migration — `scripts/migrate.ts` keys on filename, so
an edited file is simply never re-run, and every database that already
applied it silently diverges. Write a new numbered file.

## Adding a colour

A named token in the `@theme` block of `app/globals.css`, named for its
**role** (`--color-danger-line`) not its appearance. A colour used once
still gets a token — that is how drift starts (D-013).

## Writing a test

At the cheapest tier that can prove the thing:

- **Pure logic** → `lib/**/*.test.ts`, no database, always runs.
- **A query** → `lib/queries/*.test.ts`, against a real Postgres, with
  `{ skip: !hasDatabase }` and a top-level `after(closeTestDb)`.
- **A user-visible promise** → `e2e/*.spec.ts`.

If you want an e2e test for a calculation, extract the calculation.

## Committing

Never commit to `main`. Branch `feat/<slug>`, `fix/<slug>` or
`chore/<slug>`. Small imperative commits; reference an issue in the body,
not the subject.

If several agents share the checkout, take a worktree — two
`next dev`/`next build` processes in one checkout corrupt `.next`:

```bash
git worktree add ../<repo>-wt/<slug> -b <type>/<slug> origin/main
ln -s "$PWD/node_modules" ../<repo>-wt/<slug>/node_modules
ln -sfn "$PWD/.env" ../<repo>-wt/<slug>/.env
```

## Documentation

`docs/` is present tense — what exists, never what is planned. Contracts
(`SCHEMA.md`, `API.md`) change in the same commit as the code. Append a
D-entry to `DECISIONS.md` for anything a future reader would want to
reverse. Update `STATE.md` only where your change made something in it
untrue; git is the record that work happened.
