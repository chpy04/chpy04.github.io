/**
 * `social_link`: the buttons under the hero taglines.
 *
 * The simplest of the four content modules, and the one to read first — it
 * is the whole pattern with nothing else in the way: `userId` first
 * parameter, every statement filtered on it, `toWire()` picking fields
 * explicitly, archive instead of delete, and ordering ties broken on `id`.
 */
import { and, asc, eq, inArray, sql as raw } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { socialLink } from '../db/schema.ts';
import type { SocialLink } from '../types.ts';
import { BadRequestError, NotFoundError } from './errors.ts';

function toWire(row: typeof socialLink.$inferSelect): SocialLink {
  return { id: row.id, label: row.label, url: row.url, isArchived: row.isArchived };
}

/**
 * Every link the caller owns, archived ones included — hiding them is the
 * UI's decision, and a caller that cannot see an archived row also cannot
 * un-archive it.
 */
export async function listSocials(userId: string): Promise<SocialLink[]> {
  const rows = await db
    .select()
    .from(socialLink)
    .where(eq(socialLink.userId, userId))
    // The id breaks the tie; `sort_order` is not unique.
    .orderBy(asc(socialLink.sortOrder), asc(socialLink.id));
  return rows.map(toWire);
}

export async function createSocial(
  userId: string,
  data: { label: string; url: string },
): Promise<SocialLink> {
  // Append to the end of the caller's own list. `max(...) + 1` inside the
  // INSERT rather than a read-then-write, so two concurrent creates cannot
  // both claim the same position.
  const [row] = await db
    .insert(socialLink)
    .values({
      userId,
      label: data.label,
      url: data.url,
      sortOrder: raw`(select coalesce(max(${socialLink.sortOrder}), -1) + 1 from ${socialLink} where ${socialLink.userId} = ${userId})`,
    })
    .returning();
  if (!row) throw new Error('failed to create social link');
  return toWire(row);
}

/** `NotFoundError` for both "no such link" and "somebody else's link" — a
 *  403 would confirm the id is real. */
export async function updateSocial(
  userId: string,
  id: string,
  patch: Partial<{ label: string; url: string; isArchived: boolean }>,
): Promise<SocialLink> {
  const [row] = await db
    .update(socialLink)
    .set(patch)
    .where(and(eq(socialLink.id, id), eq(socialLink.userId, userId)))
    .returning();
  if (!row) throw new NotFoundError(`social link ${id} not found`);
  return toWire(row);
}

/**
 * Rewrites `sort_order` from array position — position **is** the order, so
 * the client sends the whole list and never computes an index.
 *
 * One transaction, and every id is re-checked against the caller first: the
 * ids arrive in a request body, and an id belonging to somebody else would
 * otherwise be silently reordered (or worse, adopted) here.
 */
export async function reorderSocials(userId: string, orderedIds: string[]): Promise<SocialLink[]> {
  if (orderedIds.length === 0) return listSocials(userId);

  const owned = await db
    .select({ id: socialLink.id })
    .from(socialLink)
    .where(and(eq(socialLink.userId, userId), inArray(socialLink.id, orderedIds)));

  // `!==`, not `<`: a duplicate id in the body would pass a length-only check
  // against a de-duplicated result set and leave two rows sharing a position.
  if (owned.length !== new Set(orderedIds).size || owned.length !== orderedIds.length) {
    throw new BadRequestError('one or more social link ids do not exist');
  }

  await db.transaction(async (tx) => {
    for (const [index, id] of orderedIds.entries()) {
      await tx
        .update(socialLink)
        .set({ sortOrder: index })
        .where(and(eq(socialLink.id, id), eq(socialLink.userId, userId)));
    }
  });

  return listSocials(userId);
}
