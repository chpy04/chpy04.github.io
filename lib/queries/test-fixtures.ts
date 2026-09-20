/**
 * Shared setup for the `lib/queries/*.test.ts` integration suites. These run
 * against a real Postgres (`DATABASE_URL`, e.g. the docker-compose `db`
 * service) — never mocked. Every test file marks itself `{ skip: ... }` when
 * `DATABASE_URL` is unset so `npm test` still passes without a database.
 *
 * The DB is shared dev infrastructure (other worktrees may be seeding it
 * concurrently), so fixtures here never assume the DB is empty and never
 * touch rows they didn't create themselves. Content rows are never deleted
 * (archive, don't delete) — tests leave their rows behind, tagged with a
 * random suffix so they're easy to spot.
 *
 * Every content row needs an owner, so each fixture takes a `userId`. Most
 * tests use `seedUserId()` — the user `npm run db:seed` creates — while
 * isolation tests call `insertUser()` for a second account to test *against*.
 */
import { randomUUID } from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import { db, sql } from '../db/index.ts';
import {
  project,
  projectCategory,
  socialLink,
  timelineEntry,
  users,
  type TimelineKind,
} from '../db/schema.ts';
import type { User } from '../types.ts';
import { provisionUser } from './users.ts';

export const hasDatabase = Boolean(process.env.DATABASE_URL);

/** Unique-ish tag so fixture rows are identifiable in a shared dev database. */
export function testTag(): string {
  return randomUUID().slice(0, 8);
}

/** The seeded user — the same one `dev` auth mode logs in as. */
export async function seedUserId(): Promise<string> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .orderBy(asc(users.createdAt), asc(users.id))
    .limit(1);
  if (!row) throw new Error('no users seeded — run `npm run db:seed` first');
  return row.id;
}

/** A second account, for proving that one user cannot reach another's data. */
export async function insertUser(tag: string): Promise<User> {
  return provisionUser({ email: `fixture-${tag}@example.test`, name: `Test User ${tag}` });
}

export async function insertProject(
  userId: string,
  tag: string,
  overrides: Partial<{ isArchived: boolean; sortOrder: number }> = {},
) {
  const [row] = await db
    .insert(project)
    .values({
      userId,
      title: `Test Project ${tag}`,
      subtitle: 'fixture subtitle',
      isArchived: overrides.isArchived ?? false,
      sortOrder: overrides.sortOrder ?? 0,
    })
    .returning();
  if (!row) throw new Error('failed to insert test project');
  return row;
}

export async function insertProjectCategory(projectId: string, label: string, sortOrder = 0) {
  const [row] = await db
    .insert(projectCategory)
    .values({ projectId, label, sortOrder })
    .returning();
  if (!row) throw new Error('failed to insert test category');
  return row;
}

export async function insertSocial(userId: string, tag: string, sortOrder = 0) {
  const [row] = await db
    .insert(socialLink)
    .values({ userId, label: `Test ${tag}`, url: `https://example.test/${tag}`, sortOrder })
    .returning();
  if (!row) throw new Error('failed to insert test social link');
  return row;
}

export async function insertTimelineEntry(
  userId: string,
  tag: string,
  overrides: Partial<{ startsOn: string; endsOn: string | null; kind: TimelineKind }> = {},
) {
  const [row] = await db
    .insert(timelineEntry)
    .values({
      userId,
      organization: `Test Org ${tag}`,
      title: `Test Role ${tag}`,
      startsOn: overrides.startsOn ?? '2024-01-01',
      endsOn: overrides.endsOn ?? null,
      kind: overrides.kind ?? 'employment',
    })
    .returning();
  if (!row) throw new Error('failed to insert test timeline entry');
  return row;
}

/** Cleanup for the few tests that need an empty-ish list; categories first,
 *  because the FK is `on delete restrict`. */
export async function deleteProjectRow(id: string): Promise<void> {
  await db.delete(projectCategory).where(eq(projectCategory.projectId, id));
  await db.delete(project).where(eq(project.id, id));
}

/**
 * `postgres.js` keeps its pool (and, per docs, each `db.transaction`'s
 * reserved connection) open indefinitely — required for a long-lived Next.js
 * server, but it means a `node --test` process for these files never exits
 * on its own. Every `*.test.ts` file here calls this from a top-level
 * `after()`.
 */
export async function closeTestDb(): Promise<void> {
  await sql.end({ timeout: 1 });
}
