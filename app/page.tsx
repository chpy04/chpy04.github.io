import type { Metadata } from 'next';
import { cache } from 'react';
import PortfolioPage from '@/components/portfolio/PortfolioPage';
import { isFeedbackEnabled } from '@/lib/feedback/enabled';
import { getSiteContent, publicView } from '@/lib/queries/content';
import { getSiteOwner } from '@/lib/site-owner';
import type { SiteContent } from '@/lib/types';

/**
 * The portfolio. Server-rendered from the database on every request, then
 * handed to a client tree that can edit it in place.
 *
 * `force-dynamic` is load-bearing twice over. It is what makes an edit
 * visible without a redeploy — the whole point of moving the content into
 * Postgres — and it is what keeps `next build` working on a machine with no
 * database (D-002): without it Next would try to prerender this page at
 * build time and evaluate the query layer to do it.
 */
export const dynamic = 'force-dynamic';

/**
 * One read per request, shared between `generateMetadata` and the page.
 * Next calls both, and `cache()` is what stops that being two round trips
 * for the same rows.
 */
const loadContent = cache(async (): Promise<SiteContent | null> => {
  const owner = await getSiteOwner();
  if (!owner) return null;
  return publicView(await getSiteContent(owner.id));
});

export async function generateMetadata(): Promise<Metadata> {
  const content = await loadContent();
  if (!content) return { title: 'Portfolio' };

  const { name, metaDescription } = content.profile;
  const title = name ? `${name} — ${content.profile.taglineRole.trim()}`.trim() : 'Portfolio';

  return {
    title,
    description: metaDescription,
    openGraph: { title: name || 'Portfolio', description: metaDescription, type: 'website' },
  };
}

export default async function HomePage() {
  const content = await loadContent();

  // No users yet — a fresh checkout before `npm run db:seed`. Saying so
  // beats rendering an empty page that looks like a styling bug.
  if (!content) return <SetupNotice />;

  return <PortfolioPage initialContent={content} feedbackEnabled={isFeedbackEnabled()} />;
}

function SetupNotice() {
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-xl font-semibold text-ink">No site owner yet</h1>
      <p className="mt-2 text-sm text-ink-dim">
        This database has no users, so there is no portfolio to show. Run{' '}
        <code className="rounded bg-surface px-1.5 py-0.5 text-ink-soft">npm run db:seed</code> to
        create one.
      </p>
    </main>
  );
}
