/**
 * The page in one read.
 *
 * `app/page.tsx` renders on the server and needs all four resources at once;
 * fetching them one endpoint at a time would waterfall four round trips into
 * the first paint of a page whose whole job is to load fast. So this module
 * composes the other four rather than adding any data access of its own —
 * there is no SQL here, which is deliberate: the `WHERE user_id = …` that
 * keeps accounts apart stays written in exactly one place per table.
 *
 * Note that it still takes a `userId`, even though the page it feeds is
 * public. Public means "rendered for a reader who is not signed in", not
 * "unscoped" — the id is the site owner's, resolved by `lib/site-owner.ts`,
 * and invariant 1 holds unchanged.
 */
import { getProfile } from './profile.ts';
import { listProjects } from './projects.ts';
import { listSocials } from './socials.ts';
import { listTimeline } from './timeline.ts';
import type { SiteContent } from '../types.ts';

export async function getSiteContent(userId: string): Promise<SiteContent> {
  const [profile, socials, projects, timeline] = await Promise.all([
    getProfile(userId),
    listSocials(userId),
    listProjects(userId),
    listTimeline(userId),
  ]);

  return { profile, socials, projects, timeline };
}

/**
 * The same payload with everything archived stripped out, which is what a
 * reader who cannot restore anything should see.
 *
 * The filtering happens here rather than in the four list queries because
 * the archived rows have to survive the trip for the owner — see D-003 and
 * `.claude/rules/components.md`, "Archived content must stay reachable".
 */
export function publicView(content: SiteContent): SiteContent {
  return {
    profile: content.profile,
    socials: content.socials.filter((row) => !row.isArchived),
    projects: content.projects
      .filter((row) => !row.isArchived)
      .map((row) => ({ ...row, categories: row.categories.filter((c) => !c.isArchived) })),
    timeline: content.timeline.filter((row) => !row.isArchived),
  };
}
