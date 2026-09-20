/**
 * Whose portfolio is this?
 *
 * The app has two audiences and they resolve a user differently. A reader
 * is anonymous, so the content they see belongs to the **site owner**,
 * resolved here. An editor is authenticated, so the content they write
 * belongs to **their own session**, resolved by `lib/session.ts`.
 *
 * Keeping those two answers in separate modules is what stops the public
 * page from ever being a query with no user attached to it (invariant 1).
 * The owner id goes through exactly the same `WHERE user_id = …` as every
 * other read.
 *
 * Server-only: this touches the database.
 */
import { getFirstUser, getUserByEmail } from './queries/users.ts';
import type { User } from './types.ts';

/**
 * `OWNER_EMAIL` if set, otherwise the only/first user — the same rule the
 * password gate uses to decide who a shared password logs in as, so the
 * account you can edit as is always the account whose site is displayed.
 *
 * Returns `null` rather than throwing when the database has no users yet:
 * that is the state a fresh checkout is in before `npm run db:seed`, and
 * the page says so instead of returning a 500 that explains nothing.
 */
export async function getSiteOwner(): Promise<User | null> {
  const ownerEmail = process.env.OWNER_EMAIL?.trim();
  if (ownerEmail) {
    const user = await getUserByEmail(ownerEmail);
    if (!user) {
      console.error(
        `[site-owner] OWNER_EMAIL="${ownerEmail}" does not match any user — the site has no content to show.`,
      );
    }
    return user;
  }

  return getFirstUser();
}

/** Whether `userId` may edit the displayed site. The page is read-only for
 *  any other signed-in account rather than showing edit affordances that
 *  would silently write to a different portfolio. */
export async function isSiteOwner(userId: string): Promise<boolean> {
  const owner = await getSiteOwner();
  return owner?.id === userId;
}
