import { withApiErrors } from '@/lib/http';
import { getSiteContent } from '@/lib/queries/content';
import { requireUserId } from '@/lib/session';

/**
 * `GET /api/content` — the whole page in one payload, **including archived
 * rows**.
 *
 * The public page is server-rendered from the same query with the archived
 * rows stripped (`publicView`), so this endpoint exists for exactly one
 * caller: the admin layer, once it has confirmed a session. That is why it
 * is authenticated and the page is not — an anonymous reader already has
 * everything they are allowed to see in the HTML they were served.
 */
export async function GET(request: Request): Promise<Response> {
  return withApiErrors(async () => {
    const userId = await requireUserId(request);
    return Response.json(await getSiteContent(userId));
  });
}
