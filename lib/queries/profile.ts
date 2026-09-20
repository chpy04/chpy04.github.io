/**
 * `site_profile`: the page's singular fields — hero taglines, the about
 * paragraph, and the asset paths the layout hardcodes.
 *
 * One row per user. Unlike every other resource here there is no create
 * endpoint: `getProfile` makes the row if it is missing, so no caller ever
 * has to handle "this user has no profile yet". That is what lets the page
 * render (empty, editable) for a brand-new account instead of 404ing.
 */
import { eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { siteProfile } from '../db/schema.ts';
import type { SiteProfile } from '../types.ts';

type ProfileRow = typeof siteProfile.$inferSelect;

/** Row -> wire. Explicit rather than `{ ...row }`: the row carries `userId`
 *  and timestamps that have no business leaving the server. */
function toWire(row: ProfileRow): SiteProfile {
  return {
    id: row.id,
    name: row.name,
    metaDescription: row.metaDescription,
    taglineLead: row.taglineLead,
    taglineName: row.taglineName,
    taglineRole: row.taglineRole,
    taglineOrg: row.taglineOrg,
    about: row.about,
    headshotPath: row.headshotPath,
    resumeImagePath: row.resumeImagePath,
    resumePdfPath: row.resumePdfPath,
  };
}

/**
 * The caller's profile, created empty on first read.
 *
 * `on conflict do nothing` then select, rather than select-then-insert: two
 * concurrent first requests would both see no row and the second insert
 * would fail on `ux_site_profile_user_id`. This way the loser of that race
 * simply reads what the winner wrote.
 */
export async function getProfile(userId: string): Promise<SiteProfile> {
  const [inserted] = await db
    .insert(siteProfile)
    .values({ userId })
    .onConflictDoNothing({ target: siteProfile.userId })
    .returning();
  if (inserted) return toWire(inserted);

  const [row] = await db.select().from(siteProfile).where(eq(siteProfile.userId, userId)).limit(1);
  // Unreachable: the insert above either wrote the row or lost to one that
  // exists. Throwing beats a non-null assertion that hides a real bug.
  if (!row) throw new Error(`site_profile for user ${userId} vanished mid-request`);
  return toWire(row);
}

export type ProfilePatch = Partial<Omit<SiteProfile, 'id'>>;

/**
 * Patches whichever fields were sent. Creates the row first for the same
 * reason `getProfile` does — an edit is a perfectly normal first write for a
 * new account, and a 404 there would be a dead end with no way out.
 */
export async function updateProfile(userId: string, patch: ProfilePatch): Promise<SiteProfile> {
  await getProfile(userId);

  const [row] = await db
    .update(siteProfile)
    .set(patch)
    .where(eq(siteProfile.userId, userId))
    .returning();
  if (!row) throw new Error(`site_profile for user ${userId} vanished mid-request`);
  return toWire(row);
}
