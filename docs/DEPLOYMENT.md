# Deployment

A checklist, not a record — nothing here is deployed yet. The target is
Vercel for the app and Supabase for Postgres.

## What has to be true

| variable           | required                  | notes                                                                     |
| ------------------ | ------------------------- | ------------------------------------------------------------------------- |
| `DATABASE_URL`     | always                    | Supabase's pooler is fine — the client sets `prepare: false`              |
| `APP_AUTH_MODE`    | no                        | defaults to `password` in production (D-006)                              |
| `APP_PASSWORD`     | in `password` mode        | long and random; a missing value rejects every login                      |
| `AUTH_SECRET`      | in `password` mode        | long and random; rotating it signs the owner out                          |
| `OWNER_EMAIL`      | once there is >1 user     | which account the shared password logs in as, **and whose site is shown** |
| `FEEDBACK_ENABLED` | no                        | defaults off on Vercel (D-019); set `true` to opt a preview back in       |
| `GITHUB_TOKEN`     | only where feedback is on | Issues:write + Contents:write on `GITHUB_REPO`                            |
| `GITHUB_REPO`      | only where feedback is on | `owner/name`                                                              |

Everything fails **closed**. A missing `APP_PASSWORD` or `AUTH_SECRET`
rejects every login and logs why.

`OWNER_EMAIL` does double duty here and is worth setting deliberately: it
decides both who the password logs in as and, through
`lib/site-owner.ts`, whose content the public page renders. With one user
it can stay unset.

## Supabase

1. Create the project and take the **pooled** connection string
   (Supavisor, port 6543) for `DATABASE_URL`. `lib/db/index.ts` already
   sets `prepare: false`, which transaction-pooling mode requires, and
   `max: 1` when `VERCEL` is set.
2. Run the migrations against it: `DATABASE_URL=… npm run db:migrate`.
   They are idempotent and hand-written, so read them first.
3. Create the owner and seed the content: `DATABASE_URL=… npm run db:seed`.
   **Not `--force`** — that truncates every table.

Supabase Auth is not used. The `users` table has a `supabase_user_id`
column waiting for it and `lib/auth-supabase.ts` is the one file to write
(D-006); until then the deployment is `password` mode.

## Vercel

1. Set the environment variables above. Leave `FEEDBACK_ENABLED` unset.
2. Deploy. `next build` runs with no `DATABASE_URL` on purpose (D-002) — if
   the build starts failing on a missing database, something got hoisted to
   module scope.
3. The page is `force-dynamic` (D-015), so every request hits Postgres.
   That is what makes an edit appear without a redeploy. If it ever needs
   caching, the place to add it is a revalidate tag busted by the write
   paths — not `export const revalidate`, which would make edits appear
   late and unpredictably.

## After the first deploy

- Sign in at `/login` with `APP_PASSWORD` to get the edit layer. There is
  no link to it from the page, by design.
- Images are files under `public/` (D-018), so adding one is a commit and a
  redeploy. Editing the _path_ to one is not.
