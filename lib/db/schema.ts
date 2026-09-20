/**
 * Drizzle table definitions. This file and `drizzle/0000_init.sql` must agree
 * exactly — nothing generates one from the other. See docs/SCHEMA.md for the
 * contract they both implement.
 */

import { isNotNull, relations, sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

/** Every row gets these; maintained by the shared `set_updated_at()` trigger. */
const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

/**
 * Every root-level table carries its owner. `restrict`, not `cascade`:
 * content is archived rather than deleted, so removing a user is a
 * deliberate manual operation rather than something a stray query triggers.
 */
const owner = {
  userId: uuid('user_id')
    .notNull()
    .references((): AnyPgColumn => users.id, { onDelete: 'restrict' }),
};

/** What every piece of editable content carries: a position in its list and
 *  the archive flag that stands in for deletion (D-003). */
const listed = {
  sortOrder: integer('sort_order').notNull().default(0),
  isArchived: boolean('is_archived').notNull().default(false),
};

// ---------------------------------------------------------------------------
// Users
//
// `users`, not `user`: `user` is a reserved word in Postgres. No password
// column — see the migration. `supabaseUserId` is the join key to
// `auth.users.id` and is null until external auth is wired up.
// ---------------------------------------------------------------------------

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    name: text('name'),
    supabaseUserId: text('supabase_user_id'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('ux_users_email_lower').on(sql`lower(${t.email})`),
    uniqueIndex('ux_users_supabase_user_id')
      .on(t.supabaseUserId)
      .where(isNotNull(t.supabaseUserId)),
  ],
);

// ---------------------------------------------------------------------------
// site_profile — the singular fields of the page: the hero taglines, the
// about paragraph, and the paths to the three assets the layout hardcodes.
//
// Exactly one row per user (unique index, not a primary key on `user_id`, so
// the table keeps the same `id`-plus-timestamps shape as everything else).
// `getSiteContent` creates the row on first read rather than making every
// caller handle "the owner has no profile yet".
// ---------------------------------------------------------------------------

export const siteProfile = pgTable(
  'site_profile',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...owner,
    name: text('name').notNull().default(''),
    metaDescription: text('meta_description').notNull().default(''),
    taglineLead: text('tagline_lead').notNull().default(''),
    taglineName: text('tagline_name').notNull().default(''),
    taglineRole: text('tagline_role').notNull().default(''),
    taglineOrg: text('tagline_org').notNull().default(''),
    about: text('about').notNull().default(''),
    headshotPath: text('headshot_path').notNull().default(''),
    resumeImagePath: text('resume_image_path').notNull().default(''),
    resumePdfPath: text('resume_pdf_path').notNull().default(''),
    ...timestamps,
  },
  (t) => [uniqueIndex('ux_site_profile_user_id').on(t.userId)],
);

// ---------------------------------------------------------------------------
// social_link — the buttons under the hero taglines.
// ---------------------------------------------------------------------------

export const socialLink = pgTable(
  'social_link',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...owner,
    label: text('label').notNull(),
    url: text('url').notNull(),
    ...listed,
    ...timestamps,
  },
  (t) => [index('ix_social_link_user_id').on(t.userId)],
);

// ---------------------------------------------------------------------------
// project / project_category
//
// `project` is a root table: it carries `user_id`, and `lib/queries/projects.ts`
// filters every statement on it. `project_category` is a child: it has no
// owner column and inherits one through its project, which is why every
// category query joins back to `project` instead of trusting the id it was
// handed.
//
// A project either links out (`externalUrl`) or opens a write-up modal
// (`writeup`); `lib/queries/projects.ts` documents what happens when it has
// both.
// ---------------------------------------------------------------------------

export const project = pgTable(
  'project',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...owner,
    title: text('title').notNull(),
    subtitle: text('subtitle').notNull().default(''),
    imagePath: text('image_path').notNull().default(''),
    externalUrl: text('external_url'),
    /** Markdown, rendered in the details modal. Empty means "no write-up". */
    writeup: text('writeup').notNull().default(''),
    ...listed,
    ...timestamps,
  },
  (t) => [index('ix_project_user_id').on(t.userId)],
);

export const projectCategory = pgTable(
  'project_category',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references((): AnyPgColumn => project.id, { onDelete: 'restrict' }),
    label: text('label').notNull(),
    ...listed,
    ...timestamps,
  },
  (t) => [index('ix_project_category_project_id').on(t.projectId)],
);

// ---------------------------------------------------------------------------
// timeline_entry — the dots on the timeline axis.
//
// No `sort_order`: the timeline is ordered by `starts_on`, which is the whole
// point of it. Ties break on `id` like everywhere else.
//
// `starts_on`/`ends_on` are `date`, not `timestamptz`: these are calendar
// facts ("May 2024"), and storing them as instants would shift them across a
// month boundary for anyone west of Greenwich. Drizzle hands them over as
// 'YYYY-MM-DD' strings, which is what the axis maths parses.
// ---------------------------------------------------------------------------

export const TIMELINE_KINDS = ['employment', 'education', 'extracurricular', 'award'] as const;

export type TimelineKind = (typeof TIMELINE_KINDS)[number];

export const timelineEntry = pgTable(
  'timeline_entry',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...owner,
    organization: text('organization').notNull(),
    title: text('title').notNull(),
    /** Markdown. Rendered sanitized — see components/portfolio/Markdown.tsx. */
    description: text('description').notNull().default(''),
    startsOn: date('starts_on').notNull(),
    /** Null means "to the present", which the axis renders differently. */
    endsOn: date('ends_on'),
    kind: text('kind').notNull(),
    thumbnailPath: text('thumbnail_path').notNull().default(''),
    isArchived: boolean('is_archived').notNull().default(false),
    ...timestamps,
  },
  (t) => [index('ix_timeline_entry_user_id').on(t.userId)],
);

// ---------------------------------------------------------------------------
// Relations. Only needed for drizzle's relational query builder; the query
// modules here mostly use explicit joins, which are easier to read against
// docs/SCHEMA.md.
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many, one }) => ({
  profile: one(siteProfile),
  socials: many(socialLink),
  projects: many(project),
  timeline: many(timelineEntry),
}));

export const siteProfileRelations = relations(siteProfile, ({ one }) => ({
  user: one(users, { fields: [siteProfile.userId], references: [users.id] }),
}));

export const socialLinkRelations = relations(socialLink, ({ one }) => ({
  user: one(users, { fields: [socialLink.userId], references: [users.id] }),
}));

export const projectRelations = relations(project, ({ one, many }) => ({
  user: one(users, { fields: [project.userId], references: [users.id] }),
  categories: many(projectCategory),
}));

export const projectCategoryRelations = relations(projectCategory, ({ one }) => ({
  project: one(project, { fields: [projectCategory.projectId], references: [project.id] }),
}));

export const timelineEntryRelations = relations(timelineEntry, ({ one }) => ({
  user: one(users, { fields: [timelineEntry.userId], references: [users.id] }),
}));
