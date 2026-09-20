# Schema

**This is a contract.** `lib/db/schema.ts` and `drizzle/*.sql` must match it,
and each other. A disagreement is a bug in one of the three, to be fixed
deliberately and in the same commit — not papered over.

## Conventions

Every table:

- `id uuid primary key default gen_random_uuid()`
- `created_at` / `updated_at`, both `timestamptz not null default now()`
- an `updated_at` trigger: `create trigger set_updated_at before update on <t>
for each row execute function set_updated_at();`

Column names are `snake_case` in SQL and `camelCase` on the wire; Drizzle
maps between them. The API never exposes `user_id` or the timestamps unless
a client actually renders them — `toWire()` in each query module is what
enforces that.

`on delete restrict` on every foreign key. Nothing here is deleted (D-003),
so a cascade is a footgun with no use case.

Editable text columns are `not null default ''`. A freshly-created row is
then a complete row of empty strings rather than a row of nulls that ten
call sites have to special-case. The one exception is `project.external_url`,
where null and `''` would otherwise both mean "no link" and the card's
entire behaviour turns on that test.

## Ownership

**`user_id` lives only on root tables** — the ones not reachable from another
table. Child rows have no owner column and inherit one through a join to
their parent (D-005). One source of truth per fact.

Here the root tables are `site_profile`, `social_link`, `project` and
`timeline_entry`; the only child is `project_category`. When you add a
table, the question to answer is "is this reachable from another row?" — if
yes, no `user_id`.

The public page is not an exception to this. It reads the **site owner's**
rows, resolved by `lib/site-owner.ts`, through the same `WHERE user_id = …`
as everything else (D-015).

## `users`

| column             | type            | notes                                                                             |
| ------------------ | --------------- | --------------------------------------------------------------------------------- |
| `id`               | `uuid` PK       |                                                                                   |
| `email`            | `text` not null | unique on `lower(email)` — identity is case-insensitive                           |
| `name`             | `text`          | nullable                                                                          |
| `supabase_user_id` | `text`          | join key to `auth.users.id`; null until OAuth is wired up. Unique where not null. |

Named `users`, not `user`: `user` is a reserved word in Postgres.

**No password column, and there should never be one.** The `password` auth
mode is a single shared secret held in env, not a per-user credential; real
multi-user auth is external.

## `site_profile`

The page's singular fields. Exactly one row per user, enforced by
`ux_site_profile_user_id`; `getProfile()` creates it on first read, so no
caller handles "this user has no profile yet".

| column              | type            | notes                                 |
| ------------------- | --------------- | ------------------------------------- |
| `id`                | `uuid` PK       |                                       |
| `user_id`           | `uuid` not null | → `users.id`, unique                  |
| `name`              | `text` not null | used in the page title, not on screen |
| `meta_description`  | `text` not null | `<meta name="description">`           |
| `tagline_lead`      | `text` not null | "Hey there, this is"                  |
| `tagline_name`      | `text` not null | the `<h1>`                            |
| `tagline_role`      | `text` not null |                                       |
| `tagline_org`       | `text` not null |                                       |
| `about`             | `text` not null | markdown                              |
| `headshot_path`     | `text` not null | a URL in the media bucket             |
| `resume_image_path` | `text` not null | a URL in the media bucket             |
| `resume_pdf_path`   | `text` not null | a URL in the media bucket             |

The three are absolute URLs into the `portfolio-media` Supabase Storage
bucket (D-024). Images are objects, not rows: the column holds where the
file is, the edit layer uploads the bytes there and writes the URL back,
and nothing is ever deleted from the bucket.

## `social_link`

| column        | type               | notes                              |
| ------------- | ------------------ | ---------------------------------- |
| `id`          | `uuid` PK          |                                    |
| `user_id`     | `uuid` not null    | → `users.id`, `on delete restrict` |
| `label`       | `text` not null    | the button's text                  |
| `url`         | `text` not null    | `mailto:` is expected and handled  |
| `sort_order`  | `integer` not null | position in the owner's list       |
| `is_archived` | `boolean` not null | hides it; never deleted (D-003)    |

## `project`

| column         | type               | notes                                        |
| -------------- | ------------------ | -------------------------------------------- |
| `id`           | `uuid` PK          |                                              |
| `user_id`      | `uuid` not null    | → `users.id`, `on delete restrict`           |
| `title`        | `text` not null    |                                              |
| `subtitle`     | `text` not null    |                                              |
| `image_path`   | `text` not null    | a URL in the media bucket                    |
| `external_url` | `text`             | **nullable**; null means "open the write-up" |
| `writeup`      | `text` not null    | markdown; `''` means the card opens nothing  |
| `sort_order`   | `integer` not null | position in the grid                         |
| `is_archived`  | `boolean` not null |                                              |

Indexed on `user_id`, because every query filters on it.

## `project_category`

| column        | type               | notes                                |
| ------------- | ------------------ | ------------------------------------ |
| `id`          | `uuid` PK          |                                      |
| `project_id`  | `uuid` not null    | → `project.id`, `on delete restrict` |
| `label`       | `text` not null    | one chip                             |
| `sort_order`  | `integer` not null |                                      |
| `is_archived` | `boolean` not null |                                      |

**No `user_id`.** Its owner is `project.user_id`, reached by a join — which
is why `lib/queries/projects.ts` joins back to `project` before writing a
category rather than trusting the id it was handed.

## `timeline_entry`

| column           | type               | notes                                     |
| ---------------- | ------------------ | ----------------------------------------- |
| `id`             | `uuid` PK          |                                           |
| `user_id`        | `uuid` not null    | → `users.id`, `on delete restrict`        |
| `organization`   | `text` not null    |                                           |
| `title`          | `text` not null    |                                           |
| `description`    | `text` not null    | markdown                                  |
| `starts_on`      | `date` not null    | a calendar date, not an instant           |
| `ends_on`        | `date`             | **nullable**; null means "to the present" |
| `kind`           | `text` not null    | `ck_timeline_entry_kind`, four values     |
| `thumbnail_path` | `text` not null    | a URL in the media bucket                 |
| `is_archived`    | `boolean` not null |                                           |

**No `sort_order`.** This list is ordered by `starts_on`, which is what a
timeline is; moving an entry means editing its date. Ties break on `id`,
and they do occur — several entries in the seed share a start date.

`date`, not `timestamptz`: these are calendar facts ("May 2024"). Stored as
instants they render a month early for anyone west of Greenwich.

Two check constraints, both guarding something that would otherwise fail
silently:

- `ck_timeline_entry_kind` — `employment | education | extracurricular |
award`. Each has a badge and dot colour compiled into the UI, so a fifth
  value would render grey with nothing in the data to say it was a typo.
- `ck_timeline_entry_dates` — `ends_on >= starts_on`. A reversed range
  gives `buildScale()` a negative-width segment and every dot after it
  lands in the wrong place. `patchTimelineSchema` deliberately does _not_
  duplicate this check: a PATCH that moves one date has nothing to compare
  against, and the database is the only place that sees both values.
  `withApiErrors` maps the violation (SQLSTATE 23514) to a 400.

## Ordering

`sort_order` is **not unique**, so every `order by sort_order` must break the
tie on `id`. Without it the order changes after any UPDATE, because Postgres
is free to return rows in physical order — which produces a test that fails
once a week and nowhere else.

The same applies to `created_at`: `now()` is transaction-start time, so every
row written in one transaction ties. `scripts/seed.ts` writes an explicit
increasing `created_at` for exactly this reason.

## Adding a table

1. A new numbered file in `drizzle/` — plain SQL, no ORM migration DSL.
2. The matching edit to `lib/db/schema.ts`.
3. The matching edit to this file.
4. Add it to `ALL_SEEDED_TABLES` in `scripts/seed.ts`, or a `--force`
   reseed will leave its rows behind.

Nothing generates one from the other. Then `npm run db:migrate`
(idempotent), `npm run db:seed -- --force`, `npm run smoke`.
