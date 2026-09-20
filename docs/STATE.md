# State

Read this first when picking the project up cold. It describes the system
**as it stands** — not a changelog, and not what is planned. If a line here
would need rewording the moment a PR merges, it belongs on the issue instead.

## What this is

Chris Pyle's portfolio site, as a Next.js 15 + Postgres application whose
content lives in the database and is edited in place on the page.

It replaces a statically-exported version of the same site
(`../portfolio`) whose content was two JSON files and five markdown files
in the repo. Visually it is the same site — typography, colours and layout
were compared against the original at 1440px — and every string in it is
now a row.

## What works

- **The public page.** `app/page.tsx` renders the whole portfolio on the
  server from `lib/queries/content.ts` on every request, archived rows
  stripped. No login, no client fetch, no spinner (D-015).
- **Editing in place.** The site owner double-clicks any text on the page
  and edits it where it sits (D-016). Dates, image paths and links, which
  are not text on the page, get a strip of inputs under the item. Projects,
  social links, category chips and timeline entries can be added and
  archived.
- **Auth.** Three modes (`dev` / `password` / `supabase`) resolved in one
  place, `lib/session.ts`. `dev` needs no login and signs in as the seeded
  user, which is why editing just works locally. `password` is a shared
  secret minting an HMAC token, reached at `/login`. `supabase` is a
  written, tested-as-fail-closed seam — `lib/auth-supabase.ts` throws, and
  implementing it is intended to be a one-file change.
- **User isolation.** Every query takes a `userId` and filters on it,
  including the public read, which uses the site owner's
  (`lib/site-owner.ts`). `lib/queries/isolation.test.ts` covers every way
  of addressing a row by id.
- **The timeline axis.** Date-proportional, with multi-year gaps collapsed
  and same-day entries nudged apart. All of it is pure functions in
  `lib/timeline.ts` with 22 unit tests (D-022).
- **Feedback.** The floating button files a GitHub issue, or — with no repo
  configured — writes the report to `feedback/` as markdown with its
  screenshot (D-020). It ships locally only (D-019).
- **The gate.** `npm run verify` runs eight checks, mirrored by CI
  workflows.

## What does not

- **Deployment.** Nothing is deployed. The target is Vercel + Supabase
  Postgres and `docs/DEPLOYMENT.md` is a checklist for it, not a record.
  There is no git remote, and no repository at all yet.
- **`supabase` auth mode.** Written but unimplemented; it rejects every
  request. `lib/auth-supabase.ts` documents what implementing it involves.
  Until then a deployment uses `password` mode, which is a shared secret.
- **Image upload.** Images are files in `public/` and the database stores
  paths to them (D-018). Adding one means adding a file.
- **Reordering in the UI.** `PUT /api/socials` and `PUT /api/projects`
  reorder a whole list and are covered by tests, but nothing in the page
  calls them — there is no drag handle. Order is whatever the seed set.
- **The agent lifecycle.** `.claude/skills/` and `scripts/herd.sh` are
  inherited from the template and assume a GitHub repo whose issues wear
  both a `status:*` label and a type label (`scripts/status.sh
init-labels` creates them). They will not work until there is one.

## Local setup

```bash
cp .env.example .env
docker compose up -d db      # Postgres 17 on :5434
npm ci
npm run db:migrate
npm run db:seed              # creates the user AND the site content
npm run dev                  # :3000, editable immediately (dev auth mode)
```

`npm run db:seed` is what puts the portfolio in the database; it reads
`scripts/seed-data/`, which is the content the old JSON-configured site
shipped with. Nothing renders before it has run.

`npm test` needs `DATABASE_URL` or the query-integration suites self-skip
and the run still reports green. The `test` script passes
`--env-file-if-exists=.env` for exactly that reason.

Port 5434, not 5433: `template-web` uses 5433 and the two are meant to run
side by side.
