/**
 * `project` + `project_category`: the cards in the Projects grid.
 *
 * The parent/child pair in this codebase, and the one to copy when you add
 * another. Four things it demonstrates, all of which are silent when you get
 * them wrong:
 *
 *   1. `userId` is the first parameter of every exported function, and every
 *      statement filters on it. A missing filter still returns rows — just
 *      somebody else's.
 *   2. `project_category` has no `user_id`. Category queries reach ownership
 *      through a join to `project`, so the owner of a category is stored
 *      exactly once.
 *   3. Rows never leave as rows. `toWire()` picks fields explicitly; a spread
 *      would typecheck and quietly ship `userId` and timestamps to the
 *      browser.
 *   4. Nothing is deleted. `isArchived` hides a row; archiving is the whole
 *      of "delete".
 */
import { and, asc, eq, inArray, sql as raw } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { project, projectCategory } from '../db/schema.ts';
import type { Project, ProjectCategory } from '../types.ts';
import { BadRequestError, NotFoundError } from './errors.ts';

function toWire(row: typeof project.$inferSelect, categories: ProjectCategory[]): Project {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    imagePath: row.imagePath,
    externalUrl: row.externalUrl,
    writeup: row.writeup,
    isArchived: row.isArchived,
    categories,
  };
}

function categoryToWire(row: typeof projectCategory.$inferSelect): ProjectCategory {
  return { id: row.id, label: row.label, isArchived: row.isArchived };
}

/** Categories for a set of projects, grouped by project id. One query, not
 *  one per project — the N+1 is invisible at three and painful at three
 *  hundred. */
async function categoriesFor(projectIds: string[]): Promise<Map<string, ProjectCategory[]>> {
  const grouped = new Map<string, ProjectCategory[]>();
  if (projectIds.length === 0) return grouped;

  const rows = await db
    .select()
    .from(projectCategory)
    .where(inArray(projectCategory.projectId, projectIds))
    // The id breaks the tie; `sort_order` is not unique.
    .orderBy(asc(projectCategory.sortOrder), asc(projectCategory.id));

  for (const row of rows) {
    const list = grouped.get(row.projectId) ?? [];
    list.push(categoryToWire(row));
    grouped.set(row.projectId, list);
  }
  return grouped;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function listProjects(userId: string): Promise<Project[]> {
  const rows = await db
    .select()
    .from(project)
    .where(eq(project.userId, userId))
    .orderBy(asc(project.sortOrder), asc(project.id));

  const categories = await categoriesFor(rows.map((row) => row.id));
  return rows.map((row) => toWire(row, categories.get(row.id) ?? []));
}

/** `NotFoundError` for both "no such project" and "somebody else's project"
 *  — a 403 would confirm the id is real. */
export async function getProject(userId: string, id: string): Promise<Project> {
  const [row] = await db
    .select()
    .from(project)
    .where(and(eq(project.id, id), eq(project.userId, userId)))
    .limit(1);
  if (!row) throw new NotFoundError(`project ${id} not found`);

  const categories = await categoriesFor([row.id]);
  return toWire(row, categories.get(row.id) ?? []);
}

export interface NewProject {
  title: string;
  subtitle?: string;
  imagePath?: string;
  externalUrl?: string | null;
  writeup?: string;
}

export async function createProject(userId: string, data: NewProject): Promise<Project> {
  const [row] = await db
    .insert(project)
    .values({
      userId,
      title: data.title,
      subtitle: data.subtitle ?? '',
      imagePath: data.imagePath ?? '',
      externalUrl: data.externalUrl ?? null,
      writeup: data.writeup ?? '',
      sortOrder: raw`(select coalesce(max(${project.sortOrder}), -1) + 1 from ${project} where ${project.userId} = ${userId})`,
    })
    .returning();
  if (!row) throw new Error('failed to create project');
  return toWire(row, []);
}

export type ProjectPatch = Partial<{
  title: string;
  subtitle: string;
  imagePath: string;
  externalUrl: string | null;
  writeup: string;
  isArchived: boolean;
}>;

export async function updateProject(
  userId: string,
  id: string,
  patch: ProjectPatch,
): Promise<Project> {
  const [row] = await db
    .update(project)
    .set(patch)
    .where(and(eq(project.id, id), eq(project.userId, userId)))
    .returning();
  if (!row) throw new NotFoundError(`project ${id} not found`);

  const categories = await categoriesFor([row.id]);
  return toWire(row, categories.get(row.id) ?? []);
}

/**
 * The whole of "delete". There is no DELETE on content here — archiving
 * hides the card while anything that already references it keeps working.
 * See .claude/rules/data-access.md.
 */
export async function archiveProject(userId: string, id: string): Promise<Project> {
  return updateProject(userId, id, { isArchived: true });
}

/** See `reorderSocials` — same contract, same reasoning. */
export async function reorderProjects(userId: string, orderedIds: string[]): Promise<Project[]> {
  if (orderedIds.length === 0) return listProjects(userId);

  const owned = await db
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.userId, userId), inArray(project.id, orderedIds)));

  if (owned.length !== new Set(orderedIds).size || owned.length !== orderedIds.length) {
    throw new BadRequestError('one or more project ids do not exist');
  }

  await db.transaction(async (tx) => {
    for (const [index, id] of orderedIds.entries()) {
      await tx
        .update(project)
        .set({ sortOrder: index })
        .where(and(eq(project.id, id), eq(project.userId, userId)));
    }
  });

  return listProjects(userId);
}

// ---------------------------------------------------------------------------
// Categories — the child rows, which carry no owner of their own.
// ---------------------------------------------------------------------------

/** `project_category` has no `user_id`, so "does this category belong to the
 *  caller" is a join, and it is the only way to ask. */
async function requireOwnedCategory(userId: string, categoryId: string): Promise<string> {
  const [row] = await db
    .select({ projectId: projectCategory.projectId })
    .from(projectCategory)
    .innerJoin(project, eq(project.id, projectCategory.projectId))
    .where(and(eq(projectCategory.id, categoryId), eq(project.userId, userId)))
    .limit(1);
  if (!row) throw new NotFoundError(`category ${categoryId} not found`);
  return row.projectId;
}

export async function createProjectCategory(
  userId: string,
  projectId: string,
  label: string,
): Promise<ProjectCategory> {
  // Confirm the parent is the caller's before writing a child under it.
  await getProject(userId, projectId);

  const [row] = await db
    .insert(projectCategory)
    .values({
      projectId,
      label,
      sortOrder: raw`(select coalesce(max(${projectCategory.sortOrder}), -1) + 1 from ${projectCategory} where ${projectCategory.projectId} = ${projectId})`,
    })
    .returning();
  if (!row) throw new Error('failed to create category');
  return categoryToWire(row);
}

export async function updateProjectCategory(
  userId: string,
  categoryId: string,
  patch: Partial<{ label: string; isArchived: boolean }>,
): Promise<ProjectCategory> {
  await requireOwnedCategory(userId, categoryId);

  const [row] = await db
    .update(projectCategory)
    .set(patch)
    .where(eq(projectCategory.id, categoryId))
    .returning();
  if (!row) throw new NotFoundError(`category ${categoryId} not found`);
  return categoryToWire(row);
}
