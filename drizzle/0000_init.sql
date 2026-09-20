-- Initial schema. Hand-written (not `drizzle-kit generate`) so it stays
-- reviewable. Must match lib/db/schema.ts exactly. See docs/SCHEMA.md.
--
-- gen_random_uuid() has been built into Postgres core since PG13, so no
-- extension (pgcrypto) is required on our PG17 target.
--
-- No begin/commit here: scripts/migrate.ts wraps each file in a transaction.

-- ---------------------------------------------------------------------------
-- Shared trigger: every table's updated_at is bumped to now() on any UPDATE.
-- ---------------------------------------------------------------------------

create function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- users
--
-- Named `users`, not `user`, because `user` is a reserved word in Postgres
-- (`select user` returns current_user), which would force quoting forever.
--
-- No password column: the password gate (APP_AUTH_MODE=password) is one
-- shared secret held in env, not a per-user credential, and the real
-- multi-user path is external auth. `supabase_user_id` is the join key to
-- `auth.users.id` and stays null until that is wired up — see
-- lib/auth-supabase.ts.
-- ---------------------------------------------------------------------------

create table users (
  id               uuid primary key default gen_random_uuid(),
  email            text not null,
  name             text,
  supabase_user_id text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Email identity is case-insensitive: Chris@x.com and chris@x.com are one person.
create unique index ux_users_email_lower on users (lower(email));

-- Unique when present, unconstrained while null (pre-OAuth rows).
create unique index ux_users_supabase_user_id
  on users (supabase_user_id) where supabase_user_id is not null;

create trigger set_updated_at before update on users
for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- site_profile — the page's singular fields: hero taglines, the about
-- paragraph, and the paths to the three assets the layout hardcodes.
--
-- One row per user, enforced by a unique index rather than by making
-- `user_id` the primary key: every table here has the same
-- id-plus-timestamps shape, and a table that does not is a table whose
-- queries have to be read twice.
--
-- Every text column is `not null default ''` so a freshly-created profile is
-- a complete row of empty strings rather than a row of nulls the UI has to
-- special-case at ten different call sites.
-- ---------------------------------------------------------------------------

create table site_profile (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references users (id) on delete restrict,
  name               text not null default '',
  meta_description   text not null default '',
  tagline_lead       text not null default '',
  tagline_name       text not null default '',
  tagline_role       text not null default '',
  tagline_org        text not null default '',
  about              text not null default '',
  headshot_path      text not null default '',
  resume_image_path  text not null default '',
  resume_pdf_path    text not null default '',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create unique index ux_site_profile_user_id on site_profile (user_id);

create trigger set_updated_at before update on site_profile
for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- social_link — the buttons under the hero taglines.
--
-- `on delete restrict` on the owner FK, not cascade: content is never deleted
-- here, so removing a user is a deliberate manual operation rather than
-- something a stray query can trigger. Same on every table below.
-- ---------------------------------------------------------------------------

create table social_link (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users (id) on delete restrict,
  label       text not null,
  url         text not null,
  sort_order  integer not null default 0,
  is_archived boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index ix_social_link_user_id on social_link (user_id);

create trigger set_updated_at before update on social_link
for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- project — a card in the Projects grid.
--
-- `external_url` is the only nullable content column in this file: null and
-- '' would otherwise both have to mean "no link", and the card's whole
-- behaviour (link out vs. open the write-up modal) turns on that test.
-- ---------------------------------------------------------------------------

create table project (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users (id) on delete restrict,
  title        text not null,
  subtitle     text not null default '',
  image_path   text not null default '',
  external_url text,
  writeup      text not null default '',
  sort_order   integer not null default 0,
  is_archived  boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index ix_project_user_id on project (user_id);

create trigger set_updated_at before update on project
for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- project_category — a child row with NO user_id. It inherits its owner
-- through a join to its project, so the same fact is never stored twice and
-- the two copies can never disagree.
-- ---------------------------------------------------------------------------

create table project_category (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references project (id) on delete restrict,
  label       text not null,
  sort_order  integer not null default 0,
  is_archived boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index ix_project_category_project_id on project_category (project_id);

create trigger set_updated_at before update on project_category
for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- timeline_entry — a dot on the timeline axis.
--
-- No sort_order: this list is ordered by `starts_on`, which is what the
-- timeline is. Ties break on id like everywhere else.
--
-- `date`, not `timestamptz`: these are calendar facts ("May 2024"). Stored as
-- instants they would render a month early for anyone west of Greenwich,
-- which is the bug the old data file's hand-rolled date parser existed to
-- work around.
--
-- `kind` is constrained here rather than left open because each value has a
-- badge and dot colour compiled into the UI — an unconstrained fifth value
-- would render grey with no way to tell from the data that it was a typo.
-- ---------------------------------------------------------------------------

create table timeline_entry (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users (id) on delete restrict,
  organization   text not null,
  title          text not null,
  description    text not null default '',
  starts_on      date not null,
  ends_on        date,
  kind           text not null,
  thumbnail_path text not null default '',
  is_archived    boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint ck_timeline_entry_kind
    check (kind in ('employment', 'education', 'extracurricular', 'award')),
  -- An entry that ends before it starts breaks the axis maths silently:
  -- `buildScale` would produce a negative-width segment and every dot after
  -- it would land in the wrong place.
  constraint ck_timeline_entry_dates
    check (ends_on is null or ends_on >= starts_on)
);

create index ix_timeline_entry_user_id on timeline_entry (user_id);

create trigger set_updated_at before update on timeline_entry
for each row execute function set_updated_at();
