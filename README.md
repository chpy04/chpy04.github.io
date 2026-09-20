# portfolio-app

Chris Pyle's portfolio, as an application rather than a static export. The
content lives in Postgres and the owner edits it by double-clicking the page.

Built on [`template-web`](../../template-web), whose agent harness
(`.claude/rules/`, `.claude/skills/`, the merge gate) comes along with it.

## Run it

```bash
cp .env.example .env
docker compose up -d db      # Postgres 17 on :5434
npm ci
npm run db:migrate
npm run db:seed              # creates the owner AND the site content
npm run dev                  # http://localhost:3000
```

`npm run db:seed` is what puts the portfolio in the database — it reads
`scripts/seed-data/`, the JSON and markdown the previous statically-exported
site was configured with. Nothing renders before it has run.

Locally you are signed in automatically (`dev` auth mode), so the page is
editable straight away.

## Editing

Every string on the page is a row. With the edit layer on — the switch in
the bottom-left corner, on by default for the owner:

- **Double-click any text** to edit it in place. Enter saves, Escape
  abandons, clicking away saves.
- **Dates, links and image paths** are not text on the page, so they get a
  strip of inputs under the item they belong to.
- **Add** a project, social link, category chip or timeline entry with the
  dashed `+` buttons.
- **Archive** instead of deleting. Nothing is ever removed; "Show archived"
  brings it back.
- **Turn editing off** to browse your own site normally — while it is on,
  project cards are not links, which is what makes their titles clickable.

Images are files under `public/`; the database stores the path. Adding a new
image means adding a file (D-018).

## Where things are

| path                          | what                                                             |
| ----------------------------- | ---------------------------------------------------------------- |
| `app/page.tsx`                | the whole page, server-rendered from the database                |
| `components/SiteProvider.tsx` | owns the content and every network call                          |
| `components/admin/`           | the edit layer — `EditableText` is the primitive                 |
| `components/portfolio/`       | the page itself                                                  |
| `lib/queries/`                | the only modules that touch the database                         |
| `lib/timeline.ts`             | the date-proportional axis, as pure functions                    |
| `scripts/seed-data/`          | the content the site ships with                                  |
| `docs/`                       | contracts (`SCHEMA.md`, `API.md`) and reasoning (`DECISIONS.md`) |

Start with `docs/STATE.md`, then `docs/ARCHITECTURE.md`.

## The gate

```bash
npm run verify
```

`format:check`, `lint`, `typecheck`, `test`, `build`, reseed, `smoke`,
`test:e2e`. Run the whole thing — each step catches something the previous
one cannot. Needs `docker compose up -d db`.

## Feedback

The floating "Give feedback" button is a **local-only** development tool
(D-019): describe what is wrong, drop or paste a screenshot on it, and it
files a GitHub issue. With no `GITHUB_TOKEN`/`GITHUB_REPO` configured — the
current state — it writes the report to `feedback/` as markdown with the
screenshot beside it (D-020), where an agent can read it.

It does not ship to Vercel.

## Deploying

Not deployed yet. `docs/DEPLOYMENT.md` is the checklist: Supabase Postgres,
Vercel, `password` auth mode until `lib/auth-supabase.ts` is written.
